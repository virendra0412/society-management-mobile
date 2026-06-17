/**
 * screens/visitors/VisitorsScreen.jsx
 *
 * Visitor Management — all four flows:
 *   Flow A — Pre-approved Invite (resident creates OTP)
 *   Flow B — Walk-in (guard logs, resident approves/rejects)
 *   Flow C — Trusted / Frequent Visitors (maid, cook, driver — schedule-based auto-entry)
 *   Flow D — Delivery (walk-in with auto-exit badge)
 *
 * Screen has two tabs for residents:
 *   "Visitors"  — Flows A & B (single-visit records)
 *   "Trusted"   — Flow C (standing passes)
 *
 * Guards/admin see a single list + lookup panel for trusted visitors.
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Switch, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { visitorsApi as visitorApi } from "../../api/resources.api";
import { useAuth }  from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner,
} from "../../components/ui";
import {
  C, VISITOR_STATUS_COLOR, VISITOR_PURPOSE_ICON, VISIT_PURPOSES,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  invited:  "visitor_status_invited",
  pending:  "visitor_status_pending",
  approved: "visitor_status_inside",
  rejected: "visitor_status_rejected",
  exited:   "visitor_status_exited",
  expired:  "visitor_status_expired",
};

const TRUSTED_CATEGORIES = ["Maid","Cook","Driver","Security","Vendor","Delivery","Service","Other"];
const PASS_TYPES         = ["daily","monthly","permanent"];
const PASS_TYPE_LABELS   = { daily: "visitor_pass_today_only", monthly: "visitor_pass_30_days", permanent: "visitor_pass_permanent" };
const CATEGORY_ICON      = {
  Maid: "🧹", Cook: "🍳", Driver: "🚗", Security: "💂",
  Vendor: "🛒", Delivery: "📦", Service: "🔧", Other: "👤",
};

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ALL_DAYS   = [0,1,2,3,4,5,6];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const otpExpiryLabel = (expiresAt, t) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return { label: t("visitor_otp_expired", "OTP expired"), expired: true };
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 24) return { label: t("visitor_otp_valid_days", "OTP valid ~%dd", { count: Math.floor(hrs / 24), value: Math.floor(hrs / 24) }), expired: false };
  if (hrs >= 1)  return { label: t("visitor_otp_valid_hours", "OTP valid ~%dh %dm", { hrs, mins: mins % 60 }), expired: false };
  return { label: t("visitor_otp_valid_minutes", "OTP valid %dm", { mins }), expired: false };
};

const formatSchedule = (s, t) => {
  if (!s) return t("visitor_any_time", "Any time");
  const days = (s.days ?? ALL_DAYS).map((d) => DAYS_SHORT[d]).join(", ");
  const time = (s.fromTime === "00:00" && s.toTime === "23:59")
    ? t("visitor_any_time", "Any time")
    : `${s.fromTime}–${s.toTime}`;
  return `${days} · ${time}`;
};

const validUntilDays = (pass) => {
  if (pass.passType === "permanent" || !pass.validUntil) return null;
  const diff = new Date(pass.validUntil) - new Date();
  if (diff < 0) return null;
  return Math.ceil(diff / 86400000);
};

const validUntilLabel = (pass, t) => {
  if (pass.passType === "permanent") return t("visitor_pass_permanent", "Permanent pass");
  if (!pass.validUntil) return "—";
  const d  = new Date(pass.validUntil);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return t("visitor_pass_expired", "Expired");
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return t("visitor_pass_expires_today", "Expires today");
  if (days === 1) return t("visitor_pass_expires_tomorrow", "Expires tomorrow");
  return t("visitor_pass_expires_in_days", "Expires in %d days", { count: days, value: days });
};

// ─── PillSelect ───────────────────────────────────────────────────────────────
const PillSelect = ({ label, value, options, onSelect, labelMap }) => {
  const { t } = useLanguage();
  return (
    <View style={ps.wrap}>
      {label && <Text style={ps.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ps.row}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[ps.pill, value === opt && ps.pillActive]}
          >
            <Text style={[ps.pillText, value === opt && ps.pillTextActive]}>
              {labelMap ? t(labelMap[opt] || opt, opt) : opt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const ps = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 },
  row:           { flexDirection: "row", gap: 8 },
  pill:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100 },
  pillActive:    { backgroundColor: C.teal, borderColor: C.teal },
  pillText:      { fontSize: 13, fontWeight: "600", color: C.gray700 },
  pillTextActive:{ color: "#fff" },
});

// ─── DayPicker ────────────────────────────────────────────────────────────────
const DayPicker = ({ value = ALL_DAYS, onChange }) => {
  const { t } = useLanguage();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={ps.label}>{t("visitor_form_allowed_days_label", "Allowed Days")}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {ALL_DAYS.map((d) => {
          const active = value.includes(d);
          return (
            <TouchableOpacity
              key={d}
              onPress={() => {
                if (active && value.length === 1) return; // keep at least 1
                onChange(active ? value.filter((x) => x !== d) : [...value, d].sort());
              }}
              style={[ps.pill, active && ps.pillActive, { paddingHorizontal: 10 }]}
            >
              <Text style={[ps.pillText, active && ps.pillTextActive]}>{DAYS_SHORT[d]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── OTP Display Modal ────────────────────────────────────────────────────────
const OTPModal = ({ otp, visitor, onClose }) => {
  const { t } = useLanguage();
  // Try to load QR code component dynamically; fall back gracefully if not installed
  let QRCodeComp = null;
  try { QRCodeComp = require("react-native-qrcode-svg").default; } catch (e) { QRCodeComp = null; }

  const handleShare = async () => {
    const message = t("visitor_otp_share_message", "Entry OTP: %s\nVisitor: %s\nShow this at the gate to enter.", { otp, name: visitor?.name || "" });
    try { await Share.share({ message }); } catch (e) { /* ignore */ }
  };

  return (
    <Modal open={!!otp} onClose={onClose} title={t("visitor_otp_modal_title", "Share this OTP with your visitor")}>
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <Text style={{ fontSize: 13, color: C.gray500, textAlign: "center", lineHeight: 20, marginBottom: 16 }}>
          {t("visitor_otp_modal_lead", "Your visitor")} <Text style={{ fontWeight: "700", color: C.text }}>{visitor?.name}</Text> {t("visitor_otp_modal_need", "will need this OTP at the gate.")}{"\n"}
          {t("visitor_otp_modal_not_shown_prefix", "It will")} <Text style={{ fontWeight: "700", color: C.text }}>{t("visitor_otp_modal_not_shown_bold", "not")}</Text> {t("visitor_otp_modal_not_shown_suffix", "be shown again.")}
        </Text>
        <View style={{ backgroundColor: C.navy, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 20, marginBottom: 12, alignItems: "center" }}>
          <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 }}>{t("visitor_otp_label", "ENTRY OTP")}</Text>
          <Text style={{ fontSize: 38, fontWeight: "800", color: C.amber, letterSpacing: 10 }}>{otp}</Text>
        </View>
        {visitor?.expectedAt && (
          <Text style={{ fontSize: 12, color: C.gray500 }}>
            {t("visitor_otp_expected_label", "Expected:")} {new Date(visitor.expectedAt).toLocaleString()}
          </Text>
        )}

        {/* QR code + share actions. QR is optional — install react-native-qrcode-svg for image QR */}
        {QRCodeComp && (
          <View style={{ alignItems: "center", marginTop: 12, width: "100%" }}>
            <QRCodeComp value={String(otp)} size={140} />
            <Btn onPress={handleShare} style={{ marginTop: 12, width: "100%" }}>{t("visitor_action_share_otp", "Share OTP")}</Btn>
          </View>
        )}
        {!QRCodeComp && (
          <View style={{ marginTop: 12, width: "100%" }}>
            <Btn onPress={handleShare} style={{ width: "100%" }}>{t("visitor_action_share_otp", "Share OTP")}</Btn>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Visitor Card (Flows A, B, D) ────────────────────────────────────────────
const VisitorCard = ({ v, isAdmin, myFlat, onApprove, onReject, onVerifyOTP, onMarkExit, onCancelInvite, busy }) => {
  const { t } = useLanguage();
  const purposeIcon = VISITOR_PURPOSE_ICON[v.purpose] || "🚶";
  const isBusy      = busy === v._id;
  const sc          = VISITOR_STATUS_COLOR[v.status] || VISITOR_STATUS_COLOR.exited;
  const expiry      = v.status === "invited" ? otpExpiryLabel(v.entryOTPExpires, t) : null;
  const isDelivery  = v.purpose === "Delivery";

  // Admin can only approve/reject walk-ins for their own flat.
  // For other flats they can still verify OTP and mark exit (gate operations).
  const isOwnFlat   = !v.hostFlat || !myFlat || v.hostFlat === myFlat;
  const canApproveReject = !isAdmin || isOwnFlat;

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.teal + "15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{purposeIcon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }} numberOfLines={1}>{v.name}</Text>
            <Badge label={t(STATUS_LABELS[v.status] || v.status, v.status)} bg={sc.bg} text={sc.text} dot={sc.dot} />
          </View>
          <Text style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{v.purpose}{v.phone ? ` · 📞 ${v.phone}` : ""}</Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: C.gray50, borderRadius: 8, padding: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: C.gray500 }}>🏠 {t("visitor_flat_label", "Flat %s", { value: v.hostFlat || "—" })}</Text>
        {!!v.vehicleNumber && <Text style={{ fontSize: 11, color: C.gray500 }}>🚗 {v.vehicleNumber}</Text>}
        <Text style={{ fontSize: 11, color: v.isWalkIn ? C.amber : C.blue, fontWeight: "600" }}>
          {t(v.isWalkIn ? "visitor_type_walk_in" : "visitor_type_pre_invited", v.isWalkIn ? "Walk-in" : "Pre-invited")}
        </Text>
        {isDelivery && v.status === "approved" && (
          <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "600" }}>⏱ {t("visitor_auto_exit_on", "Auto-exit on")}</Text>
        )}
        {!!v.expectedAt && <Text style={{ fontSize: 11, color: C.gray500 }}>📅 {timeAgo(v.expectedAt)}</Text>}
        {!!v.entryTime  && <Text style={{ fontSize: 11, color: C.gray500 }}>🟢 In {timeAgo(v.entryTime)}</Text>}
        {!!v.exitTime   && <Text style={{ fontSize: 11, color: C.gray500 }}>🔴 Out {timeAgo(v.exitTime)}</Text>}
        <Text style={{ fontSize: 11, color: C.gray500 }}>🕐 {timeAgo(v.createdAt)}</Text>
      </View>

      {/* OTP expiry banner */}
      {expiry && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
          borderWidth: 1,
          backgroundColor: expiry.expired ? "#FEF2F2" : "#EFF6FF",
          borderColor:     expiry.expired ? "#FCA5A5" : "#BFDBFE",
        }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: expiry.expired ? "#991B1B" : "#1E40AF" }}>
            {expiry.expired ? "⏰" : "🔑"} {expiry.label}
          </Text>
        </View>
      )}

      {!!v.note && (
        <Text style={{ fontSize: 12, color: C.gray700, fontStyle: "italic", marginBottom: 10 }}>"{v.note}"</Text>
      )}

      {/* Resident actions */}
      {!isAdmin && v.status === "pending" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn small variant="primary" onPress={() => onApprove(v._id)} loading={isBusy} style={{ flex: 1 }}>✓ {t("visitor_action_approve", "Approve")}</Btn>
          <Btn small variant="danger"  onPress={() => onReject(v._id)}  loading={isBusy} style={{ flex: 1 }}>✕ {t("visitor_action_reject", "Reject")}</Btn>
        </View>
      )}
      {!isAdmin && v.status === "invited" && (
        <Btn small variant="ghost" onPress={() => onCancelInvite(v._id)} loading={isBusy}
          style={{ width: "100%", borderColor: "#FCA5A5" }}>
          ✕ {t("visitor_action_cancel_invite", "Cancel Invite")}
        </Btn>
      )}

      {/* Guard/admin actions */}
      {isAdmin && v.status === "invited" && (
        <Btn small onPress={() => onVerifyOTP(v)} loading={isBusy}
          style={{ width: "100%", backgroundColor: C.blue }}>
          🔑 {t("visitor_action_verify_otp_grant", "Verify OTP & Grant Entry")}
        </Btn>
      )}
      {isAdmin && v.status === "pending" && canApproveReject && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn small variant="primary" onPress={() => onApprove(v._id)} loading={isBusy} style={{ flex: 1 }}>✓ {t("visitor_action_approve_entry", "Approve Entry")}</Btn>
          <Btn small variant="danger"  onPress={() => onReject(v._id)}  loading={isBusy} style={{ flex: 1 }}>✕ {t("visitor_action_reject", "Reject")}</Btn>
        </View>
      )}
      {isAdmin && v.status === "pending" && !canApproveReject && (
        <View style={{ padding: 8, backgroundColor: C.gray50, borderRadius: 8 }}>
          <Text style={{ fontSize: 11, color: C.gray500, textAlign: "center" }}>
            {t("visitor_approval_waiting", "Awaiting approval from Flat %s resident", { value: v.hostFlat })}
          </Text>
        </View>
      )}
      {isAdmin && v.status === "approved" && (
        <Btn small variant="ghost" onPress={() => onMarkExit(v._id)} loading={isBusy} style={{ width: "100%" }}>
          🚪 {t("visitor_action_mark_exit", "Mark Exit")}
        </Btn>
      )}
    </Card>
  );
};

