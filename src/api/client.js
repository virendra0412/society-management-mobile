/**
 * api/client.js
 * Axios instance for React Native.
 *
 * KEY FIX in the 401 interceptor:
 *   After /auth/refresh-token succeeds, we immediately call /auth/switch-society
 *   with the user's activeSocietyId. This re-issues the JWT WITH societyId embedded.
 *   Without this step, the refreshed JWT has no societyId claim, causing every
 *   society-scoped endpoint (requireSociety middleware) to return 403.
 *
 * Differences from web version:
 *   - BASE_URL from EXPO_PUBLIC_API_BASE_URL env var
 *   - tokenStorage.getRefresh() is async → await in refresh logic
 *   - "auth:logout" uses a simple EventEmitter approach (no window object in RN)
 */
import axios from "axios";
import { tokenStorage } from "../utils/storage";

// ─── Base URL ─────────────────────────────────────────────────────────────────
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://society-management-system-clou.onrender.com/api/v1";

export { BASE_URL };

// ─── Simple event emitter for forced logout ───────────────────────────────────
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

export const holdRequests = (promise) => { _requestHold = promise; };
export const releaseRequests = () => { _requestHold = null; };

// Attach access token to every request.
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

// ─── 401 → silent refresh → switch-society → retry ───────────────────────────
// Two-step refresh:
//   1. Call /auth/refresh-token to get a new access token (no societyId in JWT).
//   2. Call /auth/switch-society with the user's activeSocietyId to re-issue the
//      JWT WITH societyId embedded (required by requireSociety middleware).
// Without step 2, all society-scoped API calls return 403 after a token refresh.
let _isRefreshing = false;
let _refreshQueue = [];

const processQueue = (error, token = null) => {
  _refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  _refreshQueue = [];
};

// Helper: extract activeSocietyId from the stored user object.
// Handles both populated objects ({ _id: "..." }) and raw ObjectId strings.
const _getStoredSocietyId = async () => {
  try {
    const user = await tokenStorage.getUser();
    const raw  = user?.activeSocietyId;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    // Populated object: { _id: "...", name: "..." }
    if (typeof raw === "object") return raw._id?.toString() ?? raw.id?.toString() ?? null;
    return null;
  } catch {
    return null;
  }
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const is401       = error.response?.status === 401;
    const isRetried   = original._retry;
    const isAuthRoute = original.url?.includes("/auth/refresh-token") ||
                        original.url?.includes("/auth/login")         ||
                        original.url?.includes("/auth/switch-society");

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

      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) {
        _isRefreshing = false;
        await tokenStorage.clearAll();
        authEvents.logout();
        return Promise.reject(error);
      }

      try {
        // Step 1: Refresh the access token.
        const { data: refreshData } = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefresh } = refreshData.data;
        tokenStorage.setAccess(accessToken);
        await tokenStorage.setRefresh(newRefresh);

        // Step 2: Re-issue a society-scoped JWT via switch-society.
        // The plain refreshed JWT has no societyId claim; every requireSociety
        // check will 403 without this step.
        const societyId = await _getStoredSocietyId();
        let finalToken  = accessToken;

        if (societyId) {
          try {
            const { data: switchData } = await axios.post(
              `${BASE_URL}/auth/switch-society`,
              { societyId },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const switched = switchData.data;
            if (switched?.accessToken) {
              tokenStorage.setAccess(switched.accessToken);
              await tokenStorage.setRefresh(switched.refreshToken);
              // Persist updated user if returned.
              if (switched.user) await tokenStorage.setUser(switched.user);
              finalToken = switched.accessToken;
            }
          } catch {
            // switch-society failed — proceed with the plain refreshed token.
            // Society-scoped calls may still 403, but this avoids a hard logout.
            console.warn("[client] switch-society after 401-refresh failed");
          }
        }

        processQueue(null, finalToken);
        original.headers.Authorization = `Bearer ${finalToken}`;
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
export const unwrap = (response) => ({
  data:    response.data?.data ?? response.data,
  meta:    response.data?.meta,
  message: response.data?.message,
});

export default client;