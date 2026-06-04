/**
 * src/context/SAAuthContext.jsx
 * Super Admin session — fully isolated from society AuthContext.
 * React Native / Expo version with SecureStore
 *
 * Provides: saUser, loading, isLogged, login, logout
 * Listens for logout event emitted by saClient on forced logout.
 *
 * Key differences from web version:
 * - Uses async/await for SecureStore (encrypted storage)
 * - Event emitter instead of window.dispatchEvent
 * - Handles async token retrieval
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { saAuthApi } from "../api/sa.api";
import { saTokenStorage, saEventEmitter } from "../api/saClient";

const SAAuthContext = createContext(null);

export const SAAuthProvider = ({ children }) => {
  const [saUser, setSaUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount (async) ───────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      try {
        const refresh = await saTokenStorage.getRefresh();
        if (!refresh) {
          setLoading(false);
          return;
        }

        // Refresh the access token
        try {
          const refreshRes = await saAuthApi.refresh(refresh);
          const newAccess =
            refreshRes.data?.accessToken ?? refreshRes.accessToken;
          const newRefresh =
            refreshRes.data?.refreshToken ?? refreshRes.refreshToken;

          saTokenStorage.setAccess(newAccess);
          await saTokenStorage.setRefresh(newRefresh);

          // Get current user info
          const meRes = await saAuthApi.me();
          const fresh =
            meRes.data?.superAdmin ?? meRes.data?.user ?? meRes.data;

          setSaUser(fresh);
          await saTokenStorage.setUser(fresh);
        } catch (refreshErr) {
          // If refresh fails, clear all tokens
          await saTokenStorage.clearAll();
          setSaUser(null);
          console.warn("SA token refresh failed:", refreshErr);
        }
      } catch (error) {
        console.warn("SA session restore failed:", error);
        setSaUser(null);
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  // ── Listen for interceptor-triggered logout ────────────────────────────────
  useEffect(() => {
    const handleLogout = async () => {
      setSaUser(null);
      await saTokenStorage.clearAll();
    };

    const unsubscribe = saTokenStorage.onLogout(handleLogout);
    return unsubscribe;
  }, []);

  // ── Login action ───────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    try {
      const res = await saAuthApi.login({ email, password });
      const d = res.data ?? res;

      saTokenStorage.setAccess(d.accessToken);
      await saTokenStorage.setRefresh(d.refreshToken);

      const sa = d.superAdmin ?? d.user ?? d;
      await saTokenStorage.setUser(sa);
      setSaUser(sa);

      return sa;
    } catch (err) {
      console.error("[SAAuthContext.login] SA login failed:", err.message);
      throw err;
    }
  }, []);

  // ── Logout action ──────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await saAuthApi.logout();
    } catch (error) {
      // Ignore logout API errors — always clear locally
      console.warn("Logout API error (ignored):", error);
    }
    await saTokenStorage.clearAll();
    setSaUser(null);
  }, []);

  return (
    <SAAuthContext.Provider
      value={{ saUser, loading, isLogged: !!saUser, login, logout }}
    >
      {children}
    </SAAuthContext.Provider>
  );
};

export const useSAAuth = () => {
  const ctx = useContext(SAAuthContext);
  if (!ctx) {
    throw new Error("useSAAuth must be inside <SAAuthProvider>");
  }
  return ctx;
};