// ─── Trusted Pass Card (Flow C) ───────────────────────────────────────────────
const TrustedCard = ({ pass, isAdmin, onRevoke, onEntry, busy }) => {
  const { t } = useLanguage();
  const isBusy   = busy === pass._id;
  const icon     = CATEGORY_ICON[pass.category] || "👤";
  const isActive = !["expired","rejected"].includes(pass.status);
  const expLabel = validUntilLabel(pass, t);
  const expDays  = validUntilDays(pass);
  const expWarn  = expDays !== null && expDays <= 7;

  return (
    <Card style={{ marginBottom: 10, opacity: isActive ? 1 : 0.6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#7C3AED15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }} numberOfLines={1}>{pass.name}</Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
              backgroundColor: isActive ? "#EDE9FE" : "#F3F4F6",
            }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? "#7C3AED" : C.gray500 }}>
                {t(isActive ? "visitor_trusted_status_active" : "visitor_trusted_status_expired", isActive ? "Active" : "Expired")}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>
            {pass.category}{pass.phone ? ` · 📞 ${pass.phone}` : ""}
          </Text>
        </View>
      </View>

      {/* Schedule + validity */}
      <View style={{ backgroundColor: C.gray50, borderRadius: 8, padding: 8, marginBottom: 10, gap: 4 }}>
        <Text style={{ fontSize: 11, color: C.gray500 }}>📅 {formatSchedule(pass.accessSchedule, t)}</Text>
        <Text style={{ fontSize: 11, fontWeight: "600", color: expWarn ? C.amber : C.gray500 }}>
          {expWarn ? "⚠️ " : "🎫 "}{expLabel}
        </Text>
        {pass.entryCount > 0 && (
          <Text style={{ fontSize: 11, color: C.gray500 }}>🚪 {t("visitor_pass_entries_recorded", "%s entries recorded", { value: pass.entryCount })}</Text>
        )}
        {!!pass.hostFlat && isAdmin && (
          <Text style={{ fontSize: 11, color: C.gray500 }}>🏠 {t("visitor_flat_label", "Flat %s", { value: pass.hostFlat })}</Text>
        )}
      </View>

      {!!pass.note && (
        <Text style={{ fontSize: 12, color: C.gray700, fontStyle: "italic", marginBottom: 10 }}>"{pass.note}"</Text>
      )}

      {/* Actions */}
      {isAdmin && isActive && (
        <Btn small onPress={() => onEntry(pass._id)} loading={isBusy}
          style={{ width: "100%", backgroundColor: "#7C3AED" }}>
          ✓ {t("visitor_action_record_entry", "Record Entry")}
        </Btn>
      )}
      {!isAdmin && isActive && (
        <Btn small variant="ghost" onPress={() => onRevoke(pass._id)} loading={isBusy}
          style={{ width: "100%", borderColor: "#FCA5A5" }}>
          ✕ {t("visitor_action_revoke_pass", "Revoke Pass")}
        </Btn>
      )}
    </Card>
  );
};

