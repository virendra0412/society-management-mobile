/**
 * screens/visitors/VisitorsScreen.jsx
 *
 * Full conversion from web VisitorScreen.jsx → React Native (Expo).
 * Features:
 *   • Pre-invite visitors with OTP (resident)
 *   • Walk-in logging by security/admin
 *   • Approve / reject pending walk-ins
 *   • OTP verify & grant entry (admin)
 *   • Mark exit (admin)
 *   • Cancel invite (resident)
 *   • OTP expiry countdown
 *   • Status filter pills
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { visitorsApi as visitorApi }  from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner,
} from "../../components/ui";
import {
  C, VISITOR_STATUS_COLOR, VISITOR_PURPOSE_ICON, VISIT_PURPOSES,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  invited:  "Invited",
  pending:  "Pending",
  approved: "Inside",
  rejected: "Rejected",
  exited:   "Exited",
  expired:  "Expired",
};

const otpExpiryLabel = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return { label: "OTP expired", expired: true };
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs >= 24) return { label: `OTP valid ~${Math.floor(hrs / 24)}d`, expired: false };
  if (hrs >= 1)  return { label: `OTP valid ~${hrs}h ${mins % 60}m`, expired: false };
  return { label: `OTP valid ${mins}m`, expired: false };
};

// ─── PillSelect — replaces web <Select> ──────────────────────────────────────
const PillSelect = ({ label, value, options, onSelect }) => (
  <View style={ps.wrap}>
    {label && <Text style={ps.label}>{label}</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ps.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onSelect(opt)}
          style={[ps.pill, value === opt && ps.pillActive]}
        >
          <Text style={[ps.pillText, value === opt && ps.pillTextActive]}>{opt}</Text>
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

// ─── Visitor Card ─────────────────────────────────────────────────────────────
const VisitorCard = ({ v, isAdmin, onApprove, onReject, onVerifyOTP, onMarkExit, onCancelInvite, busy }) => {
  const purposeIcon = VISITOR_PURPOSE_ICON[v.purpose] || "🚶";
  const isBusy      = busy === v._id;
  const sc          = VISITOR_STATUS_COLOR[v.status] || VISITOR_STATUS_COLOR.exited;
  const expiry      = v.status === "invited" ? otpExpiryLabel(v.entryOTPExpires) : null;

  return (
    <Card style={{ marginBottom: 10 }}>
      {/* Header */}
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

      {/* Meta */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: C.gray50, borderRadius: 8, padding: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: C.gray500 }}>🏠 Flat {v.hostFlat || "—"}</Text>
        {!!v.vehicleNumber && <Text style={{ fontSize: 11, color: C.gray500 }}>🚗 {v.vehicleNumber}</Text>}
        <Text style={{ fontSize: 11, color: v.isWalkIn ? C.amber : C.blue, fontWeight: "600" }}>
          {v.isWalkIn ? "Walk-in" : "Pre-invited"}
        </Text>
        {!!v.expectedAt && <Text style={{ fontSize: 11, color: C.gray500 }}>📅 {timeAgo(v.expectedAt)}</Text>}
        {!!v.entryTime  && <Text style={{ fontSize: 11, color: C.gray500 }}>🟢 {timeAgo(v.entryTime)}</Text>}
        {!!v.exitTime   && <Text style={{ fontSize: 11, color: C.gray500 }}>🔴 {timeAgo(v.exitTime)}</Text>}
        <Text style={{ fontSize: 11, color: C.gray500 }}>🕐 {timeAgo(v.createdAt)}</Text>
      </View>

      {/* OTP expiry banner */}
      {expiry && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
          borderWidth: 1,
          backgroundColor: expiry.expired ? "#FEF2F2" : "#EFF6FF",
          borderColor: expiry.expired ? "#FCA5A5" : "#BFDBFE",
        }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: expiry.expired ? "#991B1B" : "#1E40AF" }}>
            {expiry.expired ? "⏰" : "🔑"} {expiry.label}
          </Text>
        </View>
      )}

      {!!v.note && (
        <Text style={{ fontSize: 12, color: C.gray700, fontStyle: "italic", marginBottom: 10 }}>"{v.note}"</Text>
      )}

      {/* Actions */}
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

// ─── Create Invite Modal ──────────────────────────────────────────────────────
const CreateInviteModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const reset = () => setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "" });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Visitor name is required.");
    setSubmitting(true);
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
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Invite a Visitor">
      <Input label="Visitor Name *"         value={form.name}          onChangeText={set("name")}          placeholder="e.g. Amit Shah" />
      <Input label="Phone (optional)"       value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label="Purpose"           value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label="Vehicle No. (optional)" value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label="Note (optional)"        value={form.note}          onChangeText={set("note")}          placeholder="Coming to help with shift" multiline />
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>Generate OTP & Invite</Btn>
    </Modal>
  );
};

