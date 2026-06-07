/**
 * api/resources.api.js
 * All resource APIs — identical surface to web version.
 * Copy-paste safe: same method names, same params, same return shape.
 */
import client, { unwrap } from "./client";

// ─── Notices ──────────────────────────────────────────────────────────────────
export const noticesApi = {
  getAll:    (p = {})       => client.get("/notices",               { params: p }).then(unwrap),
  create:    (d)            => client.post("/notices",               d).then(unwrap),
  update:    (id, d)        => client.patch(`/notices/${id}`,       d).then(unwrap),
  remove:    (id)           => client.delete(`/notices/${id}`).then(unwrap),
  // Bug fix: setPinned was in web API but missing from mobile.
  // PATCH /notices/:id/pin  { isPinned: bool }
  setPinned: (id, isPinned) => client.patch(`/notices/${id}/pin`,   { isPinned }).then(unwrap),
};

// ─── Visitors ────────────────────────────────────────────────────────────────
export const visitorsApi = {
  // ── Core visitor APIs (Flows A & B) ────────────────────────────────────────
  getAll:        (p = {}) => client.get("/visitors",                  { params: p }).then(unwrap),
  getMine:       (p = {}) => client.get("/visitors/mine",             { params: p }).then(unwrap),
  getOne:        (id)     => client.get(`/visitors/${id}`).then(unwrap),
  createInvite:  (d)      => client.post("/visitors/invite",          d).then(unwrap),
  logWalkIn:     (d)      => client.post("/visitors/walk-in",         d).then(unwrap),
  approveWalkIn: (id)     => client.patch(`/visitors/${id}/approve`).then(unwrap),
  rejectWalkIn:  (id)     => client.patch(`/visitors/${id}/reject`).then(unwrap),
  cancelInvite:  (id)     => client.patch(`/visitors/${id}/cancel`).then(unwrap),
  verifyOTP:     (id, otp)=> client.post(`/visitors/${id}/verify-otp`, { otp }).then(unwrap),
  // Bug fix: was /checkout → backend route is /exit
  markExit:      (id)     => client.patch(`/visitors/${id}/exit`).then(unwrap),
  getMyVisitors: (p = {}) => client.get("/visitors/mine",             { params: p }).then(unwrap),

  // ── Flow C: Trusted Visitor APIs ───────────────────────────────────────────
  // Resident: register a new trusted pass (maid, cook, driver, etc.)
  registerTrusted:  (d)      => client.post("/visitors/trusted",              d).then(unwrap),
  // Resident: list their own trusted passes (?activeOnly=true to filter)
  getMyTrusted:     (p = {}) => client.get("/visitors/trusted/mine",          { params: p }).then(unwrap),
  // Resident: update schedule, passType, notes etc.
  updateTrusted:    (id, d)  => client.patch(`/visitors/trusted/${id}`,       d).then(unwrap),
  // Resident: revoke a pass immediately
  revokeTrusted:    (id)     => client.patch(`/visitors/trusted/${id}/revoke`).then(unwrap),
  // Security: look up a trusted visitor by phone or name (guard screen)
  lookupTrusted:    (p = {}) => client.get("/visitors/trusted/lookup",        { params: p }).then(unwrap),
  // Security: record auto-entry for a trusted visitor
  trustedEntry:     (id)     => client.post(`/visitors/trusted/${id}/entry`).then(unwrap),
};

