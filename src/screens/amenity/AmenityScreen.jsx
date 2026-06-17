/**
 * screens/amenity/AmenityScreen.jsx
 *
 * Resident view: Browse (all amenities) → My Bookings (filtered by status)
 * Admin view:    Browse → My Bookings → All Bookings (with approve/reject)
 *
 * Gaps fixed:
 *   TC-AMEN-11 — Admin "+ Add Amenity" button + AmenityFormModal (create)
 *   TC-AMEN-12 — Admin "Edit" button per card pre-fills same modal (update)
 *
 * API calls covered:
 *   getAll, book, getMyBookings, getAllBookings, cancelBooking,
 *   confirmBooking, rejectBooking, create, update, deactivate, getAvailability
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { amenitiesApi } from "../../api/resources.api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Select, Spinner, ScreenHeader,
} from "../../components/ui";
import {
  C,
  AMENITY_CATEGORIES, AMENITY_CATEGORY_ICON,
  BOOKING_STATUS_COLOR,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });

const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

const amenityIcon = (cat) => AMENITY_CATEGORY_ICON[cat] || "🏢";

// ═══════════════════════════════════════════════════════
// AMENITY CARD — browse view
// ═══════════════════════════════════════════════════════
const AmenityCard = ({ amenity, onBook, onDeactivate, onEdit, isAdmin }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const icon = amenityIcon(amenity.category);

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await amenitiesApi.deactivate(amenity._id);
      toast.success(t("amenity_deactivated_success", "Amenity deactivated."));
      onDeactivate?.(amenity._id);
    } catch (e) {
      toast.error(e.response?.data?.message || t("amenity_deactivate_failed", "Failed to deactivate."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        {/* Icon */}
        <View style={[ac.iconBox, { backgroundColor: C.teal + "15" }]}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* Name + Category */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
            <Text style={[ac.name, { flex: 1 }]} numberOfLines={1}>{amenity.name}</Text>
            <Badge label={amenity.category} bg={C.teal + "15"} text={C.teal} />
          </View>

          {/* Description */}
          {amenity.description && (
            <Text style={[ac.desc, { marginBottom: 8 }]} numberOfLines={2}>
              {amenity.description}
            </Text>
          )}

          {/* Meta chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <Text style={ac.meta}>🕐 {amenity.openTime} – {amenity.closeTime}</Text>
            {amenity.depositAmount > 0 && (
              <Text style={ac.meta}>💰 ₹{amenity.depositAmount}</Text>
            )}
            {amenity.requiresApproval && (
              <Text style={[ac.meta, { color: C.amber }]}>⏳ {t("amenity_requires_approval", "Approval")}</Text>
            )}
            {amenity.maxConcurrentBookings > 1 && (
              <Text style={ac.meta}>👥 {amenity.maxConcurrentBookings}</Text>
            )}
          </View>

          {/* Slot durations */}
          {(amenity.slotDurationOptions || []).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {amenity.slotDurationOptions.map((d, i) => (
                <View key={i} style={ac.durationBadge}>
                  <Text style={ac.durationText}>
                    {d >= 60 ? `${d / 60}h` : `${d}m`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Rules */}
          {amenity.rules && (
            <View style={ac.rulesBox}>
              <Text style={ac.rulesText} numberOfLines={2}>
                📋 {amenity.rules}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.gray100 }}>
        <Btn small onPress={() => onBook(amenity)} style={{ flex: 1 }}>
          📅 {t("amenity_action_book", "Book")}
        </Btn>

        {/* TC-AMEN-12 — Edit button, triggers AmenityFormModal pre-filled */}
        {isAdmin && (
          <TouchableOpacity
            onPress={() => onEdit(amenity)}
            style={ac.editBtn}
          >
            <Text style={ac.editBtnText}>✏️ {t("amenity_action_edit", "Edit")}</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity
            onPress={handleDeactivate}
            disabled={busy}
            style={[ac.deactivateBtn, busy && { opacity: 0.6 }]}
          >
            {busy ? (
              <Spinner size={11} />
            ) : (
              <Text style={ac.deactivateBtnText}>{t("amenity_action_deactivate", "Deactivate")}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const ac = StyleSheet.create({
  iconBox:          { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  name:             { fontSize: 14, fontWeight: "700", color: C.navy },
  desc:             { fontSize: 12, color: C.gray500, lineHeight: 18 },
  meta:             { fontSize: 11, color: C.gray500, fontWeight: "500" },
  durationBadge:    { backgroundColor: C.navy + "10", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  durationText:     { fontSize: 10, fontWeight: "700", color: C.navy },
  rulesBox:         { backgroundColor: C.amber + "10", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.amber + "25" },
  rulesText:        { fontSize: 11, color: C.gray700, lineHeight: 16 },
  editBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.teal + "40", backgroundColor: C.teal + "10" },
  editBtnText:      { fontSize: 11, fontWeight: "700", color: C.teal },
  deactivateBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.red + "40", backgroundColor: C.red + "10" },
  deactivateBtnText:{ fontSize: 11, fontWeight: "700", color: C.red },
});

// ─── Helper: booking.amenity can be a populated object OR a bare string ID ────
const resolveAmenityId = (booking) =>
  typeof booking.amenity === "string"
    ? booking.amenity
    : booking.amenity?._id ?? booking.amenityId ?? null;

// ═══════════════════════════════════════════════════════
// BOOKING CARD — my bookings / all bookings
// ═══════════════════════════════════════════════════════
const BookingCard = ({ booking, isAdmin, onCancel, onConfirm, onReject }) => {
  const { t } = useLanguage();
  const sc = BOOKING_STATUS_COLOR[booking.status] || {};
  const canCancel = ["pending", "confirmed"].includes(booking.status);
  const canReview = booking.status === "pending";

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        {/* Icon */}
        <View style={[bc.iconBox, { backgroundColor: C.teal + "15" }]}>
          <Text style={{ fontSize: 20 }}>
            {amenityIcon(booking.amenity?.category)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* Name + Badge */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
            <Text style={bc.amenityName} numberOfLines={1}>
              {booking.amenity?.name || t("amenity_unknown_name", "Amenity")}
            </Text>
            <Badge label={booking.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
          </View>

          {/* Date & Time */}
          <Text style={bc.dateTime}>
            {fmtDate(booking.startTime)} · {fmtTime(booking.startTime)} – {fmtTime(booking.endTime)}
          </Text>

          {/* Admin info */}
          {isAdmin && booking.bookedBy && (
            <Text style={bc.userInfo}>
              👤 {booking.bookedBy.name} · Flat {booking.bookedBy.flat}
            </Text>
          )}
        </View>
      </View>

      {/* Details strip */}
      <View style={bc.detailsBox}>
        <Text style={bc.detailText}>⏱ {booking.durationMinutes} min</Text>
        {booking.guestCount > 1 && (
          <Text style={bc.detailText}>👥 {booking.guestCount} guests</Text>
        )}
        {booking.purpose && (
          <Text style={bc.detailText} numberOfLines={1}>📌 {booking.purpose}</Text>
        )}
        <Text style={bc.detailText}>Booked {timeAgo(booking.createdAt)}</Text>
      </View>

      {/* Admin note */}
      {booking.adminNote && (
        <View style={bc.noteBox}>
          <Text style={bc.noteText}>Admin: "{booking.adminNote}"</Text>
        </View>
      )}

      {/* Cancel reason */}
      {booking.cancelReason && (
        <View style={bc.cancelBox}>
          <Text style={bc.cancelText}>Cancelled: {booking.cancelReason}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.gray100 }}>
        {canCancel && !isAdmin && (
          <Btn small onPress={() => onCancel(booking)} style={{ flex: 1, backgroundColor: C.red + "10", borderColor: C.red }}>
            <Text style={{ color: C.red, fontWeight: "700", fontSize: 11 }}>{t("amenity_action_cancel", "Cancel")}</Text>
          </Btn>
        )}

        {canReview && isAdmin && (
          <>
            <Btn small onPress={() => onConfirm(booking)} style={{ flex: 1, backgroundColor: C.green + "10" }}>
              <Text style={{ color: C.green, fontWeight: "700", fontSize: 11 }}>✓ {t("amenity_action_confirm", "Confirm")}</Text>
            </Btn>
            <Btn small onPress={() => onReject(booking)} style={{ flex: 1, backgroundColor: C.red + "10" }}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 11 }}>✕ {t("amenity_action_reject", "Reject")}</Text>
            </Btn>
          </>
        )}

        {!canCancel && !canReview && (
          <Text style={{ fontSize: 11, color: C.gray500, flex: 1, paddingVertical: 6 }}>
            {t("amenity_no_actions", "No actions available")}
          </Text>
        )}
      </View>
    </Card>
  );
};

const bc = StyleSheet.create({
  iconBox:     { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  amenityName: { fontSize: 13, fontWeight: "700", color: C.navy, flex: 1 },
  dateTime:    { fontSize: 11, color: C.gray500, marginTop: 2 },
  userInfo:    { fontSize: 11, color: C.gray500, marginTop: 2 },
  detailsBox:  { backgroundColor: C.gray50, borderRadius: 8, padding: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailText:  { fontSize: 10, color: C.gray500 },
  noteBox:     { backgroundColor: C.amber + "10", borderRadius: 8, padding: 8, marginTop: 8 },
  noteText:    { fontSize: 11, color: C.gray700, fontStyle: "italic" },
  cancelBox:   { backgroundColor: C.red + "10", borderRadius: 8, padding: 8, marginTop: 8 },
  cancelText:  { fontSize: 11, color: C.red, fontWeight: "600" },
});

// ═══════════════════════════════════════════════════════
// AMENITY FORM MODAL — create + edit (TC-AMEN-11 & TC-AMEN-12)
// ═══════════════════════════════════════════════════════
const BLANK_AMENITY = {
  name: "",
  category: "Clubhouse",
  description: "",
  openTime: "06:00",
  closeTime: "22:00",
  maxConcurrentBookings: 1,
  advanceBookingDays: 7,
  depositAmount: 0,
  requiresApproval: false,
  rules: "",
};

const AmenityFormModal = ({ open, editing, onClose, onSaved }) => {
  const { t } = useLanguage();
  const toast = useToast();

  // Form fields
  const [form,          setForm]          = useState(BLANK_AMENITY);
  const [durationInput, setDurationInput] = useState("60");   // comma-separated string
  const [submitting,    setSubmitting]    = useState(false);

  // Pre-fill when editing, reset when creating
  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({ ...BLANK_AMENITY, ...editing });
        setDurationInput((editing.slotDurationOptions || [60]).join(", "));
      } else {
        setForm(BLANK_AMENITY);
        setDurationInput("60");
      }
    }
  }, [editing, open]);

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const fNum = (k) => (v) => setForm((p) => ({ ...p, [k]: Number(v) || 0 }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t("amenity_form_error_name", "Name is required."));

    // Parse comma-separated duration options
    const opts = durationInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0);
    if (opts.length === 0) return toast.error(t("amenity_form_error_duration", "Enter at least one slot duration (e.g. 60)."));

    const payload = { ...form, slotDurationOptions: opts };

    setSubmitting(true);
    try {
      const res = editing
        ? await amenitiesApi.update(editing._id, payload)   // TC-AMEN-12 — PATCH /amenities/:id
        : await amenitiesApi.create(payload);               // TC-AMEN-11 — POST /amenities
      toast.success(editing ? t("amenity_form_saved", "Amenity updated.") : t("amenity_form_created", "Amenity created."));
      onSaved(res.data?.amenity);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || t("amenity_form_save_failed", "Save failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t("amenity_form_title_edit", "Edit Amenity") : t("amenity_form_title_add", "Add Amenity")}
    >
      <Input
        label={t("amenity_form_label_name", "Name *")}
        value={form.name}
        onChangeText={f("name")}
        placeholder={t("amenity_form_placeholder_name", "e.g. Rooftop Swimming Pool")}
      />

      <Select
        label={t("amenity_form_label_category", "Category")}
        value={form.category}
        options={AMENITY_CATEGORIES}
        onChange={f("category")}
      />

      <Input
        label={t("amenity_form_label_description", "Description")}
        value={form.description}
        onChangeText={f("description")}
        placeholder={t("amenity_form_placeholder_description", "Olympic-size pool on Level 5")}
        multiline
      />

      {/* Opening hours side-by-side */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("amenity_form_label_open_time", "Opens at")}
            value={form.openTime}
            onChangeText={f("openTime")}
            placeholder="06:00"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t("amenity_form_label_close_time", "Closes at")}
            value={form.closeTime}
            onChangeText={f("closeTime")}
            placeholder="22:00"
          />
        </View>
      </View>

      <Input
        label={t("amenity_form_label_slot_durations", "Slot durations (min, comma-separated)")}
        value={durationInput}
        onChangeText={setDurationInput}
        placeholder="60, 120"
      />

      {/* Numeric fields side-by-side */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("amenity_form_label_max_concurrent", "Max concurrent")}
            value={String(form.maxConcurrentBookings)}
            onChangeText={fNum("maxConcurrentBookings")}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t("amenity_form_label_advance_days", "Advance days")}
            value={String(form.advanceBookingDays)}
            onChangeText={fNum("advanceBookingDays")}
            keyboardType="number-pad"
            placeholder="7"
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("amenity_form_label_deposit", "Deposit (₹)")}
            value={String(form.depositAmount)}
            onChangeText={fNum("depositAmount")}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label={t("amenity_form_label_approval", "Approval")}
            value={String(form.requiresApproval)}
            options={[
              { label: t("amenity_form_option_auto_confirm", "Auto-confirm"), value: "false" },
              { label: t("amenity_form_option_needs_approval", "Needs approval"), value: "true" },
            ]}
            onChange={(v) => setForm((p) => ({ ...p, requiresApproval: v === "true" }))}
          />
        </View>
      </View>

      <Input
        label={t("amenity_form_label_rules", "House Rules")}
        value={form.rules}
        onChangeText={f("rules")}
        placeholder={t("amenity_form_placeholder_rules", "No loud music after 9pm…")}
        multiline
      />

      <Btn onPress={handleSave} loading={submitting} style={{ width: "100%", marginTop: 4 }}>
        {editing ? t("amenity_form_action_save", "Save Changes") : t("amenity_form_action_create", "Create Amenity")}
      </Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// BROWSE TAB
// ═══════════════════════════════════════════════════════
const BrowseTab = ({ onBook, onDeactivate, onEdit, isAdmin, dataVersion }) => {
  const { t } = useLanguage();
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await amenitiesApi.getAll();
      setAmenities(res.data?.amenities || []);
    } catch (e) {
      setError(e.response?.data?.message || t("amenity_error_load", "Failed to load amenities."));
    } finally {
      setLoading(false);
    }
  }, [t, dataVersion]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (error) {
    return <View style={styles.centerContainer}><ErrorState message={error} onRetry={load} /></View>;
  }

  if (amenities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <EmptyState
          icon="🏢"
          message={isAdmin ? t("amenity_empty_admin", "No amenities yet. Add one!") : t("amenity_empty_resident", "No amenities available.")}
        />
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, paddingBottom: 40, gap: 10 }}>
        {amenities.map((amenity) => (
          <AmenityCard
            key={amenity._id}
            amenity={amenity}
            isAdmin={isAdmin}
            onBook={onBook}
            onDeactivate={onDeactivate}
            onEdit={onEdit}
          />
        ))}
      </View>
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════
// BOOKINGS TAB
// ═══════════════════════════════════════════════════════
const BookingsTab = ({ view, isAdmin, onCancel, onConfirm, onReject, dataVersion }) => {
  const { t } = useLanguage();
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { sort: "-createdAt", limit: 50 };
      if (statusFilter !== "all") params.status = statusFilter;

      const res = view === "allbookings"
        ? await amenitiesApi.getAllBookings(params)
        : await amenitiesApi.getMyBookings(params);

      setBookings(res.data?.bookings || []);
    } catch (e) {
      setError(e.response?.data?.message || t("amenity_error_load_bookings", "Failed to load bookings."));
    } finally {
      setLoading(false);
    }
  }, [view, statusFilter, dataVersion]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const STATUSES = ["all", "pending", "confirmed", "completed", "cancelled"];
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  const handleCancel = (booking) => {
    onCancel(booking);
    setBookings((p) => p.map((b) => b._id === booking._id ? { ...b, status: "cancelled" } : b));
  };

  const handleConfirm = (booking) => {
    onConfirm(booking);
    setBookings((p) => p.map((b) => b._id === booking._id ? { ...b, status: "confirmed" } : b));
  };

  const handleReject = (booking) => {
    onReject(booking);
    setBookings((p) => p.filter((b) => b._id !== booking._id));
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {STATUSES.map((s) => {
          const isActive = statusFilter === s;
          const count = s === "pending" ? pendingCount : 0;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.filterPill,
                isActive && { backgroundColor: C.teal, borderColor: C.teal },
              ]}
            >
              <Text style={[{ fontSize: 12, fontWeight: "700" }, isActive ? { color: "#fff" } : { color: C.gray600 }]}>
                {t(`amenity_booking_status_${s}`, s.charAt(0).toUpperCase() + s.slice(1))}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, isActive && { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: isActive ? "#fff" : C.teal }}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bookings list */}
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && bookings.length === 0 && (
        <EmptyState
          icon="📅"
          message={statusFilter === "all" ? t("amenity_bookings_empty_all", "No bookings yet.") : t("amenity_bookings_empty_status", "No bookings found.")}
        />
      )}
      {!error && bookings.length > 0 && (
        <View style={{ padding: 16, paddingBottom: 40, gap: 10 }}>
          {bookings.map((booking) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              isAdmin={view === "allbookings"}
              onCancel={handleCancel}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════
// BOOK SLOT MODAL
// ═══════════════════════════════════════════════════════
const BookSlotModal = ({ open, amenity, onClose, onBooked }) => {
  const { t } = useLanguage();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [guestCount, setGuestCount] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!date || !startTime || !duration) {
      return toast.error(t("amenity_booking_error_required_fields", "Please fill all required fields."));
    }                                                           // ← Fix 1: closed the if-block
    setBusy(true);
    try {
      const data = {
        startTime: `${date}T${startTime}:00Z`,
        durationMinutes: parseInt(duration),
        guestCount: parseInt(guestCount) || 1,
        purpose: purpose.trim() || undefined,
      };

      const res = await amenitiesApi.book(amenity._id, data);
      toast.success(t("amenity_booking_submitted", "Booking submitted!"));
      onBooked(res.data?.booking);
      onClose();

      // Reset form
      setDate(new Date().toISOString().split("T")[0]);
      setStartTime("10:00");
      setDuration("60");
      setGuestCount("1");
      setPurpose("");
    } catch (e) {
      toast.error(e.response?.data?.message || t("amenity_booking_failed", "Booking failed."));
    } finally {
      setBusy(false);
    }
  };

  const durationOptions = amenity?.slotDurationOptions || ["30", "60", "120"];

  return (
    <Modal open={open} onClose={onClose} title={t("amenity_booking_modal_title", "Book") + (amenity?.name ? `: ${amenity.name}` : "") }>
      <Input
        label={t("amenity_booking_label_date", "Date *")}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
      />
      <Input
        label={t("amenity_booking_label_time", "Time *")}
        value={startTime}
        onChangeText={setStartTime}
        placeholder="HH:MM"
      />


      <Text style={styles.label}>Duration *</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {durationOptions.map((d) => {
          const dStr = String(d);
          const on = duration === dStr;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => setDuration(dStr)}
              style={[
                styles.durationOption,
                on && { backgroundColor: C.teal, borderColor: C.teal },
              ]}
            >
              <Text style={[{ fontSize: 12, fontWeight: "700" }, on ? { color: "#fff" } : { color: C.gray600 }]}>
                {d >= 60 ? `${d / 60}h` : `${d}m`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label={t("amenity_booking_label_guests", "Guests")}
        value={guestCount}
        onChangeText={setGuestCount}
        placeholder="1"
        keyboardType="number-pad"
      />

      <Input
        label={t("amenity_booking_label_purpose", "Purpose (optional)")}
        value={purpose}
        onChangeText={setPurpose}
        placeholder={t("amenity_booking_placeholder_purpose", "e.g., Birthday party")}
        multiline
        numberOfLines={3}
      />


      {amenity?.depositAmount > 0 && (
        <View style={styles.depositNote}>
          <Text style={{ fontSize: 12, color: C.amber, fontWeight: "600" }}>
            💰 {t("amenity_booking_deposit_required", "Deposit Required:")} ₹{amenity.depositAmount}
          </Text>
        </View>
      )}

      {amenity?.requiresApproval && (
        <View style={styles.approvalNote}>
          <Text style={{ fontSize: 12, color: C.amber, fontWeight: "600" }}>
            ⏳ {t("amenity_booking_requires_admin_approval", "This booking requires admin approval")}
          </Text>
        </View>
      )}

      <Btn onPress={submit} loading={busy} style={{ width: "100%", marginTop: 16 }}>
        {t("amenity_booking_action_book_now", "Book Now")}
      </Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// REVIEW MODAL (admin confirm/reject)
// ═══════════════════════════════════════════════════════
const ReviewModal = ({ open, booking, action, onClose, onDone }) => {
  const { t } = useLanguage();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    try {
      const amenityId = resolveAmenityId(booking);
      const bookingId = booking._id;

      if (action === "confirm") {
        await amenitiesApi.confirmBooking(amenityId, bookingId, note.trim() || undefined);
        toast.success(t("amenity_review_confirmed", "Booking confirmed!"));
        onDone({ ...booking, status: "confirmed", adminNote: note });
      } else if (action === "reject") {
        await amenitiesApi.rejectBooking(amenityId, bookingId, note.trim() || undefined);
        toast.success(t("amenity_review_rejected", "Booking rejected!"));
        onDone({ ...booking, status: "rejected" });
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || t("amenity_review_failed", "Failed to update booking."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={action === "confirm" ? t("amenity_review_title_confirm", "Confirm Booking") : t("amenity_review_title_reject", "Reject Booking")}
    >
      <Text style={styles.modalMeta}>
        {booking?.amenity?.name || "Amenity"} · {booking?.bookedBy?.name}
      </Text>
      <Text style={styles.modalDateTime}>
        {booking && fmtDateTime(booking.startTime)}
      </Text>

      <Input
        label={t("amenity_review_label_note", "Admin Note (optional)")}
        value={note}
        onChangeText={setNote}
        placeholder={t("amenity_review_placeholder_note", "e.g., Approved. Please confirm your attendance.")}
        multiline
        numberOfLines={3}
      />

      <Btn
        onPress={submit}
        loading={busy}
        style={{
          width: "100%",
          backgroundColor: action === "confirm" ? C.green + "20" : C.red + "20",
        }}
      >
        <Text style={{ color: action === "confirm" ? C.green : C.red, fontWeight: "700" }}>
          {action === "confirm" ? `✓ ${t("amenity_action_confirm", "Confirm")}` : `✕ ${t("amenity_action_reject", "Reject")}`}
        </Text>
      </Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// CANCEL MODAL
// ═══════════════════════════════════════════════════════
const CancelModal = ({ open, booking, onClose, onCancelled }) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!reason.trim()) {
      return toast.error(t("amenity_cancel_error_reason", "Please provide a reason."));
    }                                                           // ← Fix 2: closed the if-block
    setBusy(true);
    try {
      const amenityId = resolveAmenityId(booking);
      const bookingId = booking._id;
      await amenitiesApi.cancelBooking(amenityId, bookingId, reason.trim()); // ← Fix 3: missing API call
      toast.success(t("amenity_cancelled", "Booking cancelled."));
      onCancelled({ ...booking, status: "cancelled", cancelReason: reason });
      setReason("");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || t("amenity_cancel_failed", "Cancellation failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("amenity_cancel_title", "Cancel Booking")}>
      <Text style={styles.modalMeta}>
        {booking?.amenity?.name || "Amenity"}
      </Text>
      <Text style={styles.modalDateTime}>
        {booking && fmtDateTime(booking.startTime)}
      </Text>

      <Input
        label={t("amenity_cancel_label_reason", "Cancellation Reason *")}
        value={reason}
        onChangeText={setReason}
        placeholder={t("amenity_cancel_placeholder_reason", "Why are you cancelling?")}
        multiline
        numberOfLines={3}
      />

      <Btn
        onPress={submit}
        loading={busy}
        style={{ width: "100%", backgroundColor: C.red + "20" }}
      >
        <Text style={{ color: C.red, fontWeight: "700" }}>{t("amenity_cancel_action", "Cancel Booking")}</Text>
      </Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════
export const AmenityScreen = () => {
  const { t } = useLanguage();
  const { isAdmin, dataVersion } = useAuth();
  const [view, setView] = useState("browse");
  const [bookTarget,    setBookTarget]    = useState(null);
  const [reviewTarget,  setReviewTarget]  = useState(null);
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [refreshKey,    setRefreshKey]    = useState(0);

  // TC-AMEN-11 & TC-AMEN-12 — form modal state
  const [showForm,    setShowForm]    = useState(false);
  const [formTarget,  setFormTarget]  = useState(null); // null = create, amenity = edit

  const tabs = [
    { id: "browse",      label: t("amenity_tab_browse", "Browse") },
    { id: "mybookings",  label: t("amenity_tab_my_bookings", "My Bookings") },
    ...(isAdmin ? [{ id: "allbookings", label: t("amenity_tab_all_bookings", "All Bookings") }] : []),
  ];

  const openCreate = () => { setFormTarget(null); setShowForm(true); };
  const openEdit   = (amenity) => { setFormTarget(amenity); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setFormTarget(null); };

  const handleAmenitySaved = (amenity) => {
    // BrowseTab re-mounts via refreshKey so the list stays fresh
    setRefreshKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
      {/* Header — TC-AMEN-11: "+ Add Amenity" button for admins */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>SOCIETY</Text>
          <Text style={styles.headerTitle}>🏊 {t("amenity_header_title", "Amenities")}</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ {t("amenity_action_add_amenity", "Add Amenity")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setView(t.id)}
            style={[styles.tabBtn, view === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, view === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {view === "browse" && (
        <BrowseTab
          key={refreshKey}
          onBook={setBookTarget}
          onDeactivate={() => setRefreshKey((k) => k + 1)}
          onEdit={openEdit}           // TC-AMEN-12
          isAdmin={isAdmin}
          dataVersion={dataVersion}
        />
      )}

      {(view === "mybookings" || view === "allbookings") && (
        <BookingsTab
          key={refreshKey}
          view={view}
          isAdmin={isAdmin}
          onCancel={setCancelTarget}
          onConfirm={(b) => setReviewTarget({ booking: b, action: "confirm" })}
          onReject={(b) => setReviewTarget({ booking: b, action: "reject" })}
          dataVersion={dataVersion}
        />
      )}

      {/* ── Modals ── */}
      <BookSlotModal
        open={!!bookTarget}
        amenity={bookTarget}
        onClose={() => setBookTarget(null)}
        onBooked={() => {
          setBookTarget(null);
          setView("mybookings");
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* TC-AMEN-11 & TC-AMEN-12 — shared create/edit modal */}
      <AmenityFormModal
        open={showForm}
        editing={formTarget}
        onClose={closeForm}
        onSaved={handleAmenitySaved}
      />

      <ReviewModal
        open={!!reviewTarget}
        booking={reviewTarget?.booking}
        action={reviewTarget?.action}
        onClose={() => setReviewTarget(null)}
        onDone={() => {
          setReviewTarget(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      <CancelModal
        open={!!cancelTarget}
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={() => {
          setCancelTarget(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {backgroundColor: C.navy, paddingHorizontal: 20,  paddingVertical: 14,  flexDirection: "row",  alignItems: "center",  justifyContent: "space-between",},
  headerSub:   { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },
  addBtn:      { backgroundColor: C.amber, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:  { fontSize: 12, fontWeight: "700", color: "#fff" },
  tabBar:      { flexDirection: "row", backgroundColor: C.navy, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  tabBtn:      { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabActive:   { borderBottomColor: C.teal },
  tabText:     { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.4)" },
  tabTextActive:{ color: "#fff" },
  label:       { fontSize: 13, fontWeight: "700", color: C.navy, marginBottom: 10, marginTop: 10 },
  filterPill:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100, flexDirection: "row", alignItems: "center", gap: 6 },
  filterBadge: { backgroundColor: C.teal + "20", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  durationOption:{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: C.gray200, backgroundColor: "#fff" },
  depositNote: { backgroundColor: C.amber + "15", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.amber + "30" },
  approvalNote:{ backgroundColor: C.amber + "15", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.amber + "30" },
  modalMeta:   { fontSize: 12, fontWeight: "700", color: C.navy, marginBottom: 4 },
  modalDateTime:{ fontSize: 11, color: C.gray500, marginBottom: 16 },
});