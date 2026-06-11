/**
 * api/client.js
 * Axios instance for React Native.
 *
 * Differences from web version:
 *   - BASE_URL from app.json extra.apiBaseUrl via expo-constants (no import.meta.env)
 *   - tokenStorage.getRefresh() is async → await in refresh logic
 *   - "auth:logout" uses a simple EventEmitter approach (no window object in RN)
 *   - Everything else is identical to the web client
 */
import axios from "axios";
import { tokenStorage } from "../utils/storage";

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Reads from EXPO_PUBLIC_API_BASE_URL in your .env file.
// Expo natively inlines any variable prefixed EXPO_PUBLIC_ at build time —
// no extra plugin or expo-constants import needed.
// Fallback keeps localhost working for bare `expo start` without an .env.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://society-management-system-clou.onrender.com/api/v1";

export { BASE_URL };

// ─── Simple event emitter for forced logout ───────────────────────────────────
// React Native has no `window` — use a lightweight pub/sub instead.
const _listeners = new Set();
export const authEvents = {
  onLogout: (fn)  => { _listeners.add(fn); return () => _listeners.delete(fn); },
  logout:   ()    => _listeners.forEach((fn) => fn()),
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

let _requestHold = null;

export const holdRequests = (promise) => {
  _requestHold = promise;
};

export const releaseRequests = () => {
  _requestHold = null;
};

// Attach access token
client.interceptors.request.use(
  async (config) => {
    if (_requestHold && !config._skipRequestHold) {
      await _requestHold.catch(() => {});
    }
    const token = tokenStorage.getAccess();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── 401 → silent refresh → retry ────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue = [];

const processQueue = (error, token = null) => {
  _refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  _refreshQueue = [];
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const is401       = error.response?.status === 401;
    const isRetried   = original._retry;
    const isAuthRoute = original.url?.includes("/auth/refresh-token") ||
                        original.url?.includes("/auth/login");

    if (is401 && !isRetried && !isAuthRoute) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      original._retry = true;
      _isRefreshing   = true;

      // SecureStore is async in RN
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) {
        _isRefreshing = false;
        await tokenStorage.clearAll();
        authEvents.logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefresh } = data.data;
        tokenStorage.setAccess(accessToken);
        await tokenStorage.setRefresh(newRefresh);

        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return client(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStorage.clearAll();
        authEvents.logout();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Unwrap standard API shape: { success, data, meta, message }
 */
export const unwrap = (response) => {
  const result = {
    data:    response.data?.data ?? response.data,
    meta:    response.data?.meta,
    message: response.data?.message,
  };
  return result;
};

export default client;
