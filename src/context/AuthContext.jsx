/**
 * context/AuthContext.jsx
 *
 * Added vs previous version:
 *   switchSociety(societyId) — switches active society, re-issues JWT, updates user state
 *   joinSociety(payload)     — joins a second society, refreshes user
 *   activeSocietyId          — convenience derived from user.activeSocietyId
 *   memberships              — convenience derived from user.memberships
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { authApi }      from "../api/auth.api";
import { tokenStorage } from "../utils/storage";
import { authEvents }   from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Holds the registerForPushNotifications fn injected by NotificationContext.
  const registerPushRef = useRef(null);

  // ── Restore session on app launch ─────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) { setLoading(false); return; }
      try {
        const { data } = await authApi.refreshToken(refreshToken);
        tokenStorage.setAccess(data.accessToken);
        await tokenStorage.setRefresh(data.refreshToken);

        const meRes = await authApi.getMe();
        const fresh = meRes.data.user;
        setUser(fresh);
        await tokenStorage.setUser(fresh);
      } catch {
        await tokenStorage.clearAll();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  // ── Listen for forced logout from Axios interceptor ────────────────────────
  useEffect(() => {
    const unsubscribe = authEvents.onLogout(async () => {
      await tokenStorage.clearAll();
      setUser(null);
    });
    return unsubscribe;
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const login = useCallback(async ({ email, password }) => {
    try {
      const response = await authApi.login({ email, password });
      const { data } = response;
      if (!data) throw new Error("No data in login response: " + JSON.stringify(response));

      tokenStorage.setAccess(data.accessToken);
      await tokenStorage.setRefresh(data.refreshToken);
      await tokenStorage.setUser(data.user);
      setUser(data.user);

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
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload);
    tokenStorage.setAccess(data.accessToken);
    await tokenStorage.setRefresh(data.refreshToken);
    await tokenStorage.setUser(data.user);
    setUser(data.user);

    if (registerPushRef.current) {
      registerPushRef.current().catch((e) =>
        console.warn("[AuthContext] Push token registration failed:", e?.message)
      );
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore network errors on logout */ }
    await tokenStorage.clearAll();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await authApi.getMe();
    const fresh = data.user;
    setUser(fresh);
    await tokenStorage.setUser(fresh);
    return fresh;
  }, []);

  // ── Multi-society actions ──────────────────────────────────────────────────

  /**
   * Switch the active society context.
   * Issues a new JWT with the new societyId.
   * After this call, all subsequent API requests use the new society context.
   */
  const switchSociety = useCallback(async (societyId) => {
    const { data } = await authApi.switchSociety(societyId);
    // Replace tokens — new JWT carries the new societyId
    tokenStorage.setAccess(data.accessToken);
    await tokenStorage.setRefresh(data.refreshToken);
    await tokenStorage.setUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Join a second (or subsequent) society.
   * Adds a new membership entry to the user's account.
   * Membership may be pending approval depending on society joinMode.
   */
  const joinSociety = useCallback(async (payload) => {
    const { data } = await authApi.joinSociety(payload);
    // Refresh user so memberships array is up-to-date
    await refreshUser();
    return data; // { user, society, pendingApproval }
  }, [refreshUser]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isAdmin  = user?.role === "admin";
  const isLogged = !!user;

  // Convenience: resolve activeSocietyId whether populated or raw ObjectId
  const activeSocietyId =
    user?.activeSocietyId?._id?.toString() ||
    user?.activeSocietyId?.toString() ||
    null;

  const memberships = user?.memberships || [];

  // ── RBAC helpers ───────────────────────────────────────────────────────────
  // Resolve the active membership's permissions object
  const _activeMembership = user?.memberships?.find(
    (m) => m.society?._id?.toString() === activeSocietyId ||
           m.society?.toString()       === activeSocietyId
  );

  // Raw permissions map from the active membership
  const permissions = _activeMembership?.permissions || {};

  // Committee display title (e.g. "Treasurer", "Security In-charge")
  const committeeTitle = _activeMembership?.committeeTitle || null;

  // Role string for the active society
  const role = _activeMembership?.role || user?.role || null;

  const LEVEL_ORDER = ["none", "read", "write", "full"];

  /**
   * Check if the current user has at least `level` permission on `module`.
   * Admin always returns true.
   *
   * hasPermission("maintenance", "write") → true for admin + treasurer
   * hasPermission("visitors", "read")     → true for security + admin
   */
  const hasPermission = (module, level = "read") => {
    if (isAdmin) return true;
    const effectiveLevel = permissions[module] || "none";
    const required = LEVEL_ORDER.indexOf(level);
    const actual   = LEVEL_ORDER.indexOf(effectiveLevel);
    return actual >= 1 && actual >= required;
  };

  /**
   * isCommittee — true for any non-resident privileged role
   * (admin, committee, security)
   */
  const isCommittee = ["admin", "committee", "security"].includes(role);

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
        hasPermission,
        login,
        register,
        logout,
        refreshUser,
        registerPushRef,
        // Multi-society
        switchSociety,
        joinSociety,
        activeSocietyId,
        memberships,
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