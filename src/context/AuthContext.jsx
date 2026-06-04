/**
 * context/AuthContext.jsx
 * React Native port of web AuthContext.
 *
 * Key differences:
 *   - tokenStorage is async → await getRefresh() / getUser()
 *   - authEvents.onLogout() replaces window.addEventListener("auth:logout")
 *   - useEffect restore is async-aware
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi }      from "../api/auth.api";
import { tokenStorage } from "../utils/storage";
import { authEvents }   from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on app launch ─────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) { setLoading(false); return; }
      try {
        const { data } = await authApi.refreshToken(refreshToken);
        tokenStorage.setAccess(data.accessToken);
        await tokenStorage.setRefresh(data.refreshToken);

        const meRes   = await authApi.getMe();
        const fresh   = meRes.data.user;
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
      if (!data) {
        throw new Error("No data in login response: " + JSON.stringify(response));
      }
      
      tokenStorage.setAccess(data.accessToken);
      await tokenStorage.setRefresh(data.refreshToken);
      await tokenStorage.setUser(data.user);
      setUser(data.user);
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
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
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

  const isAdmin  = user?.role === "admin";
  const isLogged = !!user;

  return (
    <AuthContext.Provider
      value={{ user, loading, isLogged, isAdmin, login, register, logout, refreshUser }}
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