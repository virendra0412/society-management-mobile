/**
 * src/screens/sa/SASocietyPricing.jsx
 * Super Admin — Society Pricing Screen
 *
 * Answers exactly: "my friend's society should run every feature for ₹0,
 * another society pays ₹10/month, others pay the normal rate."
 *
 * TWO SEPARATE MECHANISMS, both live on this one screen:
 *
 *   A) GRANT PLAN DIRECTLY (top section)
 *      Sets plan/status/endDate on the Subscription directly. No Razorpay
 *      order is ever created for this society while it's set this way.
 *      This is the ONLY correct way to give a society "everything free" —
 *      Razorpay itself has no concept of a ₹0 charge, so trying to model
 *      "free" as a ₹0 custom rate on a paid plan doesn't work end-to-end.
 *      → Set plan: premium, status: active, endDate: far future = fully free.
 *
 *   B) NEGOTIATED RATE (bottom section)
 *      The society stays on a normal payable plan (basic/premium) and
 *      still pays via Razorpay — just at a rate you set instead of the
 *      standard ₹599/₹999. This is the ₹10/month pilot-customer case.
 *      Takes effect on the society's NEXT payment, not retroactively.
 *
 * Use (A) for "free forever", use (B) for "discounted but still paying".
 */
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saSubscriptionApi } from "../../api/sa.api";
import { COLORS } from "../../constants/theme";

const PLAN_OPTIONS = [
  { key: "trial",   label: "Trial",   desc: "30 days, all features, auto-downgrades after" },
  { key: "free",    label: "Free",    desc: "Permanent, core features only, max 25 residents" },
  { key: "basic",   label: "Basic",   desc: "₹599/mo standard rate, max 100 residents" },
  { key: "premium", label: "Premium", desc: "₹999/mo standard rate, unlimited residents" },
];

const STATUS_OPTIONS = ["active", "suspended", "expired", "cancelled"];