// ─── Create Invite Modal (Flow A) ─────────────────────────────────────────────
const CreateInviteModal = ({ open, onClose, onCreated }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [form, setForm]       = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSub]  = useState(false);
  const reset = () => { setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" }); setErrors({}); setApiError(""); };
  const set = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); };

  const handleSubmit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = t("visitor_err_name_required", "Visitor name is required.");
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setApiError("");
    setSub(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      const res = await visitorApi.createInvite(payload);
      onCreated(res.data.visitor, res.data.otp);
      reset(); onClose();
    } catch (e) {
      setApiError(e.response?.data?.message || t("visitor_err_create_invite_failed", "Failed to create invite."));
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} onOpen={reset} apiError={apiError} title={t("visitor_invite_modal_title", "Invite a Visitor")}>
      <Input label={t("visitor_form_name_label", "Visitor Name *")}         value={form.name}          onChangeText={set("name")}          placeholder={t("visitor_form_name_ph_guest", "e.g. Amit Shah")} error={errors.name} />
      <Input label={t("visitor_form_phone_label", "Phone (optional)")}       value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label={t("visitor_form_purpose_label", "Purpose")}           value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label={t("visitor_form_vehicle_label", "Vehicle No. (optional)")} value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label={t("visitor_form_note_label", "Note (optional)")}        value={form.note}          onChangeText={set("note")}          placeholder={t("visitor_form_note_ph_invite", "Coming to help shift things")} multiline />
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>{t("visitor_invite_submit_btn", "Generate OTP & Invite")}</Btn>
    </Modal>
  );
};

