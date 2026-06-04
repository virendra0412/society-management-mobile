/**
 * utils/storage.js
 * React Native token storage using expo-secure-store.
 *
 * DROP-IN replacement for the web version (same API surface):
 *   tokenStorage.getAccess / setAccess / clearAccess
 *   tokenStorage.getRefresh / setRefresh / clearRefresh
 *   tokenStorage.getUser / setUser / clearUser / clearAll
 *
 * Key differences from web:
 *   - SecureStore is async — getRefresh/getUser return Promises
 *   - Access token still lives in memory (module-level variable) for speed
 *   - SecureStore is hardware-backed on iOS (Keychain) and Android (Keystore)
 */
import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "society_refresh_token";
const USER_KEY    = "society_user";

// In-memory access token — cleared on app restart (forces silent refresh)
let _accessToken = null;

export const tokenStorage = {
  // ── Access token (synchronous, in-memory) ──────────────────────────────────
  getAccess:   ()      => _accessToken,
  setAccess:   (token) => { _accessToken = token; },
  clearAccess: ()      => { _accessToken = null; },

  // ── Refresh token (async, SecureStore) ─────────────────────────────────────
  getRefresh:   ()      => SecureStore.getItemAsync(REFRESH_KEY),
  setRefresh:   (token) => SecureStore.setItemAsync(REFRESH_KEY, token),
  clearRefresh: ()      => SecureStore.deleteItemAsync(REFRESH_KEY),

  // ── User object (async, SecureStore) ───────────────────────────────────────
  getUser: async () => {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser:   (user) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  clearUser: ()     => SecureStore.deleteItemAsync(USER_KEY),

  // ── Clear everything ────────────────────────────────────────────────────────
  clearAll: () => {
    _accessToken = null;
    return Promise.all([
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};