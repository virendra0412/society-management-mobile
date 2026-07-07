/**
 * src/api/sa.api.js
 * All Super Admin API calls — grouped by domain.
 */

import saClient, { unwrapSA } from "./saClient";

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const saAuthApi = {
  login: (payload) =>
    saClient.post("/superadmin/auth/login", payload).then(unwrapSA),
  refresh: (token) =>
    saClient.post("/superadmin/auth/refresh", { refreshToken: token }).then(unwrapSA),
  logout: () => saClient.post("/superadmin/auth/logout").then(unwrapSA),
  me: ()    => saClient.get("/superadmin/auth/me").then(unwrapSA),
  changePassword: (payload) =>
    saClient.patch("/superadmin/auth/change-password", payload).then(unwrapSA),
};

// ─── Applications ──────────────────────────────────────────────────────────────
export const saApplicationsApi = {
  apply:   (payload) => saClient.post("/superadmin/applications", payload).then(unwrapSA),
  getAll:  (params = {}) => saClient.get("/superadmin/applications", { params }).then(unwrapSA),
  getOne:  (id) => saClient.get(`/superadmin/applications/${id}`).then(unwrapSA),
  approve: (id) => saClient.patch(`/superadmin/applications/${id}/approve`).then(unwrapSA),
  reject:  (id, note) => saClient.patch(`/superadmin/applications/${id}/reject`, { note }).then(unwrapSA),
};

// ─── Societies ─────────────────────────────────────────────────────────────────
export const saSocietiesApi = {
  getAll:        (params = {}) => saClient.get("/superadmin/societies", { params }).then(unwrapSA),
  getOne:        (id) => saClient.get(`/superadmin/societies/${id}`).then(unwrapSA),
  updateSub:     (id, payload) => saClient.patch(`/superadmin/societies/${id}/subscription`, payload).then(unwrapSA),
  suspend:       (id, reason)  => saClient.patch(`/superadmin/societies/${id}/suspend`, { reason }).then(unwrapSA),
  reactivate:    (id) => saClient.patch(`/superadmin/societies/${id}/reactivate`).then(unwrapSA),
  transferAdmin: (id, payload) => saClient.patch(`/superadmin/societies/${id}/transfer-admin`, payload).then(unwrapSA),
  resetAdminPass:(id) => saClient.post(`/superadmin/societies/${id}/reset-admin-password`).then(unwrapSA),
};

// ─── Analytics ─────────────────────────────────────────────────────────────────
export const saAnalyticsApi = {
  overview:      (params = {}) => saClient.get("/superadmin/analytics/overview", { params }).then(unwrapSA),
  societyDetail: (id) => saClient.get(`/superadmin/analytics/societies/${id}`).then(unwrapSA),
};

// ─── Module Management ──────────────────────────────────────────────────────────
export const saModulesApi = {
  getModules:          (societyId) => saClient.get(`/superadmin/societies/${societyId}/modules`).then(unwrapSA),
  updateModules:       (societyId, payload) => saClient.patch(`/superadmin/societies/${societyId}/modules`, payload).then(unwrapSA),
  applyBundle:         (societyId, payload) => saClient.post(`/superadmin/societies/${societyId}/modules/bundle`, payload).then(unwrapSA),
  listUpgradeRequests: () => saClient.get("/superadmin/modules/upgrade-requests").then(unwrapSA),
};

// ─── Subscription / Pricing ────────────────────────────────────────────────────
//
// THREE mechanisms, each with a different purpose:
//
//   A) updateSub({ plan, status, endDate, priceMonthly, note })
//      Directly sets plan/status — no Razorpay, no payment. Use for
//      fully-free / comped societies (friends, pilots, demos).
//      plan: "enterprise", status: "active", endDate: 10 years from now = free forever.
//
//   B) setCustomPricing({ enabled, monthlyRupees, note })
//      Society stays on a payable plan but pays a negotiated Razorpay rate
//      instead of the standard price. ₹10/month pilot customer = this.
//      Takes effect on their NEXT payment.
//
//   C) setDiscount({ pct?, flatRupees?, code?, validUntil?, note?, clear? })
//      Apply a coupon / percentage / flat discount on top of whatever rate
//      is already set (custom or standard). Also takes effect on next payment.
//      Set clear: true to remove a discount entirely.
//
//   D) scheduleDowngrade({ toPlan, note? })
//      Queue a plan downgrade for the next renewal date. Society keeps the
//      current plan until then. Job applies it automatically at endDate.
//      Cannot schedule an upgrade (use admin's Upgrade screen for that).
//
export const saSubscriptionApi = {
  /** GET /superadmin/societies/:id — includes subscription, prefills screen */
  getOne: (societyId) =>
    saClient.get(`/superadmin/societies/${societyId}`).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/subscription
   * { plan, status, endDate, priceMonthly, autoRenew, adminNotes, note }
   * Direct grant — no Razorpay.
   */
  updateSub: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/subscription`, payload).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/custom-pricing
   * { enabled: boolean, monthlyRupees?: number (≥1), note?: string }
   * Sets/clears a negotiated Razorpay rate. Takes effect on next payment.
   * monthlyRupees must be ≥ 1 — use updateSub for truly-free societies.
   */
  setCustomPricing: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/custom-pricing`, payload).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/discount
   * { pct?, flatRupees?, code?, validUntil?, note?, clear? }
   * Set or clear a coupon/discount. Applied on top of any custom rate.
   * Takes effect on next payment.
   *   clear: true  → remove existing discount entirely
   *   pct: 20      → 20% off
   *   flatRupees: 100 → ₹100 off
   *   validUntil   → auto-expires on that date (optional)
   */
  setDiscount: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/discount`, payload).then(unwrapSA),

  /**
   * PATCH /superadmin/societies/:id/schedule-downgrade
   * { toPlan: "starter"|"professional"|"free", note? }
   * Queue a downgrade for the society's next renewal date.
   * Current plan stays active until endDate. Job applies it automatically.
   */
  scheduleDowngrade: (societyId, payload) =>
    saClient.patch(`/superadmin/societies/${societyId}/schedule-downgrade`, payload).then(unwrapSA),
};