// ─── Log Walk-in Modal (Flow B / D, guard) ────────────────────────────────────
const LogWalkInModal = ({ open, onClose, onLogged }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [form, setForm]       = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostFlat: "" });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSub]  = useState(false);
  const reset = () => { setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostFlat: "" }); setErrors({}); setApiError(""); };
  const set = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); };

  const handleSubmit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = t("visitor_err_name_required", "Visitor name is required.");
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setApiError("");
    setSub(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      if (!payload.hostFlat) delete payload.hostFlat;
      const res = await visitorApi.logWalkIn(payload);
      toast.success(t("visitor_walkin_logged_success", "Walk-in logged. Resident notified."));
      onLogged(res.data.visitor);
      reset(); onClose();
    } catch (e) {
      setApiError(e.response?.data?.message || t("visitor_err_log_walkin_failed", "Failed to log walk-in."));
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} onOpen={reset} apiError={apiError} title={t("visitor_walkin_modal_title", "Log Walk-in Visitor")}>
      <Input label={t("visitor_form_name_label", "Visitor Name *")}            value={form.name}          onChangeText={set("name")}          placeholder={t("visitor_form_name_ph_delivery", "e.g. Delivery Person")} error={errors.name} />
      <Input label={t("visitor_form_phone_label", "Phone (optional)")}          value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label={t("visitor_form_purpose_label", "Purpose")}              value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label={t("visitor_form_vehicle_label", "Vehicle No. (optional)")}    value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label={t("visitor_form_note_label", "Note (optional)")}           value={form.note}          onChangeText={set("note")}          placeholder={t("visitor_form_note_ph_walkin", "Any note for resident")} multiline />
      <Input label={t("visitor_form_host_flat_label", "Resident Flat (optional)")}  value={form.hostFlat}      onChangeText={set("hostFlat")}      placeholder="e.g. A-101" />
      <Text style={{ fontSize: 11, color: C.gray500, marginTop: -8, marginBottom: 14, lineHeight: 16 }}>
        {t("visitor_walkin_host_flat_hint", "Enter the flat number to notify the resident immediately.")}
      </Text>
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>{t("visitor_walkin_submit_btn", "Log Walk-in")}</Btn>
    </Modal>
  );
};

