/**
 * src/screens/sa/SASocietyPricing.jsx
 * Super Admin — Society Pricing & Plan screen
 *
 * FOUR SECTIONS:
 *
 *  A) Grant Plan Directly       — set plan/status/endDate, no Razorpay
 *  B) Negotiated Rate           — custom ₹/month for their next Razorpay payment
 *  C) Discount / Coupon         — % or flat off, optional expiry, on top of any rate
 *  D) Schedule Downgrade        — queue a plan drop for next renewal, never immediate
 *
 * Current state banner at top shows plan, status, endDate, custom rate,
 * active discount, and any pending downgrade.
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saSubscriptionApi } from "../../api/sa.api";
import { COLORS } from "../../constants/theme";

// ─── Constants ─────────────────────────────────────────────────────────────────
const PLAN_OPTIONS = [
  { key: "trial",        label: "Trial",        desc: "30 days free, all features, auto-downgrades" },
  { key: "free",         label: "Free",         desc: "Permanent, core features only, max 25 residents" },
  { key: "starter",      label: "Starter",      desc: "₹599/mo standard rate, max 100 residents" },
  { key: "professional", label: "Professional", desc: "₹999/mo standard rate, max 500 residents" },
  { key: "enterprise",   label: "Enterprise",   desc: "₹1799/mo standard rate, unlimited residents" },
];

const STATUS_OPTIONS = ["active", "suspended", "expired", "cancelled"];

const DURATION_PRESETS = [
  { label: "1 month",  days: 30   },
  { label: "3 months", days: 90   },
  { label: "1 year",   days: 365  },
  { label: "10 years", days: 3650 },
];

// Plans you can downgrade TO — must be lower than any paid plan
const DOWNGRADE_OPTIONS = [
  { key: "free",         label: "Free",         desc: "Core features only, no Razorpay" },
  { key: "starter",      label: "Starter",      desc: "₹599/mo at next renewal" },
  { key: "professional", label: "Professional", desc: "₹999/mo at next renewal" },
];

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const PLAN_ORDER = { trial: 0, free: 1, starter: 2, professional: 3, enterprise: 4 };

// ─── Component ─────────────────────────────────────────────────────────────────
const SASocietyPricing = ({ route }) => {
  const { societyId, societyName } = route?.params || {};

  const [loading,      setLoading]      = useState(true);
  const [subscription, setSubscription] = useState(null);

  // Section A — Grant Plan Directly
  const [grantPlan,         setGrantPlan]         = useState("enterprise");
  const [grantStatus,       setGrantStatus]       = useState("active");
  const [grantDurationDays, setGrantDurationDays] = useState(3650);
  const [grantNote,         setGrantNote]         = useState("");
  const [grantSaving,       setGrantSaving]       = useState(false);

  // Section B — Negotiated Rate
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customAmount,  setCustomAmount]  = useState("");
  const [customNote,    setCustomNote]    = useState("");
  const [customSaving,  setCustomSaving]  = useState(false);

  // Section C — Discount / Coupon
  const [discountType,       setDiscountType]       = useState("pct");    // "pct" | "flat"
  const [discountValue,      setDiscountValue]      = useState("");
  const [discountCode,       setDiscountCode]       = useState("");
  const [discountNote,       setDiscountNote]       = useState("");
  const [discountHasExpiry,  setDiscountHasExpiry]  = useState(false);
  const [discountExpiryDays, setDiscountExpiryDays] = useState(30);
  const [discountSaving,     setDiscountSaving]     = useState(false);

  // Section D — Schedule Downgrade
  const [downgradePlan,  setDowngradePlan]  = useState("starter");
  const [downgradeNote,  setDowngradeNote]  = useState("");
  const [downgradeSaving,setDowngradeSaving]= useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await saSubscriptionApi.getOne(societyId);
      const sub = res.data?.subscription;
      setSubscription(sub);
      if (sub) {
        setGrantPlan(sub.plan   || "enterprise");
        setGrantStatus(sub.status || "active");
        setCustomEnabled(!!sub.customPricing?.enabled);
        setCustomAmount(sub.customPricing?.monthlyRupees != null
          ? String(sub.customPricing.monthlyRupees) : "");
        setCustomNote(sub.customPricing?.note || "");

        // Prefill discount if one exists
        if (sub.discount?.pct) {
          setDiscountType("pct");
          setDiscountValue(String(sub.discount.pct));
          setDiscountCode(sub.discount.code || "");
        } else if (sub.discount?.flatRupees) {
          setDiscountType("flat");
          setDiscountValue(String(sub.discount.flatRupees));
          setDiscountCode(sub.discount.code || "");
        }

        // Default downgrade target = one step below current
        const order = PLAN_ORDER[sub.plan] ?? 0;
        if (order >= 3) setDowngradePlan("professional");
        else if (order >= 2) setDowngradePlan("starter");
        else setDowngradePlan("free");
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Section A: Grant Plan ─────────────────────────────────────────────────────
  const handleGrant = () => {
    const endDate = new Date(Date.now() + grantDurationDays * 86_400_000);
    Alert.alert(
      "Confirm Plan Grant",
      `Set ${societyName} to ${grantPlan.toUpperCase()} (${grantStatus}) until ${fmtDate(endDate)}?\n\n` +
      (grantPlan === "free" || grantPlan === "trial"
        ? "This plan is always free — Razorpay will never be called."
        : "Plan is set directly — no payment required. Society pays again only if plan expires."),
      [
        { text: "Cancel" },
        {
          text: "Confirm Grant",
          onPress: async () => {
            setGrantSaving(true);
            try {
              await saSubscriptionApi.updateSub(societyId, {
                plan:         grantPlan,
                status:       grantStatus,
                endDate:      endDate.toISOString(),
                priceMonthly: 0,
                note:         grantNote.trim() ||
                  `Direct grant by SA — ${grantPlan}, ${grantStatus}, until ${fmtDate(endDate)}.`,
              });
              Alert.alert("Done ✅", `${societyName} is now on ${grantPlan} until ${fmtDate(endDate)}.`);
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

  // ── Section B: Negotiated Rate ────────────────────────────────────────────────
  const handleSaveCustomPricing = () => {
    if (customEnabled) {
      const amount = Number(customAmount);
      if (!customAmount || isNaN(amount) || amount < 1) {
        Alert.alert("Invalid amount",
          "Must be at least ₹1 — Razorpay cannot process ₹0. " +
          "For fully-free, use Grant Plan Directly above.");
        return;
      }
    }
    Alert.alert(
      "Confirm",
      customEnabled
        ? `Set ${societyName}'s rate to ₹${customAmount}/month?\n\nTakes effect on their NEXT payment.`
        : `Clear ${societyName}'s custom rate and revert to standard plan price?\n\nTakes effect on their NEXT payment.`,
      [
        { text: "Cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setCustomSaving(true);
            try {
              await saSubscriptionApi.setCustomPricing(societyId, {
                enabled:       customEnabled,
                ...(customEnabled ? { monthlyRupees: Number(customAmount) } : {}),
                note:          customNote.trim() || undefined,
              });
              Alert.alert("Saved ✅", customEnabled
                ? `Custom rate of ₹${customAmount}/month set.`
                : "Custom rate cleared.");
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

  // ── Section C: Discount / Coupon ──────────────────────────────────────────────
  const handleSetDiscount = () => {
    const val = Number(discountValue);
    if (!discountValue || isNaN(val) || val < 1) {
      Alert.alert("Invalid value", discountType === "pct"
        ? "Enter a percentage between 1–100."
        : "Enter a flat amount of at least ₹1.");
      return;
    }
    if (discountType === "pct" && val > 100) {
      Alert.alert("Invalid value", "Percentage cannot exceed 100.");
      return;
    }

    const expiryDate = discountHasExpiry
      ? new Date(Date.now() + discountExpiryDays * 86_400_000)
      : null;

    const summary = discountType === "pct"
      ? `${val}% off${discountCode ? ` (code: ${discountCode.toUpperCase()})` : ""}`
      : `₹${val} flat off${discountCode ? ` (code: ${discountCode.toUpperCase()})` : ""}`;

    Alert.alert(
      "Confirm Discount",
      `Set discount for ${societyName}: ${summary}${expiryDate ? `, valid until ${fmtDate(expiryDate)}` : ", no expiry"}.\n\nApplied on their NEXT Razorpay payment.`,
      [
        { text: "Cancel" },
        {
          text: "Set Discount",
          onPress: async () => {
            setDiscountSaving(true);
            try {
              await saSubscriptionApi.setDiscount(societyId, {
                ...(discountType === "pct"
                  ? { pct: val }
                  : { flatRupees: val }),
                ...(discountCode.trim() ? { code: discountCode.trim().toUpperCase() } : {}),
                ...(expiryDate ? { validUntil: expiryDate.toISOString() } : {}),
                ...(discountNote.trim() ? { note: discountNote.trim() } : {}),
              });
              Alert.alert("Saved ✅", `Discount set: ${summary}.`);
              setDiscountValue(""); setDiscountCode(""); setDiscountNote("");
              fetchData();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to set discount");
            } finally {
              setDiscountSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleClearDiscount = () => {
    Alert.alert("Clear Discount",
      `Remove the discount for ${societyName}? They'll pay the full (custom or standard) rate on their next payment.`,
      [
        { text: "Cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setDiscountSaving(true);
            try {
              await saSubscriptionApi.setDiscount(societyId, { clear: true });
              Alert.alert("Done ✅", "Discount cleared.");
              fetchData();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to clear");
            } finally {
              setDiscountSaving(false);
            }
          },
        },
      ]
    );
  };

  // ── Section D: Schedule Downgrade ─────────────────────────────────────────────
  const handleScheduleDowngrade = () => {
    const currentOrder   = PLAN_ORDER[subscription?.plan] ?? 0;
    const downgradeOrder = PLAN_ORDER[downgradePlan] ?? 0;
    if (downgradeOrder >= currentOrder) {
      Alert.alert("Invalid",
        `${downgradePlan} is the same or higher than the current plan (${subscription?.plan}). ` +
        "Choose a lower plan.");
      return;
    }

    Alert.alert(
      "Confirm Scheduled Downgrade",
      `${societyName}'s plan will change from ${subscription?.plan} → ${downgradePlan} on ` +
      `${fmtDate(subscription?.endDate)} (their next renewal).\n\n` +
      "Current plan stays fully active until then — no features are removed immediately.",
      [
        { text: "Cancel" },
        {
          text: "Schedule Downgrade",
          onPress: async () => {
            setDowngradeSaving(true);
            try {
              await saSubscriptionApi.scheduleDowngrade(societyId, {
                toPlan: downgradePlan,
                note:   downgradeNote.trim() || undefined,
              });
              Alert.alert("Scheduled ✅",
                `Downgrade to ${downgradePlan} queued for ${fmtDate(subscription?.endDate)}.`);
              setDowngradeNote("");
              fetchData();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to schedule downgrade");
            } finally {
              setDowngradeSaving(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const isFreeGrant   = grantPlan === "free" || grantPlan === "trial";
  const activeDiscount = subscription?.discount;
  const hasDiscount    = activeDiscount && (activeDiscount.pct || activeDiscount.flatRupees);
  const pendingPlan    = subscription?.pendingPlan;
  const pendingPlanAt  = subscription?.pendingPlanAt;

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Pricing & Plan</Text>
        <Text style={s.headerSub}>{societyName || "Society"}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Current State Banner ── */}
        <View style={s.stateBanner}>
          <Text style={s.stateLabel}>CURRENT STATE</Text>
          <View style={s.stateRow}>
            <Text style={s.statePlan}>{(subscription?.plan || "—").toUpperCase()}</Text>
            <View style={[s.statusPill, subscription?.status === "active" ? s.statusActive : s.statusInactive]}>
              <Text style={s.statusPillTxt}>{subscription?.status || "—"}</Text>
            </View>
          </View>
          <Text style={s.stateMeta}>Until {fmtDate(subscription?.endDate)}</Text>
          {subscription?.customPricing?.enabled && (
            <Text style={s.stateMeta}>💸 Custom rate: ₹{subscription.customPricing.monthlyRupees}/mo
              {subscription.customPricing.note ? ` — ${subscription.customPricing.note}` : ""}</Text>
          )}
          {hasDiscount && (
            <Text style={s.stateMeta}>🏷️ Discount: {activeDiscount.pct
              ? `${activeDiscount.pct}% off`
              : `₹${activeDiscount.flatRupees} flat off`}
              {activeDiscount.code ? ` (${activeDiscount.code})` : ""}
              {activeDiscount.validUntil ? ` · expires ${fmtDate(activeDiscount.validUntil)}` : ""}
            </Text>
          )}
          {pendingPlan && (
            <View style={s.pendingBanner}>
              <Text style={s.pendingTxt}>
                🔔 Downgrade to {pendingPlan.toUpperCase()} scheduled for {fmtDate(pendingPlanAt)}
              </Text>
            </View>
          )}
        </View>

        {/* ═══ SECTION A: Grant Plan Directly ═══ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🎁 Grant Plan Directly</Text>
          <Text style={s.cardDesc}>
            Sets plan/status immediately — no Razorpay, no payment. Use for fully-free societies
            (friends, demos, pilots). Razorpay is never called while a directly-granted plan is active.
          </Text>

          <Text style={s.fieldLabel}>Plan</Text>
          {PLAN_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.planRow, grantPlan === opt.key && s.planRowActive]}
              onPress={() => setGrantPlan(opt.key)}
            >
              <View style={[s.radio, grantPlan === opt.key && s.radioOn]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.planRowLabel, grantPlan === opt.key && s.planRowLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={s.planRowDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={s.fieldLabel}>Status</Text>
          <View style={s.pillRow}>
            {STATUS_OPTIONS.map((st) => (
              <TouchableOpacity
                key={st}
                style={[s.pill, grantStatus === st && s.pillActive]}
                onPress={() => setGrantStatus(st)}
              >
                <Text style={[s.pillTxt, grantStatus === st && s.pillTxtActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>Valid For</Text>
          <View style={s.pillRow}>
            {DURATION_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.days}
                style={[s.pill, grantDurationDays === p.days && s.pillActive]}
                onPress={() => setGrantDurationDays(p.days)}
              >
                <Text style={[s.pillTxt, grantDurationDays === p.days && s.pillTxtActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>
            Expires: {fmtDate(new Date(Date.now() + grantDurationDays * 86_400_000))}
            {grantDurationDays >= 3650 ? "  (effectively forever)" : ""}
          </Text>

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={s.textArea}
            placeholder={`e.g. "Friend's society — comped indefinitely"`}
            placeholderTextColor="#94A3B8"
            value={grantNote}
            onChangeText={setGrantNote}
            multiline
          />

          {isFreeGrant && (
            <View style={s.infoBox}>
              <Text style={s.infoBoxTxt}>✓ This plan is always free — society will never see a payment screen.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, grantSaving && s.btnOff]}
            onPress={handleGrant}
            disabled={grantSaving}
          >
            {grantSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnTxt}>Grant {grantPlan.toUpperCase()} Plan</Text>}
          </TouchableOpacity>
        </View>

        {/* ═══ SECTION B: Negotiated Rate ═══ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>💸 Negotiated Rate</Text>
          <Text style={s.cardDesc}>
            Society stays on a paid plan and pays via Razorpay — just at your custom rate instead
            of the standard price. Takes effect on their NEXT payment, not retroactively.
          </Text>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Enable custom rate</Text>
            <Switch
              value={customEnabled}
              onValueChange={setCustomEnabled}
              trackColor={{ false: "#CBD5E1", true: COLORS.primary + "80" }}
              thumbColor={customEnabled ? COLORS.primary : "#f4f3f4"}
            />
          </View>

          {customEnabled && (
            <>
              <Text style={s.fieldLabel}>Monthly rate (₹, min ₹1)</Text>
              <View style={s.amountRow}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={s.amountInput}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#94A3B8"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  maxLength={7}
                />
                <Text style={s.perMo}>/month</Text>
              </View>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={s.textArea}
                placeholder={`e.g. "₹10 pilot for Q1 evaluation"`}
                placeholderTextColor="#94A3B8"
                value={customNote}
                onChangeText={setCustomNote}
                multiline
              />
            </>
          )}

          <TouchableOpacity
            style={[s.outlineBtn, customSaving && s.btnOff]}
            onPress={handleSaveCustomPricing}
            disabled={customSaving}
          >
            {customSaving
              ? <ActivityIndicator color={COLORS.primary} />
              : <Text style={s.outlineBtnTxt}>{customEnabled ? "Save Custom Rate" : "Clear Custom Rate"}</Text>}
          </TouchableOpacity>
        </View>

        {/* ═══ SECTION C: Discount / Coupon ═══ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🏷️ Discount / Coupon</Text>
          <Text style={s.cardDesc}>
            Apply a percentage or flat discount on top of whatever rate is already set (custom or
            standard). Applied automatically on their next Razorpay payment. Optionally set an
            expiry date so it auto-removes.
          </Text>

          {hasDiscount && (
            <View style={s.discountActive}>
              <Text style={s.discountActiveTxt}>
                Active: {activeDiscount.pct
                  ? `${activeDiscount.pct}% off`
                  : `₹${activeDiscount.flatRupees} flat off`}
                {activeDiscount.code ? ` · code: ${activeDiscount.code}` : ""}
                {activeDiscount.validUntil
                  ? `\nExpires: ${fmtDate(activeDiscount.validUntil)}`
                  : "\nNo expiry"}
              </Text>
              <TouchableOpacity
                style={s.clearBtn}
                onPress={handleClearDiscount}
                disabled={discountSaving}
              >
                <Text style={s.clearBtnTxt}>Clear Discount</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.fieldLabel}>Discount Type</Text>
          <View style={s.pillRow}>
            {["pct", "flat"].map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.pill, discountType === t && s.pillActive]}
                onPress={() => setDiscountType(t)}
              >
                <Text style={[s.pillTxt, discountType === t && s.pillTxtActive]}>
                  {t === "pct" ? "Percentage %" : "Flat ₹"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>{discountType === "pct" ? "Percentage (1–100)" : "Amount (₹)"}</Text>
          <View style={s.amountRow}>
            {discountType === "flat" && <Text style={s.rupee}>₹</Text>}
            <TextInput
              style={[s.amountInput, { flex: 1 }]}
              keyboardType="numeric"
              placeholder={discountType === "pct" ? "20" : "100"}
              placeholderTextColor="#94A3B8"
              value={discountValue}
              onChangeText={setDiscountValue}
              maxLength={6}
            />
            {discountType === "pct" && <Text style={s.perMo}>%</Text>}
          </View>

          <Text style={s.fieldLabel}>Coupon Code (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. PILOT2025"
            placeholderTextColor="#94A3B8"
            value={discountCode}
            onChangeText={setDiscountCode}
            autoCapitalize="characters"
            maxLength={40}
          />

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Set expiry date</Text>
            <Switch
              value={discountHasExpiry}
              onValueChange={setDiscountHasExpiry}
              trackColor={{ false: "#CBD5E1", true: COLORS.primary + "80" }}
              thumbColor={discountHasExpiry ? COLORS.primary : "#f4f3f4"}
            />
          </View>
          {discountHasExpiry && (
            <>
              <View style={s.pillRow}>
                {[7, 30, 60, 90].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.pill, discountExpiryDays === d && s.pillActive]}
                    onPress={() => setDiscountExpiryDays(d)}
                  >
                    <Text style={[s.pillTxt, discountExpiryDays === d && s.pillTxtActive]}>{d} days</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.hint}>
                Expires: {fmtDate(new Date(Date.now() + discountExpiryDays * 86_400_000))}
              </Text>
            </>
          )}

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={s.textArea}
            placeholder={`e.g. "New Year offer for all societies"`}
            placeholderTextColor="#94A3B8"
            value={discountNote}
            onChangeText={setDiscountNote}
            multiline
          />

          <TouchableOpacity
            style={[s.primaryBtn, s.tealBtn, discountSaving && s.btnOff]}
            onPress={handleSetDiscount}
            disabled={discountSaving}
          >
            {discountSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnTxt}>
                  Set {discountType === "pct" ? `${discountValue || "—"}% Discount` : `₹${discountValue || "—"} Discount`}
                </Text>}
          </TouchableOpacity>
        </View>

        {/* ═══ SECTION D: Schedule Downgrade ═══ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>⬇️ Schedule Downgrade</Text>
          <Text style={s.cardDesc}>
            Queue a plan downgrade for the society's next renewal date — current plan stays fully
            active until then. Never removes access immediately. Job applies it automatically.
          </Text>

          {pendingPlan && (
            <View style={[s.infoBox, { backgroundColor: "#FEF9C3", borderColor: "#FCD34D" }]}>
              <Text style={[s.infoBoxTxt, { color: "#92400E" }]}>
                🔔 Downgrade to {pendingPlan.toUpperCase()} already scheduled for {fmtDate(pendingPlanAt)}.
                Saving a new one below will replace it.
              </Text>
            </View>
          )}

          <Text style={s.fieldLabel}>Downgrade To</Text>
          {DOWNGRADE_OPTIONS.filter((o) =>
            PLAN_ORDER[o.key] < (PLAN_ORDER[subscription?.plan] ?? 99)
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.planRow, downgradePlan === opt.key && s.planRowActive]}
              onPress={() => setDowngradePlan(opt.key)}
            >
              <View style={[s.radio, downgradePlan === opt.key && s.radioOn]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.planRowLabel, downgradePlan === opt.key && s.planRowLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={s.planRowDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <Text style={s.hint}>
            Takes effect: {fmtDate(subscription?.endDate)} (next renewal)
          </Text>

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={s.textArea}
            placeholder={`e.g. "Customer requested downgrade to starter"`}
            placeholderTextColor="#94A3B8"
            value={downgradeNote}
            onChangeText={setDowngradeNote}
            multiline
          />

          <TouchableOpacity
            style={[s.dangerBtn, downgradeSaving && s.btnOff]}
            onPress={handleScheduleDowngrade}
            disabled={downgradeSaving}
          >
            {downgradeSaving
              ? <ActivityIndicator color="#B91C1C" />
              : <Text style={s.dangerBtnTxt}>Schedule Downgrade to {downgradePlan.toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>

        {/* ═══ Subscription History ═══ */}
        {subscription?.history?.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📜 History</Text>
            {[...subscription.history].reverse().slice(0, 12).map((h, i) => (
              <View key={i} style={s.historyRow}>
                <Text style={s.historyAction}>{h.action?.replace(/_/g, " ").toUpperCase()}</Text>
                {h.note   && <Text style={s.historyNote}>{h.note}</Text>}
                <Text style={s.historyDate}>{fmtDate(h.performedAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const NAV = COLORS.primary || "#0F2040";
const TEAL = "#0D7377";

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  header:      { backgroundColor: NAV, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 2 },
  scroll:      { padding: 16 },

  stateBanner:   { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  stateLabel:    { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
  stateRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  statePlan:     { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  statusPill:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusActive:  { backgroundColor: "#D1FAE5" },
  statusInactive:{ backgroundColor: "#FEE2E2" },
  statusPillTxt: { fontSize: 11, fontWeight: "700", color: "#1E293B", textTransform: "uppercase" },
  stateMeta:     { fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 17 },
  pendingBanner: { backgroundColor: "#FEF9C3", borderRadius: 8, padding: 8, marginTop: 8 },
  pendingTxt:    { fontSize: 12, fontWeight: "600", color: "#92400E" },

  card:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 6 },
  cardDesc:  { fontSize: 12.5, color: "#64748B", lineHeight: 18, marginBottom: 16 },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8, marginTop: 10 },
  hint:       { fontSize: 11.5, color: "#94A3B8", marginTop: 4, marginBottom: 2 },

  planRow:           { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, marginBottom: 8 },
  planRowActive:     { borderColor: NAV, backgroundColor: NAV + "08" },
  planRowLabel:      { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  planRowLabelActive:{ color: NAV },
  planRowDesc:       { fontSize: 11.5, color: "#64748B", marginTop: 1 },
  radio:             { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#CBD5E1" },
  radioOn:           { borderColor: NAV, backgroundColor: NAV },

  pillRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill:         { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive:   { backgroundColor: NAV, borderColor: NAV },
  pillTxt:      { fontSize: 12, fontWeight: "600", color: "#475569" },
  pillTxtActive:{ color: "#fff" },

  switchRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 },
  switchLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B" },

  amountRow:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, marginBottom: 4, gap: 6 },
  rupee:       { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  amountInput: { fontSize: 20, fontWeight: "700", color: "#1E293B", paddingVertical: 10 },
  perMo:       { fontSize: 13, color: "#64748B" },

  input:    { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 13, color: "#1E293B", marginBottom: 4 },
  textArea: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 13, color: "#1E293B", minHeight: 52, textAlignVertical: "top", marginBottom: 4 },

  infoBox:    { backgroundColor: "#D1FAE5", borderRadius: 8, padding: 10, marginTop: 10, marginBottom: 4, borderWidth: 1, borderColor: "#A7F3D0" },
  infoBoxTxt: { fontSize: 12, color: "#065F46", fontWeight: "600" },

  discountActive:    { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" },
  discountActiveTxt: { fontSize: 12.5, color: "#1D4ED8", fontWeight: "600", lineHeight: 18 },
  clearBtn:          { marginTop: 8, borderWidth: 1, borderColor: "#EF4444", borderRadius: 8, padding: 8, alignItems: "center" },
  clearBtnTxt:       { fontSize: 12, fontWeight: "700", color: "#EF4444" },

  primaryBtn:    { backgroundColor: NAV,  borderRadius: 12, padding: 15, alignItems: "center", marginTop: 14 },
  tealBtn:       { backgroundColor: TEAL },
  primaryBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  outlineBtn:    { borderWidth: 1.5, borderColor: NAV, borderRadius: 12, padding: 15, alignItems: "center", marginTop: 14 },
  outlineBtnTxt: { color: NAV, fontSize: 15, fontWeight: "700" },

  dangerBtn:    { borderWidth: 1.5, borderColor: "#EF4444", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 14 },
  dangerBtnTxt: { color: "#EF4444", fontSize: 15, fontWeight: "700" },

  btnOff: { opacity: 0.55 },

  historyRow:    { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 10 },
  historyAction: { fontSize: 11, fontWeight: "700", color: TEAL, letterSpacing: 0.3 },
  historyNote:   { fontSize: 12.5, color: "#475569", marginTop: 2, lineHeight: 17 },
  historyDate:   { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});

export default SASocietyPricing;
