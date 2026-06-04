/**
 * api/auth.api.js
 * Identical API surface to web — same method names, same payloads.
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
};