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
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { visitorsApi as visitorApi } from "../../api/resources.api";
import { useAuth }  from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
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
  invited:  "Invited",
  pending:  "Pending",
  approved: "Inside",
  rejected: "Rejected",
  exited:   "Exited",
  expired:  "Expired",
};

const TRUSTED_CATEGORIES = ["Maid","Cook","Driver","Security","Vendor","Delivery","Service","Other"];
const PASS_TYPES         = ["daily","monthly","permanent"];
const PASS_TYPE_LABELS   = { daily: "Today only", monthly: "30 days", permanent: "Permanent" };
const CATEGORY_ICON      = {
  Maid: "🧹", Cook: "🍳", Driver: "🚗", Security: "💂",
  Vendor: "🛒", Delivery: "📦", Service: "🔧", Other: "👤",
};

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ALL_DAYS   = [0,1,2,3,4,5,6];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const otpExpiryLabel = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return { label: "OTP expired", expired: true };
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 24) return { label: `OTP valid ~${Math.floor(hrs/24)}d`, expired: false };
  if (hrs >= 1)  return { label: `OTP valid ~${hrs}h ${mins%60}m`, expired: false };
  return { label: `OTP valid ${mins}m`, expired: false };
};

const formatSchedule = (s) => {
  if (!s) return "Any time";
  const days = (s.days ?? ALL_DAYS).map((d) => DAYS_SHORT[d]).join(", ");
  const time = (s.fromTime === "00:00" && s.toTime === "23:59")
    ? "Any time"
    : `${s.fromTime}–${s.toTime}`;
  return `${days} · ${time}`;
};

const validUntilLabel = (pass) => {
  if (pass.passType === "permanent") return "Permanent pass";
  if (!pass.validUntil) return "—";
  const d  = new Date(pass.validUntil);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return "Expired";
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
};

// ─── PillSelect ───────────────────────────────────────────────────────────────
const PillSelect = ({ label, value, options, onSelect, labelMap }) => (
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
            {labelMap ? labelMap[opt] || opt : opt}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

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
const DayPicker = ({ value = ALL_DAYS, onChange }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={ps.label}>Allowed Days</Text>
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

// ─── OTP Display Modal ────────────────────────────────────────────────────────
const OTPModal = ({ otp, visitor, onClose }) => (
  <Modal open={!!otp} onClose={onClose} title="Share this OTP with your visitor">
    <View style={{ alignItems: "center", paddingVertical: 8 }}>
      <Text style={{ fontSize: 13, color: C.gray500, textAlign: "center", lineHeight: 20, marginBottom: 16 }}>
        Your visitor <Text style={{ fontWeight: "700", color: C.text }}>{visitor?.name}</Text> will need this OTP at the gate.{"\n"}
        It will <Text style={{ fontWeight: "700", color: C.text }}>not</Text> be shown again.
      </Text>
      <View style={{ backgroundColor: C.navy, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 20, marginBottom: 12, alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 }}>ENTRY OTP</Text>
        <Text style={{ fontSize: 38, fontWeight: "800", color: C.amber, letterSpacing: 10 }}>{otp}</Text>
      </View>
      {visitor?.expectedAt && (
        <Text style={{ fontSize: 12, color: C.gray500 }}>
          Expected: {new Date(visitor.expectedAt).toLocaleString()}
        </Text>
      )}
    </View>
  </Modal>
);

// ─── Visitor Card (Flows A, B, D) ────────────────────────────────────────────
const VisitorCard = ({ v, isAdmin, onApprove, onReject, onVerifyOTP, onMarkExit, onCancelInvite, busy }) => {
  const purposeIcon = VISITOR_PURPOSE_ICON[v.purpose] || "🚶";
  const isBusy      = busy === v._id;
  const sc          = VISITOR_STATUS_COLOR[v.status] || VISITOR_STATUS_COLOR.exited;
  const expiry      = v.status === "invited" ? otpExpiryLabel(v.entryOTPExpires) : null;
  const isDelivery  = v.purpose === "Delivery";

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.teal + "15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{purposeIcon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }} numberOfLines={1}>{v.name}</Text>
            <Badge label={STATUS_LABELS[v.status] || v.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
          </View>
          <Text style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{v.purpose}{v.phone ? ` · 📞 ${v.phone}` : ""}</Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: C.gray50, borderRadius: 8, padding: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: C.gray500 }}>🏠 Flat {v.hostFlat || "—"}</Text>
        {!!v.vehicleNumber && <Text style={{ fontSize: 11, color: C.gray500 }}>🚗 {v.vehicleNumber}</Text>}
        <Text style={{ fontSize: 11, color: v.isWalkIn ? C.amber : C.blue, fontWeight: "600" }}>
          {v.isWalkIn ? "Walk-in" : "Pre-invited"}
        </Text>
        {isDelivery && v.status === "approved" && (
          <Text style={{ fontSize: 11, color: "#7C3AED", fontWeight: "600" }}>⏱ Auto-exit on</Text>
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
          <Btn small variant="primary" onPress={() => onApprove(v._id)} loading={isBusy} style={{ flex: 1 }}>✓ Approve</Btn>
          <Btn small variant="danger"  onPress={() => onReject(v._id)}  loading={isBusy} style={{ flex: 1 }}>✕ Reject</Btn>
        </View>
      )}
      {!isAdmin && v.status === "invited" && (
        <Btn small variant="ghost" onPress={() => onCancelInvite(v._id)} loading={isBusy}
          style={{ width: "100%", borderColor: "#FCA5A5" }}>
          ✕ Cancel Invite
        </Btn>
      )}

      {/* Guard/admin actions */}
      {isAdmin && v.status === "invited" && (
        <Btn small onPress={() => onVerifyOTP(v)} loading={isBusy}
          style={{ width: "100%", backgroundColor: C.blue }}>
          🔑 Verify OTP & Grant Entry
        </Btn>
      )}
      {isAdmin && v.status === "pending" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn small variant="primary" onPress={() => onApprove(v._id)} loading={isBusy} style={{ flex: 1 }}>✓ Approve Entry</Btn>
          <Btn small variant="danger"  onPress={() => onReject(v._id)}  loading={isBusy} style={{ flex: 1 }}>✕ Reject</Btn>
        </View>
      )}
      {isAdmin && v.status === "approved" && (
        <Btn small variant="ghost" onPress={() => onMarkExit(v._id)} loading={isBusy} style={{ width: "100%" }}>
          🚪 Mark Exit
        </Btn>
      )}
    </Card>
  );
};

