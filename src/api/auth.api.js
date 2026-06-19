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
  forgotPassword:(payload)     => client.post("/auth/forgot-password", payload).then(unwrap),
  resetPassword: (payload)     => client.post("/auth/reset-password", payload).then(unwrap),
  changePassword: (payload)    => client.patch("/auth/change-password", payload).then(unwrap),
  // Unauthenticated — first login with a temp password (mustChangePassword=true).
  // Returns { user, accessToken, refreshToken } so the caller can log straight in.
  forceChangePassword: (payload) => client.post("/auth/force-change-password", payload).then(unwrap),
  logout:       ()             => client.post("/auth/logout").then(unwrap),
  getMe:        ()             => client.get("/auth/me").then(unwrap),
  updateProfile:(payload)      => client.patch("/users/profile",      payload).then(unwrap),
  updateFcmToken:(token)       => client.patch("/users/fcm-token",    { fcmToken: token }).then(unwrap),

  // ── Multi-society ─────────────────────────────────────────────────────────
/**
   * Switch the active society context.
   * Returns new { user, accessToken, refreshToken } with updated JWT.
   */
    switchSociety: (societyId)  => client.post("/auth/switch-society", { societyId }, { _skipRequestHold: true }).then(unwrap),

  /**
   * Join a second (or subsequent) society using a join code.
   * Returns { user, society, pendingApproval }.
    */
  joinSociety:  (payload)     => client.post("/auth/join-society",   payload).then(unwrap),

  // ── NEW: Invite link token pre-verify ─────────────────────────────────────
  // Called by useInviteLink before navigating to Register screen.
  // GET /invite-link/verify?token=TOKEN  (public, no auth header needed)
  verifyInviteToken: (token)  => client.get("/invite-link/verify", { params: { token } }).then(unwrap),
};