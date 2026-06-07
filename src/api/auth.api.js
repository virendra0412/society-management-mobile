/**
 * api/auth.api.js
 */
import client, { unwrap } from "./client";

export const authApi = {
  register:     (payload)      => client.post("/auth/register",      payload).then(unwrap),
  login:        (payload)      => {
    return client.post("/auth/login", payload).then((res) => {
      return unwrap(res);
    }).catch((err) => {
      console.error("[authApi.login] Error:", {
        status: err.response?.status,
        message: err.response?.data?.message,
        error: err.message,
      });
      throw err;
    });
  },
  refreshToken: (refreshToken) => client.post("/auth/refresh-token", { refreshToken }).then(unwrap),
  logout:       ()             => client.post("/auth/logout").then(unwrap),
  getMe:        ()             => client.get("/auth/me").then(unwrap),
  updateProfile:(payload)      => client.patch("/users/profile",      payload).then(unwrap),

  // ── Multi-society ────────────────────────────────────────────────────────────
  /**
   * Switch the active society context.
   * Returns new { user, accessToken, refreshToken } with updated JWT.
   */
  switchSociety: (societyId)  => client.post("/auth/switch-society", { societyId }).then(unwrap),

  /**
   * Join a second (or subsequent) society using a join code.
   * Returns { user, society, pendingApproval }.
   */
  joinSociety:  (payload)     => client.post("/auth/join-society",   payload).then(unwrap),
};