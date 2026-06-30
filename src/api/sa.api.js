/**
 * src/api/sa.api.js
 * All 19 Super Admin API calls — grouped by domain.
 * (React Native / Expo version - same as web, no changes needed)
 *
 * Every method uses saClient so tokens are completely isolated from society API.
 */

import saClient, { unwrapSA } from "./saClient";

// ─── Auth (5 endpoints) ────────────────────────────────────────────────────────
export const saAuthApi = {
  /** POST /superadmin/auth/login */
  login: (payload) => {
    return saClient.post("/superadmin/auth/login", payload).then((res) => {
      return unwrapSA(res);
    }).catch((err) => {
      console.error("[saAuthApi.login] Error:", {
        status: err.response?.status,
        message: err.response?.data?.message,
        error: err.message,
      });
      throw err;
    });
  },

  /** POST /superadmin/auth/refresh */
  refresh: (token) =>
    saClient
      .post("/superadmin/auth/refresh", { refreshToken: token })
      .then(unwrapSA),

  /** POST /superadmin/auth/logout */
  logout: () => saClient.post("/superadmin/auth/logout").then(unwrapSA),

  /** GET /superadmin/auth/me */
  me: () => saClient.get("/superadmin/auth/me").then(unwrapSA),

  /** PATCH /superadmin/auth/change-password */
  changePassword: (payload) =>
    saClient
      .patch("/superadmin/auth/change-password", payload)
      .then(unwrapSA),
};

// ─── Applications (5 endpoints) ────────────────────────────────────────────────
export const saApplicationsApi = {
  /**
   * POST /superadmin/applications  — Public (no SA token required)
   * Used by the public society-apply form.
   */
  apply: (payload) =>
    saClient.post("/superadmin/applications", payload).then(unwrapSA),

  /** GET /superadmin/applications?status=pending|approved|rejected */
  getAll: (params = {}) =>
    saClient.get("/superadmin/applications", { params }).then(unwrapSA),

  /** GET /superadmin/applications/:id */
  getOne: (id) =>
    saClient.get(`/superadmin/applications/${id}`).then(unwrapSA),

  /** PATCH /superadmin/applications/:id/approve — creates Society + admin User + trial subscription */
  approve: (id) =>
    saClient
      .patch(`/superadmin/applications/${id}/approve`)
      .then(unwrapSA),

  /** PATCH /superadmin/applications/:id/reject */
  reject: (id, note) =>
    saClient
      .patch(`/superadmin/applications/${id}/reject`, { note })
      .then(unwrapSA),
};

// ─── Societies (7 endpoints) ──────────────────────────────────────────────────
export const saSocietiesApi = {
  /** GET /superadmin/societies?plan=&status=&search= */
  getAll: (params = {}) =>
    saClient.get("/superadmin/societies", { params }).then(unwrapSA),

  /** GET /superadmin/societies/:id */
  getOne: (id) =>
    saClient.get(`/superadmin/societies/${id}`).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/subscription
   * Payload: { plan, status, trialEndsAt, subscriptionEndsAt }
   */
  updateSub: (id, payload) =>
    saClient
      .patch(`/superadmin/societies/${id}/subscription`, payload)
      .then(unwrapSA),

  /** PATCH /superadmin/societies/:id/suspend  { reason } */
  suspend: (id, reason) =>
    saClient
      .patch(`/superadmin/societies/${id}/suspend`, { reason })
      .then(unwrapSA),

  /** PATCH /superadmin/societies/:id/reactivate */
  reactivate: (id) =>
    saClient
      .patch(`/superadmin/societies/${id}/reactivate`)
      .then(unwrapSA),

  /** PATCH /superadmin/societies/:id/transfer-admin  { newAdminUserId } or { newAdminEmail } */
  transferAdmin: (id, payload) =>
    saClient
      .patch(`/superadmin/societies/${id}/transfer-admin`, payload)
      .then(unwrapSA),

  /** POST /superadmin/societies/:id/reset-admin-password */
  resetAdminPass: (id) =>
    saClient
      .post(`/superadmin/societies/${id}/reset-admin-password`)
      .then(unwrapSA),
};

// ─── Analytics (2 endpoints) ──────────────────────────────────────────────────
export const saAnalyticsApi = {
  /** GET /superadmin/analytics/overview?period=7d|30d|90d */
  overview: (params = {}) =>
    saClient.get("/superadmin/analytics/overview", { params }).then(unwrapSA),

  /** GET /superadmin/analytics/societies/:id */
  societyDetail: (id) =>
    saClient.get(`/superadmin/analytics/societies/${id}`).then(unwrapSA),
};
// ─── Module Management (Section 06) ───────────────────────────────────────────
export const saModulesApi = {
  /** GET /superadmin/societies/:id/modules */
  getModules: (societyId) =>
    saClient.get(`/superadmin/societies/${societyId}/modules`).then(unwrapSA),

  /** PATCH /superadmin/societies/:id/modules  { modules: {visitors: true}, charges: {visitors: 350} } */
  updateModules: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/modules`, payload).then(unwrapSA),

  /** POST /superadmin/societies/:id/modules/bundle  { bundle: "starter"|"operations"|"fullstack", replaceAll?: bool } */
  applyBundle: (societyId, payload) =>
    saClient.post(`/superadmin/societies/${societyId}/modules/bundle`, payload).then(unwrapSA),

  /** GET /superadmin/modules/upgrade-requests — list all pending upgrade requests across societies */
  listUpgradeRequests: () =>
    saClient.get("/superadmin/modules/upgrade-requests").then(unwrapSA),
};

// ─── Subscription / Pricing (custom per-society rates) ────────────────────────
// Two distinct mechanisms — see SASocietyPricing.jsx for the full picture:
//
//   1. Grant a plan directly — updateSub({ plan, status, subscriptionEndsAt })
//      No payment involved at all. This is how you give a society "all
//      features free" — set plan: "premium", status: "active", and a
//      far-future end date. Razorpay never gets called for this society
//      until/unless you later clear it back to a payable plan.
//
//   2. Negotiate a discounted rate — setCustomPricing({ enabled, monthlyRupees, note })
//      The society is still on a normal paid plan and still pays via
//      Razorpay, just at a rate you set instead of the standard ₹599/₹999.
//      This is how you do "₹10/month for this one society". monthlyRupees
//      must be ≥ 1 — Razorpay itself has no concept of a ₹0 charge, so a
//      fully-free society should use mechanism (1) above, not this one
//      with monthlyRupees: 0.
export const saSubscriptionApi = {
  /**
   * PATCH /superadmin/societies/:id/subscription
   * Payload: { plan, status, endDate, priceMonthly, autoRenew, adminNotes, note }
   * Directly sets the society's plan/status — no payment involved.
   */
  updateSub: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/subscription`, payload).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/custom-pricing
   * Payload: { enabled: boolean, monthlyRupees?: number (≥1), note?: string }
   * Sets/clears a negotiated Razorpay rate. Takes effect on the society's
   * NEXT payment — does not retroactively change an already-active period.
   */
  setCustomPricing: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/custom-pricing`, payload).then(unwrapSA),

  /** GET /superadmin/societies/:id — includes society + subscription, used to prefill the pricing screen */
  getOne: (societyId) =>
    saClient.get(`/superadmin/societies/${societyId}`).then(unwrapSA),
};