// ─── Verify OTP Modal (Flow A, guard) ────────────────────────────────────────
const VerifyOTPModal = ({ open, visitor, onClose, onVerified }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [otp, setOtp]         = useState("");
  const [otpError, setOtpError] = useState("");
  const [apiError, setApiError] = useState("");
  const [verifying, setVer]   = useState(false);
  useEffect(() => { if (open) { setOtp(""); setOtpError(""); setApiError(""); } }, [open]);

  const handleVerify = async () => {
    if (otp.length !== 6) { setOtpError(t("visitor_err_otp_6_digits", "Enter the 6-digit OTP.")); return; }
    setOtpError(""); setApiError("");
    setVer(true);
    try {
      const res = await visitorApi.verifyOTP(visitor._id, otp);
      toast.success(t("visitor_otp_verified_success", "OTP verified. Entry granted!"));
      onVerified(res.data.visitor); onClose();
    } catch (e) {
      setApiError(e.response?.data?.message || t("visitor_err_otp_invalid", "Invalid or expired OTP."));
    } finally { setVer(false); }
  };

  return (
    <Modal open={open} onClose={onClose} apiError={apiError} title={t("visitor_verify_otp_modal_title", "Verify Entry OTP")}>
      {visitor && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
            backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 28 }}>{VISITOR_PURPOSE_ICON[visitor.purpose] || "🚶"}</Text>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{visitor.name}</Text>
              <Text style={{ fontSize: 12, color: C.gray500 }}>{visitor.purpose} · {t("visitor_flat_label", "Flat %s", { value: visitor.hostFlat })}</Text>
            </View>
          </View>
          <Input
            label={t("visitor_otp_input_label", "6-digit OTP *")}
            value={otp}
            onChangeText={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpError(""); setApiError(""); }}
            placeholder={t("visitor_otp_input_ph", "Enter OTP from visitor")}
            keyboardType="numeric"
            error={otpError}
          />
          <Btn onPress={handleVerify} loading={verifying} style={{ width: "100%", backgroundColor: C.blue }}>
            ✓ {t("visitor_action_verify_grant", "Verify & Grant Entry")}
          </Btn>
        </View>
      )}
    </Modal>
  );
};

// ─── Register Trusted Visitor Modal (Flow C, resident) ────────────────────────
const RegisterTrustedModal = ({ open, onClose, onRegistered }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const INIT = {
    name: "", phone: "", vehicleNumber: "", category: "Maid",
    passType: "monthly", note: "",
    accessSchedule: { days: [1,2,3,4,5,6], fromTime: "07:00", toTime: "10:00" },
  };
  const [form, setForm]      = useState(INIT);
  const [submitting, setSub] = useState(false);
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setSchedule = (k) => (v) =>
    setForm((p) => ({ ...p, accessSchedule: { ...p.accessSchedule, [k]: v } }));

  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState("");
  const resetAll = () => { setErrors({}); setApiError(""); };

  const handleSubmit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = t("visitor_err_trusted_name_required", "Name is required.");
    if (!form.category)    e.category = t("visitor_err_trusted_category_required", "Category is required.");
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setApiError("");
    setSub(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      const res = await visitorApi.registerTrusted(payload);
      toast.success(t("visitor_trusted_registered_success", "Trusted visitor registered!"));
      onRegistered(res.data.visitor);
      setForm(INIT); onClose();
    } catch (e) {
      setApiError(e.response?.data?.message || t("visitor_err_trusted_register_failed", "Failed to register."));
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setForm(INIT); resetAll(); }} onOpen={resetAll} apiError={apiError} title={t("visitor_trusted_register_modal_title", "Register Trusted Visitor")}>
      <Input label={t("visitor_form_trusted_name_label", "Name *")}                value={form.name}          onChangeText={set("name")}          placeholder="e.g. Sunita Devi" error={errors.name} />
      <Input label={t("visitor_form_phone_label", "Phone (optional)")}      value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label={t("visitor_form_category_label", "Category *")}       value={form.category}      options={TRUSTED_CATEGORIES}         onSelect={set("category")} />
      <PillSelect label={t("visitor_form_pass_validity_label", "Pass Validity")}    value={form.passType}      options={PASS_TYPES}                 onSelect={set("passType")} labelMap={PASS_TYPE_LABELS} />
      <Input label={t("visitor_form_vehicle_label", "Vehicle No. (optional)")}value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />

      {/* Schedule */}
      <DayPicker value={form.accessSchedule.days} onChange={setSchedule("days")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t("visitor_form_from_time_label", "From Time")} value={form.accessSchedule.fromTime}
            onChangeText={setSchedule("fromTime")} placeholder="07:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t("visitor_form_to_time_label", "To Time")} value={form.accessSchedule.toTime}
            onChangeText={setSchedule("toTime")} placeholder="10:00" />
        </View>
      </View>
      <Text style={{ fontSize: 11, color: C.gray500, marginTop: -8, marginBottom: 14 }}>
        {t("visitor_trusted_schedule_hint", "Entry will be auto-approved within this time window. Use 00:00–23:59 for any time.")}
      </Text>

      <Input label={t("visitor_form_note_label", "Note (optional)")} value={form.note} onChangeText={set("note")} placeholder={t("visitor_form_note_ph_trusted", "e.g. Morning maid, has key")} multiline />
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%", backgroundColor: "#7C3AED" }}>
        {t("visitor_trusted_register_submit_btn", "Register Trusted Visitor")}
      </Btn>
    </Modal>
  );
};