// A handful of common "how long" presets for the direct-grant end date,
// so the SA doesn't have to think in raw dates for the common cases.
const DURATION_PRESETS = [
  { label: "1 month",   days: 30 },
  { label: "3 months",  days: 90 },
  { label: "1 year",    days: 365 },
  { label: "10 years",  days: 3650 }, // de-facto "forever" for a comped friend's society
];

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const SASocietyPricing = ({ route, navigation }) => {
  const { societyId, societyName } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  // ── Section A: direct plan grant ──────────────────────────────────────────
  const [grantPlan, setGrantPlan] = useState("premium");
  const [grantStatus, setGrantStatus] = useState("active");
  const [grantDurationDays, setGrantDurationDays] = useState(3650);
  const [grantNote, setGrantNote] = useState("");
  const [grantSaving, setGrantSaving] = useState(false);

  // ── Section B: negotiated rate ────────────────────────────────────────────
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [customSaving, setCustomSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await saSubscriptionApi.getOne(societyId);
      const sub = res.data?.subscription;
      setSubscription(sub);
      if (sub) {
        setGrantPlan(sub.plan || "premium");
        setGrantStatus(sub.status || "active");
        setCustomEnabled(!!sub.customPricing?.enabled);
        setCustomAmount(sub.customPricing?.monthlyRupees != null ? String(sub.customPricing.monthlyRupees) : "");
        setCustomNote(sub.customPricing?.note || "");
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Section A: Grant plan directly ────────────────────────────────────────
  const handleGrant = () => {
    const isFreeGrant = grantPlan === "free" || grantPlan === "trial";
    const endDate = new Date(Date.now() + grantDurationDays * 86_400_000);

    Alert.alert(
      "Confirm Plan Grant",
      `Set ${societyName || "this society"} to ${grantPlan.toUpperCase()} (${grantStatus}) ` +
      `until ${fmtDate(endDate)}?\n\n` +
      (isFreeGrant
        ? "This plan is always free — no Razorpay payment will ever be requested."
        : `This sets the plan directly without payment. The society will see "${grantPlan}" as active immediately, with no Razorpay order created. They will only be asked to pay again if their plan later expires or you change it back.`),
      [
        { text: "Cancel" },
        {
          text: "Confirm Grant",
          onPress: async () => {
            setGrantSaving(true);
            try {
              await saSubscriptionApi.updateSub(societyId, {
                plan:     grantPlan,
                status:   grantStatus,
                endDate:  endDate.toISOString(),
                priceMonthly: 0, // direct grant — not a Razorpay-charged rate, purely a record
                note:     grantNote.trim() || `Plan granted directly by Super Admin — ${grantPlan}, ${grantStatus}, until ${fmtDate(endDate)}.`,
              });
              Alert.alert("Done", `${societyName || "Society"} is now on ${grantPlan} until ${fmtDate(endDate)}.`);
              setGrantNote("");
              fetchData();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to update plan");
            } finally {
              setGrantSaving(false);
            }
          },
        },
      ]
    );
  };

  // ── Section B: Negotiated rate ────────────────────────────────────────────
  const handleSaveCustomPricing = () => {
    if (customEnabled) {
      const amount = Number(customAmount);
      if (!customAmount || isNaN(amount) || amount < 1) {
        Alert.alert(
          "Invalid amount",
          "A negotiated rate must be at least ₹1 — Razorpay can't process a ₹0 charge. " +
          "If you want this society to pay nothing, use \"Grant Plan Directly\" above instead, " +
          "which bypasses Razorpay entirely."
        );
        return;
      }
      if (amount > 1000000) {
        Alert.alert("Invalid amount", "Amount must be ₹10,00,000 or less.");
        return;
      }
    }

    const action = customEnabled
      ? `Set ${societyName || "this society"}'s rate to ₹${customAmount}/month?`
      : `Clear ${societyName || "this society"}'s custom rate and revert to the standard plan price?`;

    Alert.alert(
      "Confirm",
      action + "\n\nTakes effect on their NEXT payment — does not change the current active period.",
      [
        { text: "Cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setCustomSaving(true);
            try {
              await saSubscriptionApi.setCustomPricing(societyId, {
                enabled: customEnabled,
                ...(customEnabled ? { monthlyRupees: Number(customAmount) } : {}),
                note: customNote.trim() || undefined,
              });
              Alert.alert(
                "Saved",
                customEnabled
                  ? `Custom rate of ₹${customAmount}/month set.`
                  : "Custom rate cleared — back to standard pricing."
              );
              fetchData();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to save");
            } finally {
              setCustomSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isFreeGrant = grantPlan === "free" || grantPlan === "trial";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pricing & Plan</Text>
        <Text style={styles.headerSub}>{societyName || "Society"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Current state banner */}
        <View style={styles.currentBanner}>
          <Text style={styles.currentLabel}>CURRENT STATE</Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentPlan}>{(subscription?.plan || "—").toUpperCase()}</Text>
            <View style={[
              styles.statusPill,
              subscription?.status === "active" ? styles.statusActive : styles.statusInactive,
            ]}>
              <Text style={styles.statusPillText}>{subscription?.status || "—"}</Text>
            </View>
          </View>
          <Text style={styles.currentMeta}>
            Until {fmtDate(subscription?.endDate)}
            {subscription?.customPricing?.enabled
              ? `  ·  Custom rate: ₹${subscription.customPricing.monthlyRupees}/mo`
              : "  ·  Standard rate"}
          </Text>
        </View>

        {/* ═══════════ SECTION A: Grant Plan Directly ═══════════ */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🎁 Grant Plan Directly</Text>
          <Text style={styles.sectionDesc}>
            Sets the plan immediately, no payment involved. Use this for fully-free societies
            (friends, pilots, internal demos) — Razorpay is never called while a society
            is on a directly-granted plan.
          </Text>

          <Text style={styles.fieldLabel}>Plan</Text>
          <View style={styles.optionGrid}>
            {PLAN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.planOption, grantPlan === opt.key && styles.planOptionActive]}
                onPress={() => setGrantPlan(opt.key)}
              >
                <Text style={[styles.planOptionLabel, grantPlan === opt.key && styles.planOptionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.planOptionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.pillRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusOption, grantStatus === s && styles.statusOptionActive]}
                onPress={() => setGrantStatus(s)}
              >
                <Text style={[styles.statusOptionText, grantStatus === s && styles.statusOptionTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Valid for</Text>
          <View style={styles.pillRow}>
            {DURATION_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.days}
                style={[styles.durationOption, grantDurationDays === p.days && styles.durationOptionActive]}
                onPress={() => setGrantDurationDays(p.days)}
              >
                <Text style={[styles.durationOptionText, grantDurationDays === p.days && styles.durationOptionTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.durationHint}>
            Until {fmtDate(new Date(Date.now() + grantDurationDays * 86_400_000))}
            {grantDurationDays >= 3650 ? "  (effectively forever)" : ""}
          </Text>

          <Text style={styles.fieldLabel}>Note (optional, for audit history)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder={`e.g. "Friend's society — comped indefinitely"`}
            placeholderTextColor="#94A3B8"
            value={grantNote}
            onChangeText={setGrantNote}
            multiline
          />

          {isFreeGrant && (
            <View style={styles.freeNotice}>
              <Text style={styles.freeNoticeText}>
                ✓ This plan is always free — the society will never be asked to pay.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, grantSaving && styles.btnDisabled]}
            onPress={handleGrant}
            disabled={grantSaving}
          >
            {grantSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Grant {grantPlan.toUpperCase()} Plan</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ═══════════ SECTION B: Negotiated Rate ═══════════ */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>💸 Negotiated Rate</Text>
          <Text style={styles.sectionDesc}>
            Society stays on a paid plan and still pays via Razorpay — just at a rate you set
            instead of the standard ₹599/₹999. Use this for "₹10/month pilot customer" cases.
            Takes effect on their NEXT payment.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable custom rate</Text>
            <Switch
              value={customEnabled}
              onValueChange={setCustomEnabled}
              trackColor={{ false: "#CBD5E1", true: COLORS.primary + "80" }}
              thumbColor={customEnabled ? COLORS.primary : "#f4f3f4"}
            />
          </View>

          {customEnabled && (
            <>
              <Text style={styles.fieldLabel}>Monthly rate (₹, minimum ₹1)</Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupeeSym}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#94A3B8"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  maxLength={7}
                />
                <Text style={styles.perMo}>/mo</Text>
              </View>

              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder={`e.g. "₹10 pilot rate for Q1 evaluation"`}
                placeholderTextColor="#94A3B8"
                value={customNote}
                onChangeText={setCustomNote}
                multiline
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.secondaryBtn, customSaving && styles.btnDisabled]}
            onPress={handleSaveCustomPricing}
            disabled={customSaving}
          >
            {customSaving
              ? <ActivityIndicator color={COLORS.primary} />
              : <Text style={styles.secondaryBtnText}>
                  {customEnabled ? "Save Custom Rate" : "Clear Custom Rate"}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* History */}
        {subscription?.history?.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📜 History</Text>
            {[...subscription.history].reverse().slice(0, 10).map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyAction}>{h.action}</Text>
                <Text style={styles.historyNote}>{h.note}</Text>
                <Text style={styles.historyDate}>{fmtDate(h.performedAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  header:      { backgroundColor: COLORS.primary || "#0F2040", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  scroll:      { padding: 16 },

  currentBanner: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  currentLabel:  { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
  currentRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  currentPlan:   { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  statusPill:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusActive:  { backgroundColor: "#D1FAE5" },
  statusInactive:{ backgroundColor: "#FEE2E2" },
  statusPillText:{ fontSize: 11, fontWeight: "700", color: "#1E293B", textTransform: "uppercase" },
  currentMeta:   { fontSize: 12, color: "#64748B", marginTop: 6 },

  sectionCard:  { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 6 },
  sectionDesc:  { fontSize: 12.5, color: "#64748B", lineHeight: 18, marginBottom: 16 },

  fieldLabel:   { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 },

  optionGrid:   { gap: 8, marginBottom: 4 },
  planOption:   { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12 },
  planOptionActive: { borderColor: COLORS.primary || "#0F2040", backgroundColor: (COLORS.primary || "#0F2040") + "0D" },
  planOptionLabel: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  planOptionLabelActive: { color: COLORS.primary || "#0F2040" },
  planOptionDesc:  { fontSize: 11.5, color: "#64748B", marginTop: 2 },

  pillRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  statusOption: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  statusOptionActive: { backgroundColor: COLORS.primary || "#0F2040", borderColor: COLORS.primary || "#0F2040" },
  statusOptionText: { fontSize: 12, fontWeight: "600", color: "#475569", textTransform: "capitalize" },
  statusOptionTextActive: { color: "#fff" },

  durationOption: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  durationOptionActive: { backgroundColor: "#0D7377", borderColor: "#0D7377" },
  durationOptionText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  durationOptionTextActive: { color: "#fff" },
  durationHint: { fontSize: 11.5, color: "#94A3B8", marginTop: 6, marginBottom: 4 },

  noteInput:    { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 13, color: "#1E293B", minHeight: 56, textAlignVertical: "top", marginTop: 4, marginBottom: 4 },

  freeNotice:   { backgroundColor: "#D1FAE5", borderRadius: 8, padding: 10, marginTop: 12, marginBottom: 4 },
  freeNoticeText: { fontSize: 12, color: "#065F46", fontWeight: "600" },

  toggleRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  toggleLabel:  { fontSize: 14, fontWeight: "600", color: "#1E293B" },

  amountRow:    { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, marginBottom: 4 },
  rupeeSym:     { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  amountInput:  { flex: 1, fontSize: 20, fontWeight: "700", color: "#1E293B", paddingVertical: 10 },
  perMo:        { fontSize: 13, color: "#64748B" },

  primaryBtn:   { backgroundColor: COLORS.primary || "#0F2040", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 16 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  secondaryBtn: { borderWidth: 1.5, borderColor: COLORS.primary || "#0F2040", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 16 },
  secondaryBtnText: { color: COLORS.primary || "#0F2040", fontSize: 15, fontWeight: "700" },

  btnDisabled:  { opacity: 0.6 },

  historyRow:   { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 10 },
  historyAction:{ fontSize: 12, fontWeight: "700", color: "#0D7377", textTransform: "uppercase" },
  historyNote:  { fontSize: 12.5, color: "#475569", marginTop: 2, lineHeight: 17 },
  historyDate:  { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});

export default SASocietyPricing;