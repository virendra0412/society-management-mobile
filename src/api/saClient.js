/**
 * src/api/saClient.js
 * Isolated Axios instance for Super Admin API calls (React Native / Expo version)
 *
 * - Completely separate from the society client (different tokens, different keys)
 * - Access token in memory; refresh token in SecureStore (encrypted)
 * - Auto-refresh on 401 with request queue (same pattern as web)
 * - Emits custom event via EventEmitter for forced logout (RN compatible)
 */

import axios from "axios";
import * as SecureStore from "expo-secure-store";

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Must match client.js exactly — use the same EXPO_PUBLIC_ env var so both
// clients always hit the same server. Constants.expoConfig?.extra?.apiBaseUrl
// was used before but that key doesn't exist in app.json, so it resolved to
// undefined and fell back to a stale hardcoded URL.
import { BASE_URL } from "./client";


// ─── SA Token Storage (with SecureStore) ─────────────────────────────────────
// SecureStore encrypts sensitive data on the device
const SA_REFRESH_KEY = "sa_refresh_token";
const SA_USER_KEY = "sa_user";

let _saAccessToken = null;

// ─── Simple Event Emitter (React Native compatible) ──────────────────────────
// Lightweight alternative to Node's EventEmitter for use in React Native/Expo
class SimpleEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.removeListener(event, callback);
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(...args));
    }
  }

  removeListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    }
  }
}

// Event emitter for logout events (RN-compatible alternative to window.dispatchEvent)
const saEventEmitter = new SimpleEventEmitter();

export const saTokenStorage = {
  getAccess: () => _saAccessToken,
  setAccess: (t) => {
    _saAccessToken = t;
  },
  clearAccess: () => {
    _saAccessToken = null;
  },

  // ── SecureStore methods (async) ────────────────────────────────────────────
  getRefresh: async () => {
    try {
      return await SecureStore.getItemAsync(SA_REFRESH_KEY);
    } catch (e) {
      console.warn("Failed to get refresh token from SecureStore:", e);
      return null;
    }
  },
  setRefresh: async (t) => {
    try {
      await SecureStore.setItemAsync(SA_REFRESH_KEY, t);
    } catch (e) {
      console.warn("Failed to set refresh token in SecureStore:", e);
    }
  },
  clearRefresh: async () => {
    try {
      await SecureStore.deleteItemAsync(SA_REFRESH_KEY);
    } catch (e) {
      console.warn("Failed to clear refresh token from SecureStore:", e);
    }
  },

  // ── User data (AsyncStorage via JSON) ──────────────────────────────────────
  getUser: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SA_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn("Failed to get user from SecureStore:", e);
      return null;
    }
  },
  setUser: async (u) => {
    try {
      await SecureStore.setItemAsync(SA_USER_KEY, JSON.stringify(u));
    } catch (e) {
      console.warn("Failed to set user in SecureStore:", e);
    }
  },
  clearUser: async () => {
    try {
      await SecureStore.deleteItemAsync(SA_USER_KEY);
    } catch (e) {
      console.warn("Failed to clear user from SecureStore:", e);
    }
  },

  clearAll: async () => {
    _saAccessToken = null;
    await saTokenStorage.clearRefresh();
    await saTokenStorage.clearUser();
  },

  // ── Event emitter for logout signals ───────────────────────────────────────
  onLogout: (callback) => {
    saEventEmitter.on("logout", callback);
    return () => saEventEmitter.removeListener("logout", callback);
  },
  emitLogout: () => {
    saEventEmitter.emit("logout");
  },
};

// ─── Axios Instance ───────────────────────────────────────────────────────────
const saClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Attach SA access token to every request
saClient.interceptors.request.use(
  (config) => {
    const token = saTokenStorage.getAccess();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── 401 Auto-refresh ─────────────────────────────────────────────────────────
let _saRefreshing = false;
let _saQueue = [];

const processQueue = (err, token = null) => {
  _saQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token)
  );
  _saQueue = [];
};

saClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const is401 = error.response?.status === 401;
    const isRetried = original._saRetry;
    const isAuthRoute =
      original.url?.includes("/superadmin/auth/login") ||
      original.url?.includes("/superadmin/auth/refresh");

    if (is401 && !isRetried && !isAuthRoute) {
      if (_saRefreshing) {
        return new Promise((resolve, reject) => {
          _saQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return saClient(original);
        });
      }

      original._saRetry = true;
      _saRefreshing = true;

      const refresh = await saTokenStorage.getRefresh();
      if (!refresh) {
        _saRefreshing = false;
        await saTokenStorage.clearAll();
        saTokenStorage.emitLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/superadmin/auth/refresh`, {
          refreshToken: refresh,
        }, { timeout: 15_000 });

        const newAccess = data.data?.accessToken ?? data.accessToken;
        const newRefresh = data.data?.refreshToken ?? data.refreshToken;

        saTokenStorage.setAccess(newAccess);
        await saTokenStorage.setRefresh(newRefresh);

        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return saClient(original);
      } catch (err) {
        processQueue(err, null);
        await saTokenStorage.clearAll();
        saTokenStorage.emitLogout();
        return Promise.reject(err);
      } finally {
        _saRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Unwrap standard API shape: { success, data, meta, message }
 */
export const unwrapSA = (response) => {
  const result = {
    data: response.data?.data ?? response.data,
    meta: response.data?.meta,
    message: response.data?.message,
  };
  return result;
};

export { saEventEmitter };
export default saClient;