// ─── Guard Lookup Modal (Flow C, guard) ───────────────────────────────────────
const TrustedLookupModal = ({ open, onClose, societyId, onEntryRecorded }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSrch]  = useState(false);
  const [busy, setBusy]       = useState(null);

  const [searchError, setSearchError] = useState("");
  const [entryError, setEntryError]   = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setSrch(true); setSearchError("");
    try {
      const isPhone = /^\d+$/.test(query.trim());
      const params  = isPhone ? { phone: query.trim() } : { name: query.trim() };
      const res     = await visitorApi.lookupTrusted(params);
      setResults(res.data.visitors || []);
      if ((res.data.visitors || []).length === 0) setSearchError(t("visitor_lookup_no_match", "No matching trusted visitor found."));
    } catch (e) {
      setSearchError(e.response?.data?.message || t("visitor_lookup_failed", "Lookup failed."));
    } finally { setSrch(false); }
  };

  const handleEntry = async (id) => {
    setBusy(id); setEntryError("");
    try {
      const res = await visitorApi.trustedEntry(id);
      toast.success(t("visitor_entry_recorded_success", "Entry recorded."));
      onEntryRecorded(res.data.visitor);
      setResults((p) => p.map((v) => v._id === id ? res.data.visitor : v));
    } catch (e) {
      setEntryError(e.response?.data?.message || t("visitor_entry_failed", "Entry failed."));
    } finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setQuery(""); setResults([]); setSearchError(""); setEntryError(""); }}
      apiError={searchError || entryError} title={t("visitor_lookup_modal_title", "Trusted Visitor Lookup")}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("visitor_lookup_input_label", "Phone or Name")}
            value={query}
            onChangeText={setQuery}
            placeholder={t("visitor_lookup_input_ph", "9876543210 or Sunita")}
          />
        </View>
        <View style={{ justifyContent: "flex-end", paddingBottom: 14 }}>
          <Btn small onPress={search} loading={searching} style={{ backgroundColor: "#7C3AED" }}>
            {t("visitor_lookup_search_btn", "Search")}
          </Btn>
        </View>
      </View>

      {results.map((pass) => (
        <View key={pass._id} style={{
          backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 8,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: 26 }}>{CATEGORY_ICON[pass.category] || "👤"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{pass.name}</Text>
            <Text style={{ fontSize: 12, color: C.gray500 }}>
              {pass.category} · {t("visitor_flat_label", "Flat %s", { value: pass.host?.flat || pass.hostFlat || "—" })}
            </Text>
            <Text style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
              {formatSchedule(pass.accessSchedule, t)}
            </Text>
          </View>
          <Btn small onPress={() => handleEntry(pass._id)} loading={busy === pass._id}
            style={{ backgroundColor: "#7C3AED" }}>
            ✓ {t("visitor_lookup_enter_btn", "Enter")}
          </Btn>
        </View>
      ))}

      {results.length === 0 && !searching && (
        <Text style={{ fontSize: 13, color: C.gray500, textAlign: "center", marginTop: 8 }}>
          {t("visitor_lookup_search_hint", "Search by phone number or name above.")}
        </Text>
      )}
    </Modal>
  );
};

