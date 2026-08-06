/**
 * screens/maintenance/VerificationQueueScreen.jsx
 *
 * Admin-only screen: review submitted payment proofs and verify or reject them.
 *
 * Each card shows:
 *   - Flat / wing
 *   - Bill title + amount
 *   - Method claimed (bank transfer / UPI / cash / cheque)
 *   - UTR / reference number
 *   - Submitted X mins ago
 *   - [Reject]  [Verify ✓]
 *
 * Admin workflow:
 *   1. Opens Pending tab (badge count on MaintenanceScreen)
 *   2. Taps a card → sees UTR
 *   3. Checks their bank app / net banking in parallel
 *   4. Returns → taps Verify or Reject
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { maintenanceApi } from "../../api/resources.api";
import { useToast }       from "../../context/ToastContext";
import {
  Card, Spinner, EmptyState, ScreenHeader,
} from "../../components/ui";
import { C } from "../../constants/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n !== undefined && n !== null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const timeAgo = (d) => {
  if (!d) return "";
  const mins  = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs   = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const METHOD_LABELS = {
  cash:          "Cash 💵",
  bank_transfer: "Bank Transfer 🏦",
  upi_qr:        "UPI QR 📱",
  cheque:        "Cheque 📝",
};

const REF_LABELS = {
  cash:          "Reference",
  bank_transfer: "UTR Number",
  upi_qr:        "UPI Reference",
  cheque:        "Cheque No.",
};

// ─── Queue Item Card ──────────────────────────────────────────────────────────

const QueueCard = ({ item, onVerify, onReject }) => {
  const payment = item.payment || {};
  const method  = payment.submittedMethod;

  return (
    <Card style={S.card}>
      {/* Header row */}
      <View style={S.cardHeader}>
        <View>
          <Text style={S.flatText}>
            {payment.wing ? `${payment.wing} · ` : ""}Flat {payment.flat}
          </Text>
          {item.resident?.name && (
            <Text style={S.residentName}>{item.resident.name}</Text>
          )}
        </View>
        <View style={S.timeChip}>
          <Text style={S.timeText}>{timeAgo(payment.submittedAt)}</Text>
        </View>
      </View>

      {/* Bill info */}
      <Text style={S.billTitle} numberOfLines={1}>{item.title}</Text>

      {/* Amounts */}
      <View style={S.amountRow}>
        <View style={S.amountBlock}>
          <Text style={S.amountLabel}>Due</Text>
          <Text style={S.amountValue}>{fmt(payment.totalDue ?? payment.amount)}</Text>
        </View>
        <View style={S.amountBlock}>
          <Text style={S.amountLabel}>Submitted</Text>
          <Text style={[S.amountValue, { color: C.teal }]}>{fmt(payment.submittedAmount)}</Text>
        </View>
        <View style={S.amountBlock}>
          <Text style={S.amountLabel}>Method</Text>
          <Text style={S.amountValue}>{METHOD_LABELS[method] || method}</Text>
        </View>
      </View>

      {/* UTR / Reference */}
      {payment.utrNumber && (
        <View style={S.utrBox}>
          <Text style={S.utrLabel}>{REF_LABELS[method] || "Reference"}</Text>
          <Text style={S.utrValue}>{payment.utrNumber}</Text>
        </View>
      )}

      {/* Resident note */}
      {payment.proofNote ? (
        <Text style={S.note}>"{payment.proofNote}"</Text>
      ) : null}

      {/* Actions */}
      <View style={S.actions}>
        <TouchableOpacity
          style={S.rejectBtn}
          onPress={() => onReject(item)}
          activeOpacity={0.7}
        >
          <Text style={S.rejectBtnText}>Reject ✗</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={S.verifyBtn}
          onPress={() => onVerify(item)}
          activeOpacity={0.7}
        >
          <Text style={S.verifyBtnText}>Verify ✓</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VerificationQueueScreen({ navigation }) {
  const toast = useToast();

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting,    setRejecting]    = useState(false);

  // Verify
  const [verifying, setVerifying] = useState(null); // paymentId being verified

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const { pending } = await maintenanceApi.getPendingVerifications();
      setItems(pending || []);
    } catch (e) {
      toast.error("Could not load pending verifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Verify ───────────────────────────────────────────────────────────────────

  const handleVerify = (item) => {
    const payment = item.payment;
    Alert.alert(
      "Confirm Verification",
      `Mark Flat ${payment.flat}'s payment of ${fmt(payment.submittedAmount)} as paid?\n\nOnly confirm after checking the ${REF_LABELS[payment.submittedMethod] || "reference"} in your bank statement.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text:  "Verify ✓",
          style: "default",
          onPress: async () => {
            try {
              setVerifying(payment._id?.toString());
              await maintenanceApi.verifyPayment(item.billId, payment._id);
              toast.success(`Payment for Flat ${payment.flat} verified.`);
              setItems((prev) => prev.filter((x) => x.payment._id !== payment._id));
            } catch (e) {
              toast.error(e?.message || "Could not verify payment.");
            } finally {
              setVerifying(null);
            }
          },
        },
      ]
    );
  };

  // ── Reject ───────────────────────────────────────────────────────────────────

  const openRejectModal = (item) => {
    setRejectTarget(item);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      setRejecting(true);
      await maintenanceApi.rejectPayment(
        rejectTarget.billId,
        rejectTarget.payment._id,
        rejectReason.trim()
      );
      toast.success(`Submission for Flat ${rejectTarget.payment.flat} rejected. Resident notified.`);
      setItems((prev) => prev.filter((x) => x.payment._id !== rejectTarget.payment._id));
      setRejectTarget(null);
    } catch (e) {
      toast.error(e?.message || "Could not reject payment.");
    } finally {
      setRejecting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <ScreenHeader
          title="Pending Verifications"
          onBack={() => navigation?.goBack()}
        />
        <View style={S.center}><Spinner /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top", "left", "right"]}>
      <ScreenHeader
        title="Pending Verifications"
        subtitle={items.length ? `${items.length} awaiting review` : "All clear"}
        onBack={() => navigation?.goBack()}
      />

      {/* ── Reject modal (inline overlay) ─────────────────────────────────── */}
      {rejectTarget && (
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>Reject Submission</Text>
            <Text style={S.modalSub}>
              Flat {rejectTarget.payment.flat} · {fmt(rejectTarget.payment.submittedAmount)}
            </Text>
            <Text style={S.modalLabel}>Reason (optional — shown to resident)</Text>
            <TextInput
              style={S.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. UTR not found in bank statement, amount mismatch"
              placeholderTextColor={C.gray500}
              multiline
              numberOfLines={3}
            />
            <View style={S.modalActions}>
              <TouchableOpacity
                style={S.modalCancel}
                onPress={() => setRejectTarget(null)}
                disabled={rejecting}
              >
                <Text style={S.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalReject, rejecting && S.disabled]}
                onPress={handleReject}
                disabled={rejecting}
              >
                <Text style={S.modalRejectText}>
                  {rejecting ? "Rejecting…" : "Reject"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(x) => x.payment?._id?.toString() || Math.random().toString()}
        contentContainerStyle={S.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.teal}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="✅"
            message="No payments pending verification"
          />
        }
        renderItem={({ item }) => (
          <QueueCard
            item={item}
            onVerify={handleVerify}
            onReject={openRejectModal}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list:   { padding: 16, paddingBottom: 40 },

  // Card
  card:      { padding: 16, marginBottom: 12 },
  cardHeader:{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  flatText:  { fontSize: 15, fontWeight: "700", color: C.text },
  residentName: { fontSize: 12, color: C.gray500, marginTop: 2 },
  timeChip:  { backgroundColor: C.gray100, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  timeText:  { fontSize: 11, color: C.gray700 },
  billTitle: { fontSize: 13, color: C.gray700, marginBottom: 12 },

  amountRow:   { flexDirection: "row", gap: 0, marginBottom: 12 },
  amountBlock: { flex: 1 },
  amountLabel: { fontSize: 10, color: C.gray500, marginBottom: 2, textTransform: "uppercase" },
  amountValue: { fontSize: 13, fontWeight: "700", color: C.text },

  utrBox: {
    backgroundColor: C.gray50,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.gray100,
  },
  utrLabel: { fontSize: 10, color: C.gray500, textTransform: "uppercase", marginBottom: 3 },
  utrValue: { fontSize: 15, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },

  note: { fontSize: 12, color: C.gray500, fontStyle: "italic", marginBottom: 10 },

  // Action buttons
  actions:       { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectBtn:     { flex: 1, borderWidth: 1.5, borderColor: "#E53E3E", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  rejectBtnText: { fontSize: 14, fontWeight: "700", color: "#E53E3E" },
  verifyBtn:     { flex: 2, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  verifyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Reject modal overlay
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 999,
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle:  { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  modalSub:    { fontSize: 13, color: C.gray500, marginBottom: 16 },
  modalLabel:  { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 },
  modalInput:  {
    borderWidth: 1,
    borderColor: C.gray300,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: C.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalActions:     { flexDirection: "row", gap: 10 },
  modalCancel:      { flex: 1, borderWidth: 1.5, borderColor: C.gray300, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalCancelText:  { fontSize: 14, fontWeight: "600", color: C.gray700 },
  modalReject:      { flex: 2, backgroundColor: "#E53E3E", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalRejectText:  { fontSize: 14, fontWeight: "700", color: "#fff" },
  disabled:         { opacity: 0.5 },
});