// ─── Log Walk-in Modal (Admin) ────────────────────────────────────────────────
const LogWalkInModal = ({ open, onClose, onLogged }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostId: "" });
  const [submitting, setSubmitting] = useState(false);
  const reset = () => setForm({ name: "", phone: "", purpose: "Guest", vehicleNumber: "", note: "", hostId: "" });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim())   return toast.error("Visitor name is required.");
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      if (!payload.vehicleNumber) delete payload.vehicleNumber;
      if (!payload.note) delete payload.note;
      if (!payload.hostId) delete payload.hostId;   // optional — omit if blank
      const res = await visitorApi.logWalkIn(payload);
      toast.success("Walk-in logged. Resident notified.");
      onLogged(res.data.visitor);
      reset(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to log walk-in.");
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Log Walk-in Visitor">
      <Input label="Visitor Name *"         value={form.name}          onChangeText={set("name")}          placeholder="e.g. Delivery Person" />
      <Input label="Phone (optional)"       value={form.phone}         onChangeText={set("phone")}         placeholder="9876543210" keyboardType="phone-pad" />
      <PillSelect label="Purpose"           value={form.purpose}       options={VISIT_PURPOSES}             onSelect={set("purpose")} />
      <Input label="Vehicle No. (optional)" value={form.vehicleNumber} onChangeText={set("vehicleNumber")} placeholder="GJ01AB1234" />
      <Input label="Note (optional)"        value={form.note}          onChangeText={set("note")}          placeholder="Any note for resident" multiline />
      <Input label="Resident Flat / ID (optional)"  value={form.hostId}        onChangeText={set("hostId")}        placeholder="e.g. A-101 resident ID (leave blank if unknown)" />
      <Text style={{ fontSize: 11, color: C.gray500, marginTop: -8, marginBottom: 14, lineHeight: 16 }}>
        ℹ️ Find the resident's ID from the admin panel or ask them to share it.
      </Text>
      <Btn onPress={handleSubmit} loading={submitting} style={{ width: "100%" }}>Log Walk-in</Btn>
    </Modal>
  );
};

// ─── Verify OTP Modal (Admin) ─────────────────────────────────────────────────
const VerifyOTPModal = ({ open, visitor, onClose, onVerified }) => {
  const toast = useToast();
  const [otp, setOtp]           = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { if (open) setOtp(""); }, [open]);

  const handleVerify = async () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit OTP.");
    setVerifying(true);
    try {
      const res = await visitorApi.verifyOTP(visitor._id, otp);
      toast.success("OTP verified. Entry granted!");
      onVerified(res.data.visitor);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Invalid or expired OTP.");
    } finally { setVerifying(false); }
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const VisitorsScreen = ({ navigation }) => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [visitors,     setVisitors]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [showInvite, setShowInvite] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [otpData,    setOtpData]    = useState(null);
  const [otpTarget,  setOtpTarget]  = useState(null);
  const [busy,       setBusy]       = useState(null);

  const FILTERS = isAdmin
    ? ["all", "invited", "pending", "approved", "rejected", "exited"]
    : ["all", "invited", "pending", "approved", "exited"];

  const FILTER_LABELS = {
    all: "All", invited: "Invited", pending: "Pending",
    approved: "Inside", rejected: "Rejected", exited: "Exited",
  };

  const fetchVisitors = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { limit: 50, sort: "-createdAt" };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = isAdmin ? await visitorApi.getAll(params) : await visitorApi.getMyVisitors(params);
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
    try { const res = await visitorApi.approveWalkIn(id); patchVisitor(res.data.visitor); toast.success("Visitor entry approved."); }
    catch (e) { toast.error(e.response?.data?.message || "Approval failed."); }
    finally { setBusy(null); }
  };

  const handleReject = async (id) => {
    setBusy(id);
    try { const res = await visitorApi.rejectWalkIn(id); patchVisitor(res.data.visitor); toast.success("Visitor rejected."); }
    catch (e) { toast.error(e.response?.data?.message || "Rejection failed."); }
    finally { setBusy(null); }
  };

  const handleMarkExit = async (id) => {
    setBusy(id);
    try { const res = await visitorApi.markExit(id); patchVisitor(res.data.visitor); toast.success("Visitor exit recorded."); }
    catch (e) { toast.error(e.response?.data?.message || "Failed to mark exit."); }
    finally { setBusy(null); }
  };

  const handleCancelInvite = async (id) => {
    setBusy(id);
    try { const res = await visitorApi.cancelInvite(id); patchVisitor(res.data.visitor); toast.success("Invite cancelled."); }
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
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowWalkIn(true)} style={[s.actionBtn, { backgroundColor: C.amber }]}>
            <Text style={s.actionBtnText}>+ Walk-in</Text>
          </TouchableOpacity>
        )}
        {!isAdmin && (
          <TouchableOpacity onPress={() => setShowInvite(true)} style={[s.actionBtn, { backgroundColor: C.teal }]}>
            <Text style={s.actionBtnText}>+ Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pending alert */}
      {!isAdmin && pendingCount > 0 && (
        <View style={s.pendingAlert}>
          <Text style={s.pendingAlertText}>
            🔔 {pendingCount} walk-in{pendingCount > 1 ? "s" : ""} awaiting your approval
          </Text>
        </View>
      )}

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.filterRow}>
        {FILTERS.map((f) => (
          <FilterPill key={f} label={FILTER_LABELS[f]} active={statusFilter === f} onPress={() => setStatusFilter(f)} />
        ))}
      </ScrollView>

      {/* List */}
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

      {/* Modals */}
      <CreateInviteModal open={showInvite} onClose={() => setShowInvite(false)} onCreated={(v, otp) => { setVisitors((p) => [v, ...p]); setOtpData({ otp, visitor: v }); }} />
      <LogWalkInModal   open={showWalkIn} onClose={() => setShowWalkIn(false)} onLogged={(v) => setVisitors((p) => [v, ...p])} />
      <OTPModal         otp={otpData?.otp} visitor={otpData?.visitor} onClose={() => setOtpData(null)} />
      <VerifyOTPModal   open={!!otpTarget} visitor={otpTarget} onClose={() => setOtpTarget(null)} onVerified={patchVisitor} />
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
  pendingAlert:    { marginHorizontal: 16, marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.amber + "25", borderWidth: 1, borderColor: C.amber + "50" },
  pendingAlertText:{ fontSize: 12, fontWeight: "700", color: C.amber },
  filterRow:       { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  list:            { paddingHorizontal: 16, paddingBottom: 24 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
});