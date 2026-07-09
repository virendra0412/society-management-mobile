/**
 * screens/maintenance/PaymentSettingsScreen.jsx
 *
 * Admin-only screen: configure which payment methods the society accepts
 * for maintenance collection, and fill in the relevant details.
 *
 * Methods supported (no Razorpay / UPI QR payment gateway required):
 *   • Cash         — optional instructions for residents (where/when to pay)
 *   • Bank Transfer — account holder, account number, IFSC, bank, branch
 *   • UPI QR        — UPI ID + uploadable QR image
 *   • Cheque        — instructions (payable to, where to drop)
 *
 * Residents read these settings when they open a bill and tap "Pay".
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Image, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { maintenanceApi }  from "../../api/resources.api";
import { useAuth }         from "../../context/AuthContext";
import { useToast }        from "../../context/ToastContext";
import { useLanguage }     from "../../context/LanguageContext";
import { useMaintenancePaymentVerification } from "../../hooks/useMaintenancePaymentVerification";
import {
  Card, Input, Btn, Spinner, ScreenHeader,
} from "../../components/ui";
import { C } from "../../constants/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const METHODS = [
  {
    key:   "cash",
    label: "Cash",
    icon:  "💵",
    desc:  "Residents pay in person. Add instructions for where and when.",
  },
  {
    key:   "bank_transfer",
    label: "Bank Transfer / NEFT / IMPS",
    icon:  "🏦",
    desc:  "Residents transfer to the society's bank account and submit their UTR number.",
  },
  {
    key:   "upi_qr",
    label: "UPI QR",
    icon:  "📱",
    desc:  "Residents scan the society's UPI QR. Upload your QR image or enter the UPI ID.",
  },
  {
    key:   "cheque",
    label: "Cheque",
    icon:  "📝",
    desc:  "Residents hand in a cheque. Add instructions (payable to, drop box location).",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <Text style={S.sectionLabel}>{children}</Text>
);

const MethodRow = ({ method, enabled, onToggle }) => (
  <View style={S.methodRow}>
    <View style={S.methodLeft}>
      <Text style={S.methodIcon}>{method.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={S.methodLabel}>{method.label}</Text>
        <Text style={S.methodDesc}>{method.desc}</Text>
      </View>
    </View>
    <Switch
      value={enabled}
      onValueChange={onToggle}
      trackColor={{ false: C.gray300, true: C.teal }}
      thumbColor="#fff"
    />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PaymentSettingsScreen({ navigation }) {
  const { user }  = useAuth();
  const toast     = useToast();
  const { t }     = useLanguage();

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [qrUploading, setQrUploading] = useState(false);

  // Payment-verification on/off switch — separate flag from methods below.
  // Read via the shared hook (backed by GET /modules/status); written via a
  // dedicated admin-only endpoint. Local optimistic state + toggling flag so
  // the Switch feels instant but reverts cleanly if the request fails.
  const {
    paymentVerificationEnabled: verificationEnabled,
    loading: verificationLoading,
    refresh: refreshVerificationStatus,
  } = useMaintenancePaymentVerification();
  const [verificationToggling, setVerificationToggling] = useState(false);

  const handleToggleVerification = (nextValue) => {
    const doToggle = async () => {
      setVerificationToggling(true);
      try {
        await maintenanceApi.setVerificationStatus(nextValue);
        refreshVerificationStatus();
        toast.success(
          nextValue
            ? "Payment verification enabled. Residents can submit proof again."
            : "Payment verification disabled. Residents won't see the submit-proof option."
        );
      } catch (e) {
        toast.error("Could not update payment verification. Please try again.");
      } finally {
        setVerificationToggling(false);
      }
    };

    // Turning OFF hides an active resident-facing flow — confirm first.
    // Turning back ON is low-risk, so no confirmation needed.
    if (!nextValue) {
      Alert.alert(
        "Disable payment verification?",
        "Residents will no longer see the \"submit proof\" option, and you won't see the verification queue. Bill creation and viewing are unaffected. You can re-enable this anytime.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disable", style: "destructive", onPress: doToggle },
        ]
      );
    } else {
      doToggle();
    }
  };

  // Settings state
  const [accepted, setAccepted] = useState(new Set(["cash", "bank_transfer"]));
  const [bank, setBank]         = useState({
    accountHolderName: "",
    accountNumber:     "",
    ifscCode:          "",
    bankName:          "",
    branchName:        "",
  });
  const [upiId,              setUpiId]              = useState("");
  const [qrImageUri,         setQrImageUri]         = useState(null);
  const [chequeInstructions, setChequeInstructions] = useState("");
  const [cashInstructions,   setCashInstructions]   = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { paymentSettings: s } = await maintenanceApi.getPaymentSettings();
      if (s.acceptedMethods?.length) setAccepted(new Set(s.acceptedMethods));
      if (s.bankTransfer) {
        setBank({
          accountHolderName: s.bankTransfer.accountHolderName || "",
          accountNumber:     s.bankTransfer.accountNumber     || "",
          ifscCode:          s.bankTransfer.ifscCode          || "",
          bankName:          s.bankTransfer.bankName          || "",
          branchName:        s.bankTransfer.branchName        || "",
        });
      }
      if (s.upiQr) {
        setUpiId(s.upiQr.upiId || "");
        setQrImageUri(s.upiQr.qrImageUrl || null);
      }
      setChequeInstructions(s.chequeInstructions || "");
      setCashInstructions(s.cashInstructions     || "");
    } catch (e) {
      toast.error("Could not load payment settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Toggle method ────────────────────────────────────────────────────────────

  const toggleMethod = (key) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) {
          toast.error("At least one payment method must be enabled.");
          return prev;
        }
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      setSaving(true);
      await maintenanceApi.updatePaymentSettings({
        acceptedMethods:    Array.from(accepted),
        bankTransfer:       bank,
        upiQr:              { upiId },
        chequeInstructions,
        cashInstructions,
      });
      toast.success("Payment settings saved.");
    } catch (e) {
      toast.error(e?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  // ── Upload UPI QR ────────────────────────────────────────────────────────────

  const handlePickQr = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access in settings.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    try {
      setQrUploading(true);
      const { upiQr } = await maintenanceApi.uploadUpiQr(asset);
      setQrImageUri(upiQr.qrImageUrl);
      toast.success("UPI QR uploaded.");
    } catch (e) {
      toast.error(e?.message || "Could not upload QR image.");
    } finally {
      setQrUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <ScreenHeader title="Payment Settings" onBack={() => navigation?.goBack()} />
        <View style={S.center}><Spinner /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top", "left", "right"]}>
      <ScreenHeader
        title="Payment Settings"
        subtitle="Choose how residents can pay maintenance"
        onBack={() => navigation?.goBack()}
      />

      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Payment verification on/off ─────────────────────────────────── */}
        <SectionLabel>Payment Verification</SectionLabel>
        <Card style={S.card}>
          <View style={S.methodRow}>
            <View style={S.methodLeft}>
              <Text style={S.methodIcon}>🧾</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.methodLabel}>Accept proof submissions</Text>
                <Text style={S.methodDesc}>
                  {verificationEnabled
                    ? "Residents can submit payment proof for you to verify."
                    : "Residents won't see \"I've already paid\" — you'll record payments manually instead."}
                </Text>
              </View>
            </View>
            <Switch
              value={verificationEnabled}
              onValueChange={handleToggleVerification}
              disabled={verificationLoading || verificationToggling}
              trackColor={{ false: C.gray300, true: C.teal }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {/* ── Methods toggle ───────────────────────────────────────────────── */}
        <SectionLabel>Accepted Payment Methods</SectionLabel>
        <Card style={S.card}>
          {METHODS.map((m, i) => (
            <View key={m.key}>
              <MethodRow
                method={m}
                enabled={accepted.has(m.key)}
                onToggle={() => toggleMethod(m.key)}
              />
              {i < METHODS.length - 1 && <View style={S.divider} />}
            </View>
          ))}
        </Card>

        {/* ── Bank Transfer ────────────────────────────────────────────────── */}
        {accepted.has("bank_transfer") && (
          <>
            <SectionLabel>🏦 Bank Transfer Details</SectionLabel>
            <Card style={S.card}>
              <Input
                label="Account Holder Name"
                value={bank.accountHolderName}
                onChangeText={(v) => setBank((b) => ({ ...b, accountHolderName: v }))}
                placeholder="e.g. Greenwood Heights Society"
              />
              <Input
                label="Account Number"
                value={bank.accountNumber}
                onChangeText={(v) => setBank((b) => ({ ...b, accountNumber: v }))}
                placeholder="e.g. 012345678901"
                keyboardType="numeric"
                style={S.mt}
              />
              <Input
                label="IFSC Code"
                value={bank.ifscCode}
                onChangeText={(v) => setBank((b) => ({ ...b, ifscCode: v.toUpperCase() }))}
                placeholder="e.g. SBIN0001234"
                autoCapitalize="characters"
                style={S.mt}
              />
              <Input
                label="Bank Name"
                value={bank.bankName}
                onChangeText={(v) => setBank((b) => ({ ...b, bankName: v }))}
                placeholder="e.g. State Bank of India"
                style={S.mt}
              />
              <Input
                label="Branch Name (optional)"
                value={bank.branchName}
                onChangeText={(v) => setBank((b) => ({ ...b, branchName: v }))}
                placeholder="e.g. Andheri West"
                style={S.mt}
              />
            </Card>
          </>
        )}

        {/* ── UPI QR ───────────────────────────────────────────────────────── */}
        {accepted.has("upi_qr") && (
          <>
            <SectionLabel>📱 UPI QR Details</SectionLabel>
            <Card style={S.card}>
              <Input
                label="UPI ID"
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. greenwoodheights@oksbi"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[S.fieldLabel, S.mt]}>QR Code Image</Text>
              {qrImageUri ? (
                <View style={S.qrWrapper}>
                  <Image source={{ uri: qrImageUri }} style={S.qrImage} resizeMode="contain" />
                  <TouchableOpacity style={S.qrReplace} onPress={handlePickQr} disabled={qrUploading}>
                    <Text style={S.qrReplaceText}>
                      {qrUploading ? "Uploading…" : "Replace Image"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={S.qrUploadBox}
                  onPress={handlePickQr}
                  disabled={qrUploading}
                >
                  {qrUploading ? (
                    <Spinner size={24} />
                  ) : (
                    <>
                      <Text style={S.qrUploadIcon}>📷</Text>
                      <Text style={S.qrUploadText}>Tap to upload UPI QR image</Text>
                      <Text style={S.qrUploadHint}>PNG or JPG, max 5 MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </Card>
          </>
        )}

        {/* ── Cash ─────────────────────────────────────────────────────────── */}
        {accepted.has("cash") && (
          <>
            <SectionLabel>💵 Cash Instructions (optional)</SectionLabel>
            <Card style={S.card}>
              <Input
                label="Where and when to pay"
                value={cashInstructions}
                onChangeText={setCashInstructions}
                placeholder="e.g. Pay to the secretary at the office, Mon–Fri 10am–12pm"
                multiline
                numberOfLines={3}
                style={S.textarea}
              />
            </Card>
          </>
        )}

        {/* ── Cheque ───────────────────────────────────────────────────────── */}
        {accepted.has("cheque") && (
          <>
            <SectionLabel>📝 Cheque Instructions (optional)</SectionLabel>
            <Card style={S.card}>
              <Input
                label="Payable to / drop box location"
                value={chequeInstructions}
                onChangeText={setChequeInstructions}
                placeholder={
                  "e.g. Cheque payable to 'Greenwood Heights CHS'\n" +
                  "Drop in the box outside flat 001 (Ground floor)"
                }
                multiline
                numberOfLines={3}
                style={S.textarea}
              />
            </Card>
          </>
        )}

        {/* ── Save ─────────────────────────────────────────────────────────── */}
        <Btn
          label={saving ? "Saving…" : "Save Settings"}
          onPress={handleSave}
          disabled={saving}
          style={S.saveBtn}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll:    { padding: 16, paddingBottom: 40 },
  card:      { padding: 16, marginBottom: 4 },
  mt:        { marginTop: 12 },
  divider:   { height: 1, backgroundColor: C.gray100, marginVertical: 12 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.gray500,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 2,
  },

  // Method toggle row
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 10,
  },
  methodIcon:  { fontSize: 22, marginTop: 1 },
  methodLabel: { fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 2 },
  methodDesc:  { fontSize: 12, color: C.gray500, lineHeight: 16 },

  // Form
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 },
  textarea:   { minHeight: 72, textAlignVertical: "top", marginTop: 0 },

  // UPI QR upload
  qrWrapper: { alignItems: "center", marginTop: 8 },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.gray300,
  },
  qrReplace: { marginTop: 10 },
  qrReplaceText: { color: C.teal, fontSize: 13, fontWeight: "600" },

  qrUploadBox: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: C.gray300,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: C.gray50,
  },
  qrUploadIcon: { fontSize: 32, marginBottom: 8 },
  qrUploadText: { fontSize: 14, fontWeight: "600", color: C.gray700 },
  qrUploadHint: { fontSize: 12, color: C.gray500, marginTop: 4 },

  // Save button
  saveBtn: { marginTop: 24, marginBottom: 8 },
});