// ─── Trusted Pass Card (Flow C) ───────────────────────────────────────────────
const TrustedCard = ({ pass, isAdmin, onRevoke, onEntry, busy }) => {
  const isBusy   = busy === pass._id;
  const icon     = CATEGORY_ICON[pass.category] || "👤";
  const isActive = !["expired","rejected"].includes(pass.status);
  const expLabel = validUntilLabel(pass);
  const expWarn  = expLabel.startsWith("Expires in") && parseInt(expLabel) <= 7;

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
                {isActive ? "Active" : "Expired"}
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
        <Text style={{ fontSize: 11, color: C.gray500 }}>📅 {formatSchedule(pass.accessSchedule)}</Text>
        <Text style={{ fontSize: 11, fontWeight: "600", color: expWarn ? C.amber : C.gray500 }}>
          {expWarn ? "⚠️ " : "🎫 "}{expLabel}
        </Text>
        {pass.entryCount > 0 && (
          <Text style={{ fontSize: 11, color: C.gray500 }}>🚪 {pass.entryCount} entries recorded</Text>
        )}
        {!!pass.hostFlat && isAdmin && (
          <Text style={{ fontSize: 11, color: C.gray500 }}>🏠 Flat {pass.hostFlat}</Text>
        )}
      </View>

      {!!pass.note && (
        <Text style={{ fontSize: 12, color: C.gray700, fontStyle: "italic", marginBottom: 10 }}>"{pass.note}"</Text>
      )}

      {/* Actions */}
      {isAdmin && isActive && (
        <Btn small onPress={() => onEntry(pass._id)} loading={isBusy}
          style={{ width: "100%", backgroundColor: "#7C3AED" }}>
          ✓ Record Entry
        </Btn>
      )}
      {!isAdmin && isActive && (
        <Btn small variant="ghost" onPress={() => onRevoke(pass._id)} loading={isBusy}
          style={{ width: "100%", borderColor: "#FCA5A5" }}>
          ✕ Revoke Pass
        </Btn>
      )}
    </Card>
  );
};

// ─── Create Invite Modal (Flow A) ─────────────────────────────────────────────
const CreateInviteModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm]       = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" });
  const [submitting, setSub]  = useState(false);
  const reset = () => setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Visitor name is required.");
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
      toast.error(e.response?.data?.message || "Failed to create invite.");
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Invite a Visitor">
      <Input label="Visitor Name *"         value={form.name}          onChangeText={set("name")}          placeholder="e.g. Amit Shah" />
      <Input label="Phone (optional)"       value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label="Purpose"           value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label="Vehicle No. (optional)" value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label="Note (optional)"        value={form.note}          onChangeText={set("note")}          placeholder="Coming to help shift things" multiline />
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>Generate OTP & Invite</Btn>
    </Modal>
  );
};