// ─── Issues ───────────────────────────────────────────────────────────────────
export const issuesApi = {
  getAll:       (p = {}) => client.get("/issues",            { params: p }).then(unwrap),
  getOne:       (id)     => client.get(`/issues/${id}`).then(unwrap),
  create:       (d)      => client.post("/issues",            d).then(unwrap),
  update:       (id, d)  => client.patch(`/issues/${id}`,    d).then(unwrap),   // was PUT
  remove:       (id)     => client.delete(`/issues/${id}`).then(unwrap),
  // Fixed: backend route is /comments with body { body }, not /notes with { text }
  addNote:      (id, t)  => client.post(`/issues/${id}/comments`, { body: t }).then(unwrap),
  // Dedicated vendor assignment route (PATCH /issues/:id/vendor)
  assignVendor: (id, d)  => client.patch(`/issues/${id}/vendor`, d).then(unwrap),
  uploadPhoto:  (id, asset) => {
    const fd  = new FormData();
    const ext = (asset.uri.split(".").pop() || "jpg").replace("jpg", "jpeg");
    fd.append("photo", { uri: asset.uri, name: `photo.${ext}`, type: `image/${ext}` });
    return client.post(`/issues/${id}/photos`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(unwrap);
  },
};

// ─── Help ─────────────────────────────────────────────────────────────────────
export const helpApi = {
  getAll:       (p = {}) => client.get("/help",                       { params: p }).then(unwrap),
  getOne:       (id)     => client.get(`/help/${id}`).then(unwrap),
  create:       (d)      => client.post("/help",                       d).then(unwrap),
  addReply:     (id, d)  => client.post(`/help/${id}/replies`,        d).then(unwrap),
  upvoteReply:  (id, rId)=> client.post(`/help/${id}/replies/${rId}/upvote`).then(unwrap),
  close:        (id)     => client.patch(`/help/${id}/close`).then(unwrap),
};

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsApi = {
  getAll:  (p = {}) => client.get("/contacts",         { params: p }).then(unwrap),
  create:  (d)      => client.post("/contacts",         d).then(unwrap),
  update:  (id, d)  => client.put(`/contacts/${id}`,   d).then(unwrap),
  remove:  (id)     => client.delete(`/contacts/${id}`).then(unwrap),
};

// ─── Polls ────────────────────────────────────────────────────────────────────
export const pollsApi = {
  getAll:  (p = {}) => client.get("/polls",             { params: p }).then(unwrap),
  create:  (d)      => client.post("/polls",             d).then(unwrap),
  vote:    (id, d)  => client.post(`/polls/${id}/vote`, d).then(unwrap),
  close:   (id)     => client.patch(`/polls/${id}/close`).then(unwrap),
};

// ─── Amenities ────────────────────────────────────────────────────────────────
export const amenitiesApi = {
  getAll:        (p = {}) => client.get("/amenities",                          { params: p }).then(unwrap),
  getOne:        (id)     => client.get(`/amenities/${id}`).then(unwrap),
  create:        (d)      => client.post("/amenities",                          d).then(unwrap),
  update:        (id, d)  => client.put(`/amenities/${id}`,                    d).then(unwrap),
  deactivate:    (id)     => client.patch(`/amenities/${id}/deactivate`).then(unwrap),
  getAvailability:(id,dt) => client.get(`/amenities/${id}/availability`, { params: { date: dt } }).then(unwrap),
  book:          (id, d)  => client.post(`/amenities/${id}/bookings`,          d).then(unwrap),
  getMyBookings: (p = {}) => client.get("/amenities/bookings/mine",      { params: p }).then(unwrap),
  getAllBookings: (p = {}) => client.get("/amenities/bookings/all",       { params: p }).then(unwrap),
  cancelBooking: (id,bId,r)=> client.patch(`/amenities/bookings/${bId}/cancel`, { reason: r }).then(unwrap),
  confirmBooking:(id,bId,n)=> client.patch(`/amenities/bookings/${bId}/confirm`, { adminNote: n }).then(unwrap),
  rejectBooking: (id,bId,n)=> client.patch(`/amenities/bookings/${bId}/reject`,  { adminNote: n }).then(unwrap),
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventsApi = {
  getAll:       (p = {}) => client.get("/events",              { params: p }).then(unwrap),
  getOne:       (id)     => client.get(`/events/${id}`).then(unwrap),
  create:       (d)      => client.post("/events",              d).then(unwrap),
  update:       (id, d)  => client.put(`/events/${id}`,        d).then(unwrap),
  publish:      (id)     => client.patch(`/events/${id}/publish`).then(unwrap),
  cancel:       (id, r)  => client.patch(`/events/${id}/cancel`, { reason: r }).then(unwrap),
  rsvp:         (id, d)  => client.post(`/events/${id}/rsvp`,  d).then(unwrap),
  removeRsvp:   (id)     => client.delete(`/events/${id}/rsvp`).then(unwrap),
  getAttendees: (id)     => client.get(`/events/${id}/attendees`).then(unwrap),
};

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const maintenanceApi = {
  // Bills — both roles (residents see published only)
  getAllBills:    (p = {})          => client.get("/maintenance",                                         { params: p }).then(unwrap),
  getBillById:   (id)               => client.get(`/maintenance/${id}`).then(unwrap),

  // Resident — own payment history across all bills
  getMyPayments: (p = {})          => client.get("/maintenance/my-payments",                             { params: p }).then(unwrap),
  // Alias used by HomeScreen due-bill banner
  getMyBills:    (p = {})          => client.get("/maintenance",                                         { params: p }).then(unwrap),
  getDefaulters: (p = {})          => client.get("/maintenance/defaulters",                              { params: p }).then(unwrap),

  // Admin — bill lifecycle
  createBill:    (d)                => client.post("/maintenance",                                        d).then(unwrap),
  updateBill:    (id, d)            => client.patch(`/maintenance/${id}`,                                 d).then(unwrap),
  publishBill:   (id)               => client.patch(`/maintenance/${id}/publish`).then(unwrap),
  closeBill:     (id)               => client.patch(`/maintenance/${id}/close`).then(unwrap),
  applyPenalty:  (id)               => client.patch(`/maintenance/${id}/apply-penalty`).then(unwrap),

  // Admin — per-resident payment record actions
  recordPayment: (billId, paymentId, d)      => client.patch(`/maintenance/${billId}/payments/${paymentId}`,             d).then(unwrap),
  applyDiscount: (billId, paymentId, amount) => client.patch(`/maintenance/${billId}/payments/${paymentId}/discount`,    { discount: amount }).then(unwrap),
};

// ─── Parking ──────────────────────────────────────────────────────────────────
export const parkingApi = {
  getSummary:     ()         => client.get("/parking/slots/summary").then(unwrap),
  getSlots:       (p = {})   => client.get("/parking/slots",          { params: p }).then(unwrap),
  createSlot:     (d)        => client.post("/parking/slots",          d).then(unwrap),
  bulkCreateSlots:(d)        => client.post("/parking/slots/bulk",     d).then(unwrap),
  releaseSlot:    (id)       => client.patch(`/parking/slots/${id}/release`).then(unwrap),
  submitRequest:  (d)        => client.post("/parking/requests",       d).then(unwrap),
  getMyRequests:  (p = {})   => client.get("/parking/requests/mine",   { params: p }).then(unwrap),
  cancelRequest:  (id)       => client.patch(`/parking/requests/${id}/cancel`).then(unwrap),
  getAllRequests:  (p = {})   => client.get("/parking/requests",        { params: p }).then(unwrap),
  approveRequest: (id, slotId)=> client.patch(`/parking/requests/${id}/approve`, slotId ? { slotId } : {}).then(unwrap),
  rejectRequest:  (id, note) => client.patch(`/parking/requests/${id}/reject`,   { adminNote: note }).then(unwrap),
};
// ─── User / Profile ───────────────────────────────────────────────────────────
export const userApi = {
  getProfile:         ()          => client.get("/users/profile").then(unwrap),
  updateProfile:      (d)         => client.patch("/users/profile", d).then(unwrap),
  uploadAvatar:       (formData)  => client.post("/users/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(unwrap),
  addFamilyMember:    (d)         => client.post("/users/profile/family", d).then(unwrap),
  updateFamilyMember: (id, d)     => client.patch(`/users/profile/family/${id}`, d).then(unwrap),
  removeFamilyMember: (id)        => client.delete(`/users/profile/family/${id}`).then(unwrap),
  // Admin — member approval
  getPendingMembers:  ()          => client.get("/users/pending").then(unwrap),
  approveMember:      (id)        => client.patch(`/users/${id}/approve`).then(unwrap),
  rejectMember:       (id)        => client.patch(`/users/${id}/reject`).then(unwrap),
  // Admin — committee management (RBAC)
  getCommitteeMembers: ()         => client.get("/users/committee").then(unwrap),
  assignCommitteeRole: (id, d)    => client.post(`/users/${id}/committee`, d).then(unwrap),
  removeCommitteeRole: (id)       => client.delete(`/users/${id}/committee`).then(unwrap),
};

export const modulesApi = {
  /** GET /api/v1/modules/status — which modules are enabled for the active society */
  getStatus: () => client.get("/modules/status").then(unwrap),

  /** POST /api/v1/modules/request-upgrade  { module: "visitors" } — admin requests SA to enable a module */
  requestUpgrade: (moduleKey) =>
    client.post("/modules/request-upgrade", { module: moduleKey }).then(unwrap),
};