/**
 * screens/maintenance/SubmitProofScreen.jsx
 *
 * Resident-only screen: after paying offline (cash / bank transfer / UPI QR /
 * cheque), the resident opens this screen from the bill detail card, selects
 * how they paid, enters their UTR / reference number, and submits.
 *
 * The payment record moves to "pending_verification" and the admin gets a
 * push notification.
 *
 * Props (passed via route.params from bill detail):
 *   billId    — string
 *   paymentId — string
 *   billTitle — string (for display)
 *   totalDue  — number (pre-fill submitted amount)
 *   paymentSettings — object (society's accepted methods + bank details / UPI QR)
 */

import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { maintenanceApi } from "../../api/resources.api";
import { useToast }       from "../../context/ToastContext";
import {
  Card, Input, Btn, ScreenHeader,
} from "../../components/ui";
import { C } from "../../constants/theme";

// ─── Method metadata ──────────────────────────────────────────────────────────

const METHOD_META = {
  cash: {
    label:       "Cash",
    icon:        "💵",
    refLabel:    "Receipt / Reference Number",
    refHint:     "e.g. receipt number given by secretary",
    refRequired: false,
  },
  bank_transfer: {
    label:       "Bank Transfer / NEFT / IMPS",
    icon:        "🏦",
    refLabel:    "UTR Number",
    refHint:     "12-digit UTR found in your bank app after the transfer",
    refRequired: true,
  },
  upi_qr: {
    label:       "UPI QR Scan",
    icon:        "📱",
    refLabel:    "UPI Reference / Transaction ID",
    refHint:     "12-digit reference from your payment app",
    refRequired: true,
  },
  cheque: {
    label:       "Cheque",
    icon:        "📝",
    refLabel:    "Cheque Number",
    refHint:     "6-digit number printed on the cheque",
    refRequired: true,
  },
};

// ─── Helper: display bank details ────────────────────────────────────────────

const BankDetails = ({ bankTransfer }) => {
  if (!bankTransfer?.accountNumber) return null;
  const rows = [
    ["Account Name",   bankTransfer.accountHolderName],
    ["Account Number", bankTransfer.accountNumber],
    ["IFSC Code",      bankTransfer.ifscCode],
    ["Bank",           bankTransfer.bankName],
    ["Branch",         bankTransfer.branchName],
  ].filter(([, v]) => v);

  return (
    <Card style={S.detailCard}>
      <Text style={S.detailTitle}>Transfer to this account</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={S.detailRow}>
          <Text style={S.detailLabel}>{label}</Text>
          <Text style={S.detailValue}>{value}</Text>
        </View>
      ))}
    </Card>
  );
};