// ─── Log Walk-in Modal (Flow B / D, guard) ────────────────────────────────────
const LogWalkInModal = ({ open, onClose, onLogged }) => {
  const toast = useToast();
  const [form, setForm]       = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostFlat: "" });
  const [submitting, setSub]  = useState(false);
  const reset = () => setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostFlat: "" });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Visitor name is required.");
    setSub(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      if (!payload.hostFlat) delete payload.hostFlat;
      const res = await visitorApi.logWalkIn(payload);
      toast.success("Walk-in logged. Resident notified.");
      onLogged(res.data.visitor);
      reset(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to log walk-in.");
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Log Walk-in Visitor">
      <Input label="Visitor Name *"            value={form.name}          onChangeText={set("name")}          placeholder="e.g. Delivery Person" />
      <Input label="Phone (optional)"          value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label="Purpose"              value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label="Vehicle No. (optional)"    value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label="Note (optional)"           value={form.note}          onChangeText={set("note")}          placeholder="Any note for resident" multiline />
      <Input label="Resident Flat (optional)"  value={form.hostFlat}      onChangeText={set("hostFlat")}      placeholder="e.g. A-101" />
      <Text style={{ fontSize: 11, color: C.gray500, marginTop: -8, marginBottom: 14, lineHeight: 16 }}>
        Enter the flat number to notify the resident immediately.
      </Text>
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>Log Walk-in</Btn>
    </Modal>
  );
};

// ─── Verify OTP Modal (Flow A, guard) ────────────────────────────────────────
const VerifyOTPModal = ({ open, visitor, onClose, onVerified }) => {
  const toast = useToast();
  const [otp, setOtp]       = useState("");
  const [verifying, setVer] = useState(false);
  useEffect(() => { if (open) setOtp(""); }, [open]);

  const handleVerify = async () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit OTP.");
    setVer(true);
    try {
      const res = await visitorApi.verifyOTP(visitor._id, otp);
      toast.success("OTP verified. Entry granted!");
      onVerified(res.data.visitor); onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Invalid or expired OTP.");
    } finally { setVer(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Verify Entry OTP">
      {visitor && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
            backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 28 }}>{VISITOR_PURPOSE_ICON[visitor.purpose] || "🚶"}</Text>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{visitor.name}</Text>
              <Text style={{ fontSize: 12, color: C.gray500 }}>{visitor.purpose} · Flat {visitor.hostFlat}</Text>
            </View>
          </View>
          <Input
            label="6-digit OTP *"
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter OTP from visitor"
            keyboardType="numeric"
          />
          <Btn onPress={handleVerify} loading={verifying} style={{ width: "100%", backgroundColor: C.blue }}>
            ✓ Verify & Grant Entry
          </Btn>
        </View>
      )}
    </Modal>
  );
};

// ─── Register Trusted Visitor Modal (Flow C, resident) ────────────────────────
const RegisterTrustedModal = ({ open, onClose, onRegistered }) => {
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

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.category)    return toast.error("Category is required.");
    setSub(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      const res = await visitorApi.registerTrusted(payload);
      toast.success("Trusted visitor registered!");
      onRegistered(res.data.visitor);
      setForm(INIT); onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to register.");
    } finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setForm(INIT); }} title="Register Trusted Visitor">
      <Input label="Name *"                value={form.name}          onChangeText={set("name")}          placeholder="e.g. Sunita Devi" />
      <Input label="Phone (optional)"      value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label="Category *"       value={form.category}      options={TRUSTED_CATEGORIES}         onSelect={set("category")} />
      <PillSelect label="Pass Validity"    value={form.passType}      options={PASS_TYPES}                 onSelect={set("passType")} labelMap={PASS_TYPE_LABELS} />
      <Input label="Vehicle No. (optional)"value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />

      {/* Schedule */}
      <DayPicker value={form.accessSchedule.days} onChange={setSchedule("days")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="From Time" value={form.accessSchedule.fromTime}
            onChangeText={setSchedule("fromTime")} placeholder="07:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="To Time" value={form.accessSchedule.toTime}
            onChangeText={setSchedule("toTime")} placeholder="10:00" />
        </View>
      </View>
      <Text style={{ fontSize: 11, color: C.gray500, marginTop: -8, marginBottom: 14 }}>
        Entry will be auto-approved within this time window. Use 00:00–23:59 for any time.
      </Text>

      <Input label="Note (optional)" value={form.note} onChangeText={set("note")} placeholder="e.g. Morning maid, has key" multiline />
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%", backgroundColor: "#7C3AED" }}>
        Register Trusted Visitor
      </Btn>
    </Modal>
  );
};