// ─── Trusted Visitors Tab (resident) ─────────────────────────────────────────
const TrustedTab = ({ user }) => {
  const toast = useToast();
  const [passes, setPasses]        = useState([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [showRegister, setShowReg] = useState(false);
  const [busy, setBusy]            = useState(null);

  const fetchPasses = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await visitorApi.getMyTrusted({ activeOnly });
      setPasses(res.data.visitors || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load trusted visitors.");
    } finally { setLoading(false); }
  }, [activeOnly]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const handleRevoke = async (id) => {
    setBusy(id);
    try {
      await visitorApi.revokeTrusted(id);
      toast.success("Pass revoked.");
      fetchPasses();
    } catch (e) {
      toast.error(e.response?.data?.message || "Revoke failed.");
    } finally { setBusy(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.gray100 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 12, color: C.gray500 }}>Active only</Text>
          <Switch
            value={activeOnly}
            onValueChange={setActiveOnly}
            trackColor={{ true: "#7C3AED" }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity
          onPress={() => setShowReg(true)}
          style={{ backgroundColor: "#7C3AED", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>+ Register</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Spinner size={32} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPasses} />
      ) : passes.length === 0 ? (
        <EmptyState
          icon="🧹"
          message={activeOnly ? "No active trusted visitors. Register your maid, cook or driver." : "No trusted visitor records yet."}
        />
      ) : (
        <FlatList
          data={passes}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TrustedCard pass={item} isAdmin={false} onRevoke={handleRevoke} busy={busy} />
          )}
        />
      )}

      <RegisterTrustedModal
        open={showRegister}
        onClose={() => setShowReg(false)}
        onRegistered={(p) => { setPasses((prev) => [p, ...prev]); }}
      />
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const VisitorsScreen = () => {
  const { user, isAdmin, activeSocietyId, memberships, dataVersion } = useAuth(); // BUG-3
  const { t } = useLanguage();
  const activeMembership = memberships?.find(
    (m) => m.society?._id?.toString() === activeSocietyId || m.society?.toString() === activeSocietyId
  );
  const myFlat = activeMembership?.flat || user?.flat || null;
  const toast = useToast();

  // Residents see two tabs; guards see single list
  const [tab, setTab]              = useState("visitors"); // "visitors" | "trusted"
  const [visitors, setVisitors]    = useState([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState(null);
  const [statusFilter, setFilter]  = useState("all");

  const [showInvite, setShowInvite]   = useState(false);
  const [showWalkIn, setShowWalkIn]   = useState(false);
  const [showLookup, setShowLookup]   = useState(false);
  const [otpData,   setOtpData]       = useState(null);
  const [otpTarget, setOtpTarget]     = useState(null);
  const [busy, setBusy]               = useState(null);

  const FILTERS = isAdmin
    ? ["all","invited","pending","approved","rejected","exited"]
    : ["all","invited","pending","approved","exited"];

  const FILTER_LABELS = {
    all:"visitor_filter_all", invited:"visitor_status_invited", pending:"visitor_status_pending",
    approved:"visitor_status_inside", rejected:"visitor_status_rejected", exited:"visitor_status_exited",
  };

  const fetchVisitors = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { limit: 50, sort: "-createdAt" };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = isAdmin
        ? await visitorApi.getAll(params)
        : await visitorApi.getMyVisitors(params);
      setVisitors(res.data?.visitors || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load visitors.");
    } finally { setLoading(false); }
  }, [isAdmin, statusFilter]);

  useEffect(() => { fetchVisitors(); }, [fetchVisitors, dataVersion]); // BUG-3: re-fetch on resume

  const patchVisitor = (updated) =>
    setVisitors((p) => p.map((v) => v._id === updated._id ? updated : v));

  const handleApprove = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.approveWalkIn(id); patchVisitor(r.data.visitor); toast.success(t("visitor_approval_success", "Visitor entry approved.")); }
    catch (e) { toast.error(e.response?.data?.message || t("visitor_error_approval", "Approval failed.")); }
    finally { setBusy(null); }
  };

  const handleReject = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.rejectWalkIn(id); patchVisitor(r.data.visitor); toast.success(t("visitor_rejection_success", "Visitor rejected.")); }
    catch (e) { toast.error(e.response?.data?.message || t("visitor_error_rejection", "Rejection failed.")); }
    finally { setBusy(null); }
  };

  const handleMarkExit = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.markExit(id); patchVisitor(r.data.visitor); toast.success(t("visitor_exit_recorded", "Exit recorded.")); }
    catch (e) { toast.error(e.response?.data?.message || t("visitor_error_exit", "Failed to mark exit.")); }
    finally { setBusy(null); }
  };

  const handleCancelInvite = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.cancelInvite(id); patchVisitor(r.data.visitor); toast.success(t("visitor_invite_cancelled", "Invite cancelled.")); }
    catch (e) { toast.error(e.response?.data?.message || t("visitor_error_cancel_invite", "Failed to cancel invite.")); }
    finally { setBusy(null); }
  };

  const pendingCount = visitors.filter((v) => v.status === "pending").length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>{isAdmin ? t("visitor_header_security_desk", "Security Desk") : t("visitor_header_my_visitors", "My Visitors")}</Text>
          <Text style={s.headerTitle}>🚶 {t("visitor_header_management", "Visitor Management")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isAdmin && (
            <>
              <TouchableOpacity onPress={() => setShowLookup(true)} style={[s.actionBtn, { backgroundColor: "#7C3AED" }]}>
                <Text style={s.actionBtnText}>🔍 {t("visitor_action_trusted_lookup", "Trusted")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowWalkIn(true)} style={[s.actionBtn, { backgroundColor: C.amber }]}>
                <Text style={s.actionBtnText}>+ {t("visitor_action_walk_in", "Walk-in")}</Text>
              </TouchableOpacity>
            </>
          )}
          {!isAdmin && tab === "visitors" && (
            <TouchableOpacity onPress={() => setShowInvite(true)} style={[s.actionBtn, { backgroundColor: C.teal }]}>
              <Text style={s.actionBtnText}>+ {t("visitor_action_invite", "Invite")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Resident Tabs */}
      {!isAdmin && (
        <View style={s.tabRow}>
          <TouchableOpacity
            onPress={() => setTab("visitors")}
            style={[s.tab, tab === "visitors" && s.tabActive]}>
            <Text style={[s.tabText, tab === "visitors" && s.tabTextActive]}>{t("visitor_tab_visitors", "Visitors")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("trusted")}
            style={[s.tab, tab === "trusted" && s.tabActive]}>
            <Text style={[s.tabText, tab === "trusted" && s.tabTextActive]}>🧹 Trusted</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trusted tab for residents */}
      {!isAdmin && tab === "trusted" ? (
        <TrustedTab user={user} />
      ) : (
        <>
          {/* Pending alert */}
          {!isAdmin && pendingCount > 0 && (
            <View style={s.pendingAlert}>
              <Text style={s.pendingAlertText}>
                🔔 {t("visitor_pending_alert", "%d walk-in(s) awaiting your approval", { count: pendingCount, value: pendingCount })}
              </Text>
            </View>
          )}

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.filterRow}>
            {FILTERS.map((f) => (
              <FilterPill key={f} label={t(FILTER_LABELS[f], f)} active={statusFilter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>

          {/* Visitor list */}
          {loading ? (
            <View style={s.center}><Spinner size={32} /></View>
          ) : error ? (
            <ErrorState message={error} onRetry={fetchVisitors} />
          ) : visitors.length === 0 ? (
            <EmptyState
              icon="🚶"
              message={
                statusFilter === "all"
                  ? isAdmin ? t("visitor_empty_admin_all", "No visitor records yet.") : t("visitor_empty_resident_all", "No visitors yet. Invite someone!")
                  : t("visitor_empty_status", "No visitors found.")
              }
            />
          ) : (
            <FlatList
              data={visitors}
              keyExtractor={(v) => v._id}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <VisitorCard
                  v={item}
                  isAdmin={isAdmin}
                  myFlat={myFlat}
                  busy={busy}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onVerifyOTP={(visitor) => setOtpTarget(visitor)}
                  onMarkExit={handleMarkExit}
                  onCancelInvite={handleCancelInvite}
                />
              )}
            />
          )}
        </>
      )}

      {/* Modals */}
      <CreateInviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={(v, otp) => { setVisitors((p) => [v, ...p]); setOtpData({ otp, visitor: v }); }}
      />
      <LogWalkInModal
        open={showWalkIn}
        onClose={() => setShowWalkIn(false)}
        onLogged={(v) => setVisitors((p) => [v, ...p])}
      />
      <OTPModal
        otp={otpData?.otp}
        visitor={otpData?.visitor}
        onClose={() => setOtpData(null)}
      />
      <VerifyOTPModal
        open={!!otpTarget}
        visitor={otpTarget}
        onClose={() => setOtpTarget(null)}
        onVerified={patchVisitor}
      />
      <TrustedLookupModal
        open={showLookup}
        onClose={() => setShowLookup(false)}
        onEntryRecorded={() => {}}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerSub:       { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:     { fontSize: 20, fontWeight: "800", color: "#fff" },
  actionBtn:       { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnText:   { fontSize: 12, fontWeight: "700", color: "#fff" },
  tabRow:          { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.gray100, backgroundColor: "#fff" },
  tab:             { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive:       { borderBottomWidth: 2, borderBottomColor: C.teal },
  tabText:         { fontSize: 13, fontWeight: "600", color: C.gray500 },
  tabTextActive:   { color: C.teal },
  pendingAlert:    { marginHorizontal: 16, marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.amber + "25", borderWidth: 1, borderColor: C.amber + "50" },
  pendingAlertText:{ fontSize: 12, fontWeight: "700", color: C.amber },
  filterRow:       { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  list:            { paddingHorizontal: 16, paddingBottom: 24 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
});