const UpiDetails = ({ upiQr }) => {
  if (!upiQr?.upiId && !upiQr?.qrImageUrl) return null;
  return (
    <Card style={S.detailCard}>
      <Text style={S.detailTitle}>Scan or enter UPI ID</Text>
      {upiQr.qrImageUrl && (
        <Image
          source={{ uri: upiQr.qrImageUrl }}
          style={S.qrImage}
          resizeMode="contain"
        />
      )}
      {upiQr.upiId && (
        <Text style={S.upiId}>{upiQr.upiId}</Text>
      )}
    </Card>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SubmitProofScreen({ route, navigation }) {
  const {
    billId,
    paymentId,
    billTitle   = "Maintenance Bill",
    totalDue    = 0,
    paymentSettings = {},
  } = route?.params || {};

  const toast = useToast();

  const accepted = paymentSettings.acceptedMethods || ["cash", "bank_transfer"];

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [utrNumber,      setUtrNumber]      = useState("");
  const [proofNote,      setProofNote]      = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedMethod) {
      toast.error("Please select how you paid.");
      return;
    }
    const meta = METHOD_META[selectedMethod];
    if (meta.refRequired && !utrNumber.trim()) {
      toast.error(`Please enter your ${meta.refLabel}.`);
      return;
    }

    try {
      setSubmitting(true);
      await maintenanceApi.submitProof(billId, paymentId, {
        submittedMethod: selectedMethod,
        submittedAmount: totalDue,
        utrNumber:       utrNumber.trim() || null,
        proofNote:       proofNote.trim() || null,
      });
      toast.success("Payment submitted! The admin will verify shortly.");
      navigation?.goBack();
    } catch (e) {
      toast.error(e?.message || "Could not submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedMeta = selectedMethod ? METHOD_META[selectedMethod] : null;

  return (
    <SafeAreaView style={S.safe} edges={["top", "left", "right"]}>
      <ScreenHeader
        title="Submit Payment Proof"
        subtitle={billTitle}
        onBack={() => navigation?.goBack()}
      />

      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Amount banner ──────────────────────────────────────────────── */}
        <View style={S.amountBanner}>
          <Text style={S.amountLabel}>Amount due</Text>
          <Text style={S.amountValue}>
            ₹{Number(totalDue).toLocaleString("en-IN")}
          </Text>
        </View>

        {/* ── Step 1: How did you pay? ────────────────────────────────────── */}
        <Text style={S.stepLabel}>Step 1 — How did you pay?</Text>

        <Card style={S.methodsCard}>
          {accepted.map((key, i) => {
            const meta   = METHOD_META[key];
            if (!meta) return null;
            const active = selectedMethod === key;
            return (
              <View key={key}>
                <TouchableOpacity
                  style={[S.methodRow, active && S.methodRowActive]}
                  onPress={() => setSelectedMethod(key)}
                  activeOpacity={0.7}
                >
                  <Text style={S.methodIcon}>{meta.icon}</Text>
                  <Text style={[S.methodLabel, active && S.methodLabelActive]}>
                    {meta.label}
                  </Text>
                  <View style={[S.radio, active && S.radioActive]}>
                    {active && <View style={S.radioDot} />}
                  </View>
                </TouchableOpacity>
                {i < accepted.length - 1 && <View style={S.divider} />}
              </View>
            );
          })}
        </Card>

        {/* ── Payment details for selected method ─────────────────────────── */}
        {selectedMethod === "bank_transfer" && (
          <BankDetails bankTransfer={paymentSettings.bankTransfer} />
        )}
        {selectedMethod === "upi_qr" && (
          <UpiDetails upiQr={paymentSettings.upiQr} />
        )}
        {selectedMethod === "cash" && paymentSettings.cashInstructions && (
          <Card style={S.detailCard}>
            <Text style={S.detailTitle}>Payment instructions</Text>
            <Text style={S.instructionText}>{paymentSettings.cashInstructions}</Text>
          </Card>
        )}
        {selectedMethod === "cheque" && paymentSettings.chequeInstructions && (
          <Card style={S.detailCard}>
            <Text style={S.detailTitle}>Cheque instructions</Text>
            <Text style={S.instructionText}>{paymentSettings.chequeInstructions}</Text>
          </Card>
        )}

        {/* ── Step 2: Enter reference ────────────────────────────────────── */}
        {selectedMeta && (
          <>
            <Text style={S.stepLabel}>
              Step 2 — Enter your {selectedMeta.refLabel}
              {selectedMeta.refRequired ? "" : " (optional)"}
            </Text>
            <Card style={S.card}>
              <Input
                label={selectedMeta.refLabel}
                value={utrNumber}
                onChangeText={setUtrNumber}
                placeholder={selectedMeta.refHint}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Input
                label="Note (optional)"
                value={proofNote}
                onChangeText={setProofNote}
                placeholder='e.g. Paid from my father '
                multiline
                numberOfLines={2}
                style={[S.mt, S.textarea]}
              />
            </Card>

            <View style={S.hintBox}>
              <Text style={S.hintIcon}>ℹ️</Text>
              <Text style={S.hintText}>
                {selectedMethod === "bank_transfer" || selectedMethod === "upi_qr"
                  ? "Your UTR/reference is shown in your bank or UPI app immediately after the transfer. The admin will cross-check it in the bank statement."
                  : "The admin will verify your submission. You'll get a notification once it's confirmed."}
              </Text>
            </View>
          </>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <Btn
          label={submitting ? "Submitting…" : "Submit Payment Proof"}
          onPress={handleSubmit}
          disabled={submitting || !selectedMethod}
          style={S.submitBtn}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },

  // Amount banner
  amountBanner: {
    backgroundColor: C.navy,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  amountLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  amountValue: { fontSize: 28, fontWeight: "700", color: "#fff" },

  // Step label
  stepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.gray500,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 2,
  },

  // Method selection
  methodsCard: { padding: 4, marginBottom: 16 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  methodRowActive: { backgroundColor: "#EBF5F5" },
  methodIcon:      { fontSize: 20 },
  methodLabel:     { flex: 1, fontSize: 14, color: C.gray700, fontWeight: "500" },
  methodLabelActive:{ color: C.teal, fontWeight: "700" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive:  { borderColor: C.teal },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal },
  divider:      { height: 1, backgroundColor: C.gray100, marginHorizontal: 12 },

  // Detail cards (bank / UPI)
  detailCard:   { padding: 16, marginBottom: 16 },
  detailTitle:  { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 10 },
  detailRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailLabel:  { fontSize: 12, color: C.gray500 },
  detailValue:  { fontSize: 12, fontWeight: "600", color: C.text, maxWidth: "60%", textAlign: "right" },

  qrImage: {
    width: 180, height: 180,
    alignSelf: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.gray300,
    marginBottom: 10,
    marginTop: 6,
  },
  upiId: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: C.teal,
    letterSpacing: 0.5,
  },

  instructionText: { fontSize: 13, color: C.gray700, lineHeight: 20 },

  // Input section
  card:     { padding: 16, marginBottom: 12 },
  mt:       { marginTop: 12 },
  textarea: { minHeight: 60, textAlignVertical: "top" },

  // Hint box
  hintBox: {
    flexDirection: "row",
    backgroundColor: "#EBF5F5",
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  hintIcon: { fontSize: 16 },
  hintText: { flex: 1, fontSize: 12, color: C.teal, lineHeight: 18 },

  submitBtn: { marginTop: 4, marginBottom: 8 },
});