// ─── Guard Lookup Modal (Flow C, guard) ───────────────────────────────────────
const TrustedLookupModal = ({ open, onClose, societyId, onEntryRecorded }) => {
  const toast = useToast();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSrch]  = useState(false);
  const [busy, setBusy]       = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setSrch(true);
    try {
      const isPhone = /^\d+$/.test(query.trim());
      const params  = isPhone ? { phone: query.trim() } : { name: query.trim() };
      const res     = await visitorApi.lookupTrusted(params);
      setResults(res.data.visitors || []);
      if ((res.data.visitors || []).length === 0) toast.error("No matching trusted visitor found.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Lookup failed.");
    } finally { setSrch(false); }
  };

  const handleEntry = async (id) => {
    setBusy(id);
    try {
      const res = await visitorApi.trustedEntry(id);
      toast.success("Entry recorded.");
      onEntryRecorded(res.data.visitor);
      setResults((p) => p.map((v) => v._id === id ? res.data.visitor : v));
    } catch (e) {
      toast.error(e.response?.data?.message || "Entry failed.");
    } finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setQuery(""); setResults([]); }} title="Trusted Visitor Lookup">
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Phone or Name"
            value={query}
            onChangeText={setQuery}
            placeholder="9876543210 or Sunita"
          />
        </View>
        <View style={{ justifyContent: "flex-end", paddingBottom: 14 }}>
          <Btn small onPress={search} loading={searching} style={{ backgroundColor: "#7C3AED" }}>
            Search
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
              {pass.category} · Flat {pass.host?.flat || pass.hostFlat || "—"}
            </Text>
            <Text style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
              {formatSchedule(pass.accessSchedule)}
            </Text>
          </View>
          <Btn small onPress={() => handleEntry(pass._id)} loading={busy === pass._id}
            style={{ backgroundColor: "#7C3AED" }}>
            ✓ Enter
          </Btn>
        </View>
      ))}

      {results.length === 0 && !searching && (
        <Text style={{ fontSize: 13, color: C.gray500, textAlign: "center", marginTop: 8 }}>
          Search by phone number or name above.
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
  const { user, isAdmin } = useAuth();
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
    all:"All", invited:"Invited", pending:"Pending",
    approved:"Inside", rejected:"Rejected", exited:"Exited",
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

  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);

  const patchVisitor = (updated) =>
    setVisitors((p) => p.map((v) => v._id === updated._id ? updated : v));

  const handleApprove = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.approveWalkIn(id); patchVisitor(r.data.visitor); toast.success("Visitor entry approved."); }
    catch (e) { toast.error(e.response?.data?.message || "Approval failed."); }
    finally { setBusy(null); }
  };

  const handleReject = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.rejectWalkIn(id); patchVisitor(r.data.visitor); toast.success("Visitor rejected."); }
    catch (e) { toast.error(e.response?.data?.message || "Rejection failed."); }
    finally { setBusy(null); }
  };

  const handleMarkExit = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.markExit(id); patchVisitor(r.data.visitor); toast.success("Exit recorded."); }
    catch (e) { toast.error(e.response?.data?.message || "Failed to mark exit."); }
    finally { setBusy(null); }
  };

  const handleCancelInvite = async (id) => {
    setBusy(id);
    try { const r = await visitorApi.cancelInvite(id); patchVisitor(r.data.visitor); toast.success("Invite cancelled."); }
    catch (e) { toast.error(e.response?.data?.message || "Failed to cancel invite."); }
    finally { setBusy(null); }
  };

  const pendingCount = visitors.filter((v) => v.status === "pending").length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>{isAdmin ? "Security Desk" : "My Visitors"}</Text>
          <Text style={s.headerTitle}>🚶 Visitor Management</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isAdmin && (
            <>
              <TouchableOpacity onPress={() => setShowLookup(true)} style={[s.actionBtn, { backgroundColor: "#7C3AED" }]}>
                <Text style={s.actionBtnText}>🔍 Trusted</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowWalkIn(true)} style={[s.actionBtn, { backgroundColor: C.amber }]}>
                <Text style={s.actionBtnText}>+ Walk-in</Text>
              </TouchableOpacity>
            </>
          )}
          {!isAdmin && tab === "visitors" && (
            <TouchableOpacity onPress={() => setShowInvite(true)} style={[s.actionBtn, { backgroundColor: C.teal }]}>
              <Text style={s.actionBtnText}>+ Invite</Text>
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
            <Text style={[s.tabText, tab === "visitors" && s.tabTextActive]}>Visitors</Text>
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
                🔔 {pendingCount} walk-in{pendingCount > 1 ? "s" : ""} awaiting your approval
              </Text>
            </View>
          )}

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.filterRow}>
            {FILTERS.map((f) => (
              <FilterPill key={f} label={FILTER_LABELS[f]} active={statusFilter === f} onPress={() => setFilter(f)} />
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
                  ? isAdmin ? "No visitor records yet." : "No visitors yet. Invite someone!"
                  : `No ${FILTER_LABELS[statusFilter].toLowerCase()} visitors.`
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