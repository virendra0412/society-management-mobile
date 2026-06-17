/**
 * context/AuthContext.jsx
 *
 * KEY FIX (root cause of "data goes 0 after Expo reload"):
 *
 *   The backend /auth/refresh-token endpoint issues a JWT that does NOT embed
 *   societyId. Every society-scoped endpoint runs requireSociety() which checks
 *   that claim and returns 403 "You are not a member of this society." This is
 *   why data shows 0 — all 4 data calls (issues, help, notices, maintenance)
 *   return 403, not empty arrays.
 *
 *   Fix: after a successful token refresh in restoreSession(), call
 *   /auth/switch-society with the user's activeSocietyId. This re-issues the
 *   JWT with societyId embedded (identical to what a fresh login produces).
 *   Super admin is unaffected — they use SAAuthContext and never hit requireSociety.
 *
 * Secondary fixes (same file, prevent related races):
 *   - refreshUser() guards against running when no access token is present
 *     (prevents AppState background→active race on Expo reload).
 *   - bumpDataVersion() is only called after a valid access token exists,
 *     so data screens never fire API calls without a token.
 *   - _isRestoringRef blocks the AppState listener while restoreSession() runs.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { authApi }      from "../api/auth.api";
import { tokenStorage } from "../utils/storage";
import { authEvents, holdRequests, releaseRequests } from "../api/client";

const AuthContext = createContext(null);

const normalizeId = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value._id || value.id) return normalizeId(value._id || value.id);
    if (value.$oid) return normalizeId(value.$oid);
    const str = value.toString?.();
    if (typeof str === "string" && str !== "[object Object]") return str;
    try { return JSON.stringify(value); } catch { return null; }
  }
  return String(value);
};

export const AuthProvider = ({ children }) => {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  const registerPushRef = useRef(null);
  const appStateRef     = useRef(AppState.currentState);
  const switchQueueRef  = useRef(Promise.resolve());
  // Blocks AppState listener from racing against restoreSession().
  const _isRestoringRef = useRef(false);

  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  // ── Core session restore ───────────────────────────────────────────────────
  const restoreSession = useCallback(async () => {
    _isRestoringRef.current = true;
    try {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) {
        // No refresh token — show cached user (name/flat) but no data fetch.
        const cached = await tokenStorage.getUser();
        setUser(cached || null);
        // Do NOT bumpDataVersion — no valid access token exists yet.
        return false;
      }

      // Step 1: Exchange refresh token for a new access token.
      let accessToken, newRefreshToken, freshUser;
      try {
        const { data } = await authApi.refreshToken(refreshToken);
        accessToken     = data.accessToken;
        newRefreshToken = data.refreshToken;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Refresh token is revoked/expired — full logout.
          await tokenStorage.clearAll();
          setUser(null);
          bumpDataVersion();
        } else {
          // Network error — show cached user but no token, so no data fetch.
          const cached = await tokenStorage.getUser();
          setUser(cached || null);
        }
        return false;
      }

      // Step 2: Store the raw access token temporarily so getMe() can run.
      tokenStorage.setAccess(accessToken);
      await tokenStorage.setRefresh(newRefreshToken);

      // Step 3: Fetch fresh user profile.
      try {
        const meRes = await authApi.getMe();
        freshUser = meRes.data.user;
      } catch {
        // getMe failed — fall back to cached user; token is set so data calls
        // might still work but we conservatively don't bump.
        const cached = await tokenStorage.getUser();
        setUser(cached || null);
        return false;
      }

      // Step 4: THE KEY FIX — re-issue a society-scoped JWT.
      //
      // /auth/refresh-token returns a JWT with NO societyId claim.
      // Every society endpoint runs requireSociety() which checks that claim
      // and returns 403 "You are not a member of this society."
      // /auth/switch-society re-issues the JWT WITH societyId embedded,
      // exactly as a fresh login does.
      //
      // We only do this for users who belong to a society (not super admin —
      // they use SAAuthContext entirely).
      const activeSocId = normalizeId(freshUser?.activeSocietyId);
      if (activeSocId) {
        try {
          const switchRes = await authApi.switchSociety(activeSocId);
          // switchSociety returns { user, accessToken, refreshToken }
          tokenStorage.setAccess(switchRes.data.accessToken);
          await tokenStorage.setRefresh(switchRes.data.refreshToken);
          // Use the user from switchSociety if it's richer; fall back to getMe user.
          freshUser = switchRes.data.user ?? freshUser;
        } catch {
          // If switch-society fails (e.g. network blip), continue with the
          // plain refreshed token. Data calls will likely 403, but this is
          // better than a crash or forced logout.
          console.warn("[AuthContext] switch-society after refresh failed — society-scoped calls may 403");
        }
      }

      // Step 5: Commit user and unblock data screens.
      setUser(freshUser);
      await tokenStorage.setUser(freshUser);
      // Only bump NOW — access token is valid and society-scoped.
      bumpDataVersion();
      return true;
    } finally {
      _isRestoringRef.current = false;
    }
  }, [bumpDataVersion]);

  // ── Restore session on app launch ─────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      // Show cached user immediately (name/flat visible while network runs).
      // Do NOT bumpDataVersion — wait until we have a valid society-scoped token.
      const cached = await tokenStorage.getUser();
      if (cached) setUser(cached);

      await restoreSession();
      setLoading(false);
    };
    restore();
  }, [restoreSession]);

  // ── Listen for forced logout from Axios interceptor ───────────────────────
  useEffect(() => {
    const unsubscribe = authEvents.onLogout(async () => {
      await tokenStorage.clearAll();
      setUser(null);
    });
    return unsubscribe;
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async ({ email, password }) => {
    try {
      const response = await authApi.login({ email, password });
      const { data } = response;
      if (!data) throw new Error("No data in login response: " + JSON.stringify(response));

      tokenStorage.setAccess(data.accessToken);
      await tokenStorage.setRefresh(data.refreshToken);
      await tokenStorage.setUser(data.user);
      setUser(data.user);
      bumpDataVersion();

      if (registerPushRef.current) {
        registerPushRef.current().catch((e) =>
          console.warn("[AuthContext] Push token registration failed:", e?.message)
        );
      }
      return data.user;
    } catch (err) {
      console.error("[AuthContext.login] Login failed:", err.message);
      throw err;
    }
  }, [bumpDataVersion]);

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload);
    tokenStorage.setAccess(data.accessToken);
    await tokenStorage.setRefresh(data.refreshToken);
    await tokenStorage.setUser(data.user);
    setUser(data.user);
    bumpDataVersion();

    if (registerPushRef.current) {
      registerPushRef.current().catch((e) =>
        console.warn("[AuthContext] Push token registration failed:", e?.message)
      );
    }
    return data;
  }, [bumpDataVersion]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    await tokenStorage.clearAll();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    // Guard: only call getMe() when an access token exists.
    // Without this, an AppState background→active event during Expo reload
    // races against restoreSession() and both try to consume the refresh token.
    if (!tokenStorage.getAccess()) return null;

    const { data } = await authApi.getMe();
    const fresh = data.user;
    setUser(fresh);
    await tokenStorage.setUser(fresh);
    bumpDataVersion();
    return fresh;
  }, [bumpDataVersion]);

  // ── Reload user when app comes back from background ───────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        // Back off if restoreSession() is in flight (Expo reload scenario).
        if (_isRestoringRef.current) return;

        try { await refreshUser(); } catch { /* interceptor handles expired token */ }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [refreshUser]);

  // ── Multi-society actions ──────────────────────────────────────────────────

  const switchSociety = useCallback(async (societyId) => {
    const runSwitch = async () => {
      let releaseHold;
      const hold = new Promise((resolve) => { releaseHold = resolve; });
      holdRequests(hold);
      try {
        const { data } = await authApi.switchSociety(societyId);
        tokenStorage.setAccess(data.accessToken);
        await tokenStorage.setRefresh(data.refreshToken);
        await tokenStorage.setUser(data.user);
        setUser(data.user);
        bumpDataVersion();
        return data.user;
      } finally {
        releaseHold();
        releaseRequests();
      }
    };

    const next = switchQueueRef.current.then(runSwitch, runSwitch);
    switchQueueRef.current = next.catch(() => {});
    return next;
  }, [bumpDataVersion]);

  const joinSociety = useCallback(async (payload) => {
    const { data } = await authApi.joinSociety(payload);
    await refreshUser();
    return data;
  }, [refreshUser]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isAdmin  = user?.role === "admin";
  const isLogged = !!user;

  const activeSocietyId = normalizeId(user?.activeSocietyId);
  const memberships     = user?.memberships || [];

  const _activeMembership = user?.memberships?.find(
    (m) => m.society?._id?.toString() === activeSocietyId ||
           m.society?.toString()       === activeSocietyId
  );

  const permissions    = _activeMembership?.permissions || {};
  const committeeTitle = _activeMembership?.committeeTitle || null;
  const role           = _activeMembership?.role || user?.role || null;

  const LEVEL_ORDER = ["none", "read", "write", "full"];

  const hasPermission = (module, level = "read") => {
    if (isAdmin) return true;
    const effectiveLevel = permissions[module] || "none";
    const required = LEVEL_ORDER.indexOf(level);
    const actual   = LEVEL_ORDER.indexOf(effectiveLevel);
    return actual >= 1 && actual >= required;
  };

  const isCommittee = ["admin", "committee", "security"].includes(role);

  const activeSociety  = user?.activeSocietyId;
  const subscription   = activeSociety?.subscription;
  const plan           = subscription?.plan ?? "free";
  const trialDaysLeft  = subscription?.daysRemaining ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLogged,
        isAdmin,
        isCommittee,
        role,
        permissions,
        committeeTitle,
        dataVersion,
        hasPermission,
        login,
        register,
        logout,
        refreshUser,
        registerPushRef,
        switchSociety,
        joinSociety,
        activeSocietyId,
        memberships,
        plan,
        trialDaysLeft,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};