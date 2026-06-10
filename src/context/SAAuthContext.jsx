/**
 * src/context/SAAuthContext.jsx
 * Super Admin session — fully isolated from society AuthContext.
 *
 * Fixes:
 *  - Session restore uses raw axios (not saClient) to avoid interceptor loop
 *  - Cached user shown immediately while token refresh happens in background
 *  - AppState listener: re-validates token when app comes back to foreground
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import axios from "axios";
import { saAuthApi } from "../api/sa.api";
import { saTokenStorage, saEventEmitter } from "../api/saClient";
import { BASE_URL } from "../api/client";

const SAAuthContext = createContext(null);

export const SAAuthProvider = ({ children }) => {
  const [saUser,  setSaUser]  = useState(null);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  // ── Core restore logic ────────────────────────────────────────────────────
  const restoreSession = useCallback(async () => {
    try {
      const refresh = await saTokenStorage.getRefresh();
      if (!refresh) { setSaUser(null); return false; }

      // Use raw axios so we don't hit the saClient interceptor during boot
      const { data } = await axios.post(
        `${BASE_URL}/superadmin/auth/refresh`,
        { refreshToken: refresh },
        { timeout: 15_000 }
      );

      const newAccess  = data.data?.accessToken  ?? data.accessToken;
      const newRefresh = data.data?.refreshToken ?? data.refreshToken;

      saTokenStorage.setAccess(newAccess);
      await saTokenStorage.setRefresh(newRefresh);

      // Fetch fresh user profile with the new access token
      const meRes = await axios.get(`${BASE_URL}/superadmin/auth/me`, {
        headers: { Authorization: `Bearer ${newAccess}` },
        timeout: 15_000,
      });
      const fresh = meRes.data?.data?.superAdmin ?? meRes.data?.data ?? meRes.data;
      setSaUser(fresh);
      await saTokenStorage.setUser(fresh);
      return true;
    } catch (err) {
      console.warn("[SA] Session restore failed:", err.message);
      // Clear invalid tokens; the init() useEffect already showed cached user
      // before calling restoreSession(), so don't overwrite saUser here.
      await saTokenStorage.clearAll();
      setSaUser(null);
      return false;
    }
  }, []);

  // ── Restore on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Show cached user instantly so screens don't flash empty
      const cached = await saTokenStorage.getUser();
      if (cached) setSaUser(cached);

      await restoreSession();
      setLoading(false);
    };
    init();
  }, [restoreSession]);

  // ── Issue 8: Re-fetch when app comes back to foreground ───────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        // App came back to foreground — silently refresh SA session
        if (saUser) await restoreSession();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [saUser, restoreSession]);

  // ── Interceptor logout event ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = saTokenStorage.onLogout(async () => {
      setSaUser(null);
      await saTokenStorage.clearAll();
    });
    return unsub;
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const res = await saAuthApi.login({ email, password });
    const d   = res.data ?? res;

    saTokenStorage.setAccess(d.accessToken);
    await saTokenStorage.setRefresh(d.refreshToken);

    const sa = d.superAdmin ?? d.user ?? d;
    await saTokenStorage.setUser(sa);
    setSaUser(sa);
    return sa;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await saAuthApi.logout(); } catch { /* ignore */ }
    await saTokenStorage.clearAll();
    setSaUser(null);
  }, []);

  return (
    <SAAuthContext.Provider value={{ saUser, loading, isLogged: !!saUser, login, logout }}>
      {children}
    </SAAuthContext.Provider>
  );
};

export const useSAAuth = () => {
  const ctx = useContext(SAAuthContext);
  if (!ctx) throw new Error("useSAAuth must be inside <SAAuthProvider>");
  return ctx;
};