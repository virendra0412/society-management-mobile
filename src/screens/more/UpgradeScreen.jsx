/**
 * UpgradeScreen.jsx
 *
 * Design principle: one big tap = one clear outcome.
 * No proration math, no credit breakdowns visible to the user.
 * They see: plan name, what's included, price, one button.
 *
 * Structure:
 *  1. Current status bar (small, top)
 *  2. PLAN CARDS — full-width, one per plan, like Hotstar/Netflix
 *     Each card shows name, tagline, included features, price + cycle toggle
 *  3. BUILD YOUR OWN — checkbox list for à la carte, total at bottom
 *  4. What you already have (active + free) — collapsed below fold
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }   from "../../context/AuthContext";
import { modulesApi } from "../../api/resources.api";
import {
  subscriptionPaymentApi,
  paySubscription,
  payUpgrade,
  payForModules,
} from "../../api/subscriptionPayment.api";
import { COLORS } from "../../constants/theme";

const { width: SW } = Dimensions.get("window");

// ─── Plan definitions ─────────────────────────────────────────────────────────
// Keep this the single source of truth for what users see.
const PLANS = [
  {
    key:     "starter",
    label:   "Starter",
    tagline: "Perfect for small societies",
    price:   599,
    color:   "#3B82F6",
    popular: false,
    features: [
      "Up to 100 residents",
      "Visitor management & OTP entry",
      "Issue tracking & complaints",
      "Notices & Polls",
      "Emergency contacts",
    ],
  },
  {
    key:     "professional",
    label:   "Professional",
    tagline: "Most popular — all daily operations",
    price:   999,
    color:   "#7C3AED",
    popular: true,
    features: [
      "Up to 500 residents",
      "Everything in Starter",
      "Maintenance billing & payments",
      "Amenity booking (gym, pool, hall)",
      "Events & RSVP management",
      "Parking management",
    ],
  },
  {
    key:     "enterprise",
    label:   "Enterprise",
    tagline: "For large townships & complexes",
    price:   1799,
    color:   "#0D7377",
    popular: false,
    features: [
      "Unlimited residents",
      "Everything in Professional",
      "Community help & marketplace",
      "Advanced analytics & reports",
      "Multi-language (Hindi, Gujarati)",
      "Priority support",
    ],
  },
];

const CYCLES = [
  { key: "monthly",    label: "Monthly",     months: 1,  savePct: 0  },
  { key: "quarterly",  label: "3 Months",    months: 3,  savePct: 8  },
  { key: "halfyearly", label: "6 Months",    months: 6,  savePct: 13 },
  { key: "annual",     label: "Yearly",      months: 12, savePct: 17 },
];

// À la carte modules
const MODULES = [
  { key: "visitors",    icon: "👁️",  label: "Visitor Management",  desc: "OTP entry, walk-ins, trusted visitors" },
  { key: "maintenance", icon: "💰",  label: "Maintenance & Bills",  desc: "Billing, payments, defaulter tracking" },
  { key: "amenities",   icon: "🏊",  label: "Amenity Booking",      desc: "Gym, pool, clubhouse slots" },
  { key: "events",      icon: "🎉",  label: "Events",               desc: "RSVP, attendance tracking" },
  { key: "parking",     icon: "🅿️",  label: "Parking",              desc: "Slot assignment, visitor parking" },
  { key: "issues",      icon: "🔧",  label: "Issues & Complaints",  desc: "Complaint tracking, assignment" },
  { key: "community",   icon: "🤝",  label: "Community Help",       desc: "Resident-to-resident marketplace" },
  { key: "analytics",   icon: "📊",  label: "Analytics",            desc: "Reports, collection rates, trends" },
  { key: "multilang",   icon: "🌍",  label: "Multi-Language",       desc: "Hindi + Gujarati + English" },
];

const PLAN_ORDER = { trial: 0, free: 1, starter: 2, professional: 3, enterprise: 4 };

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  : null;

const computePrice = (baseMonthly, cycleKey) => {
  const c = CYCLES.find((x) => x.key === cycleKey) || CYCLES[0];
  if (cycleKey === "annual") return Math.round(baseMonthly * 10); // pay 10 get 12
  return Math.round(baseMonthly * c.months * (1 - c.savePct / 100));
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// Cycle switcher — tabs, not pills — sits above the plan cards
const CycleTabs = ({ selected, onChange }) => (
  <View style={cs.cycleBar}>
    {CYCLES.map((c) => {
      const on = selected === c.key;
      return (
        <TouchableOpacity
          key={c.key}
          style={[cs.cycleTab, on && cs.cycleTabOn]}
          onPress={() => onChange(c.key)}
          activeOpacity={0.7}
        >
          <Text style={[cs.cycleTabTxt, on && cs.cycleTabTxtOn]}>{c.label}</Text>
          {c.savePct > 0 && (
            <Text style={[cs.cycleSave, on && cs.cycleSaveOn]}>
              {c.key === "annual" ? "2mo free" : `${c.savePct}% off`}
            </Text>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
);

// Full-width plan card
const PlanCard = ({
  plan, cycle, isCurrentPlan, isUpgradable,
  customRate, onPay, paying,
}) => {
  const base  = customRate ?? plan.price;
  const total = computePrice(base, cycle);
  const months = CYCLES.find((c) => c.key === cycle)?.months ?? 1;
  const perMo  = Math.round(total / months);
  const saving = base * months - total;

  const isSelected = isCurrentPlan;
  const btnDisabled = isCurrentPlan || paying;

  return (
    <View style={[cs.planCard, plan.popular && cs.planCardPopular, { borderColor: plan.color + "55" }]}>
      {plan.popular && (
        <View style={[cs.popularBadge, { backgroundColor: plan.color }]}>
          <Text style={cs.popularBadgeTxt}>MOST POPULAR</Text>
        </View>
      )}

      <View style={cs.planCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[cs.planName, { color: plan.color }]}>{plan.label}</Text>
          <Text style={cs.planTagline}>{plan.tagline}</Text>
        </View>
        <View style={cs.planPriceBlock}>
          {customRate != null && (
            <Text style={cs.planOrigPrice}>₹{computePrice(plan.price, cycle)}</Text>
          )}
          {saving > 0 && customRate == null && (
            <Text style={cs.planSaveTag}>Save ₹{saving}</Text>
          )}
          <Text style={[cs.planPrice, { color: plan.color }]}>₹{total}</Text>
          <Text style={cs.planPriceSub}>
            {months > 1 ? `₹${perMo}/mo · ${months} months` : "per month"}
          </Text>
        </View>
      </View>

      <View style={cs.divider} />

      {plan.features.map((f, i) => (
        <View key={i} style={cs.featureRow}>
          <Text style={[cs.featureDot, { color: plan.color }]}>✓</Text>
          <Text style={cs.featureTxt}>{f}</Text>
        </View>
      ))}

      {customRate != null && (
        <View style={cs.customRateNote}>
          <Text style={cs.customRateNoteTxt}>🎉 Special pricing for your society</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          cs.planBtn,
          { backgroundColor: isCurrentPlan ? "#E2E8F0" : plan.color },
          btnDisabled && !isCurrentPlan && cs.planBtnLoading,
        ]}
        onPress={() => !btnDisabled && onPay(plan.key, cycle, total)}
        activeOpacity={0.8}
        disabled={btnDisabled}
      >
        {paying ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : isCurrentPlan ? (
          <Text style={[cs.planBtnTxt, { color: "#94A3B8" }]}>Current Plan</Text>
        ) : (
          <Text style={cs.planBtnTxt}>
            {isUpgradable ? `Upgrade · Pay ₹${total}` : `Get ${plan.label} · ₹${total}`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const UpgradeScreen = () => {
  const { plan: currentPlan, trialDaysLeft, user, refreshUser } = useAuth();

  const [moduleData,    setModuleData]    = useState(null);
  const [pricingData,   setPricingData]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const [cycle,         setCycle]         = useState("monthly");
  const [payingPlan,    setPayingPlan]    = useState(null); // key of plan being paid

  // À la carte
  const [checked,       setChecked]       = useState({});
  const [cartTotal,     setCartTotal]     = useState(null);
  const [cartLoading,   setCartLoading]   = useState(false);
  const [payingModules, setPayingModules] = useState(false);
  const cartDebounce = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [modRes, priceRes] = await Promise.allSettled([
        modulesApi.getStatus(),
        subscriptionPaymentApi.getMyPricing(),
      ]);
      if (modRes.status === "fulfilled")   setModuleData(modRes.value.data || modRes.value);
      if (priceRes.status === "fulfilled") setPricingData(priceRes.value.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Cart total: fetch when checked modules change ──────────────────────────
  const checkedKeys = Object.keys(checked).filter((k) => checked[k]);

  useEffect(() => {
    if (checkedKeys.length === 0) { setCartTotal(null); return; }
    clearTimeout(cartDebounce.current);
    cartDebounce.current = setTimeout(async () => {
      setCartLoading(true);
      try {
        const res = await subscriptionPaymentApi.getModulesPreview(checkedKeys);
        setCartTotal(res.data);
      } catch { setCartTotal(null); }
      finally { setCartLoading(false); }
    }, 350);
  }, [checkedKeys.join(",")]);

  const toggleModule = (key) => setChecked((p) => {
    const n = { ...p };
    if (n[key]) delete n[key]; else n[key] = true;
    return n;
  });

  // ── Plan payment ───────────────────────────────────────────────────────────
  const handlePlanPay = async (planKey, billingCycle, amountRupees) => {
    const planLabel = PLANS.find((p) => p.key === planKey)?.label || planKey;
    const isUpgrade = PLAN_ORDER[planKey] > PLAN_ORDER[currentPlan];

    setPayingPlan(planKey);
    try {
      const result = isUpgrade
        ? await payUpgrade({ plan: planKey, billingCycle, user: { name: user?.name, email: user?.email, phone: user?.phone } })
        : await paySubscription({ plan: planKey, billingCycle, user: { name: user?.name, email: user?.email, phone: user?.phone } });

      if (result.success) {
        Alert.alert("You're all set! 🎉", `${planLabel} plan is now active.`);
        loadAll(); refreshUser();
      } else if (!result.cancelled) {
        Alert.alert("Payment failed", result.error || "Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setPayingPlan(null);
    }
  };

  // ── Module payment ─────────────────────────────────────────────────────────
  const handleModulesPay = async () => {
    if (checkedKeys.length === 0) return;
    setPayingModules(true);
    try {
      const result = await payForModules({
        modules: checkedKeys,
        user: { name: user?.name, email: user?.email, phone: user?.phone },
      });
      if (result.success) {
        const names = checkedKeys.map((k) => MODULES.find((m) => m.key === k)?.label || k);
        Alert.alert("Activated! 🎉",
          names.length === 1 ? `${names[0]} is now active.` : `${names.join(", ")} are now active.`);
        setChecked({});
        setCartTotal(null);
        loadAll();
      } else if (!result.cancelled) {
        Alert.alert("Payment failed", result.error || "Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setPayingModules(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <View style={cs.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const modules          = moduleData?.modules || {};
  const modulePricing    = pricingData?.modulePricing || {};
  const customRate       = pricingData?.isCustomPricing ? pricingData.customMonthlyRupees : null;
  const renewalDate      = pricingData?.renewalDate;
  const pendingPlan      = pricingData?.pendingPlan;
  const pendingPlanAt    = pricingData?.pendingPlanAt;

  const activeEnabledPaid = MODULES.filter((m) => modules[m.key]?.enabled && !modules[m.key]?.isFree);
  const lockablePaid      = MODULES.filter((m) => !modules[m.key]?.enabled && !modules[m.key]?.isFree);
  const freeMods          = MODULES.filter((m) => modules[m.key]?.isFree);

  // Plans to show: only higher than current
  const upgradablePlans = PLANS.filter((p) => PLAN_ORDER[p.key] > PLAN_ORDER[currentPlan || "free"]);
  const onEnterprise    = currentPlan === "enterprise";

  return (
    <SafeAreaView style={cs.container} edges={["bottom"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
        contentContainerStyle={cs.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Status bar ── */}
        <View style={cs.statusBar}>
          {currentPlan === "trial" ? (
            <>
              <Text style={cs.statusEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={cs.statusTitle}>Free Trial — {trialDaysLeft ?? "—"} days left</Text>
                <Text style={cs.statusSub}>All features unlocked. Pick a plan to keep them.</Text>
              </View>
            </>
          ) : currentPlan === "free" ? (
            <>
              <Text style={cs.statusEmoji}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={cs.statusTitle}>Free Plan</Text>
                <Text style={cs.statusSub}>Notices, Polls & Contacts always free. Upgrade for more.</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={cs.statusEmoji}>✓</Text>
              <View style={{ flex: 1 }}>
                <Text style={cs.statusTitle}>{currentPlan?.charAt(0).toUpperCase() + currentPlan?.slice(1)} Plan</Text>
                <Text style={cs.statusSub}>
                  {renewalDate ? `Renews ${fmtDate(renewalDate)}` : "Active"}
                  {pendingPlan ? `  ·  Downgrading to ${pendingPlan} on ${fmtDate(pendingPlanAt)}` : ""}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Section 1: PLAN CARDS ── */}
        {!onEnterprise && upgradablePlans.length > 0 && (
          <View style={cs.section}>
            <Text style={cs.sectionHeading}>Choose a Plan</Text>

            {/* Billing cycle selector — ONE place, above all cards */}
            <CycleTabs selected={cycle} onChange={setCycle} />

            {upgradablePlans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                cycle={cycle}
                isCurrentPlan={plan.key === currentPlan}
                isUpgradable={PLAN_ORDER[plan.key] > PLAN_ORDER[currentPlan]}
                customRate={customRate}
                onPay={handlePlanPay}
                paying={payingPlan === plan.key}
              />
            ))}

            <Text style={cs.footNote}>
              Cancel anytime · Secure checkout via Razorpay · GST applicable
            </Text>
          </View>
        )}

        {/* ── Section 2: BUILD YOUR OWN (à la carte) ── */}
        {lockablePaid.length > 0 && (
          <View style={cs.section}>
            <Text style={cs.sectionHeading}>Build Your Own</Text>
            <Text style={cs.sectionSub}>
              Just want specific features? Pick only what you need.
            </Text>

            {lockablePaid.map((mod) => {
              const isOn    = !!checked[mod.key];
              const mPrice  = modulePricing[mod.key];
              const price   = mPrice?.amountRupees ?? 0;

              return (
                <TouchableOpacity
                  key={mod.key}
                  style={[cs.modRow, isOn && cs.modRowOn]}
                  onPress={() => toggleModule(mod.key)}
                  activeOpacity={0.7}
                >
                  {/* Checkbox */}
                  <View style={[cs.cb, isOn && cs.cbOn]}>
                    {isOn && <Text style={cs.cbTick}>✓</Text>}
                  </View>

                  <Text style={[cs.modIcon, { opacity: isOn ? 1 : 0.5 }]}>{mod.icon}</Text>

                  <View style={cs.modBody}>
                    <Text style={[cs.modLabel, isOn && cs.modLabelOn]}>{mod.label}</Text>
                    <Text style={cs.modDesc}>{mod.desc}</Text>
                  </View>

                  <View style={cs.modPrice}>
                    <Text style={[cs.modPriceAmt, isOn && { color: "#0D7377" }]}>
                      ₹{price}
                    </Text>
                    <Text style={cs.modPricePer}>/mo</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Sticky cart footer */}
            {checkedKeys.length > 0 && (
              <View style={cs.cart}>
                <View style={cs.cartLeft}>
                  <Text style={cs.cartItems}>
                    {checkedKeys.length} module{checkedKeys.length > 1 ? "s" : ""} selected
                  </Text>
                  {cartLoading ? (
                    <Text style={cs.cartTotal}>Calculating…</Text>
                  ) : cartTotal ? (
                    <Text style={cs.cartTotal}>₹{cartTotal.amountRupees} / month</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[cs.cartBtn, (payingModules || cartLoading) && cs.cartBtnOff]}
                  onPress={handleModulesPay}
                  disabled={payingModules || cartLoading}
                >
                  {payingModules
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={cs.cartBtnTxt}>
                        Pay ₹{cartTotal?.amountRupees ?? "…"}
                      </Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Section 3: What you already have ── */}
        {(activeEnabledPaid.length > 0 || freeMods.length > 0) && (
          <View style={cs.section}>
            <Text style={cs.sectionHeading}>What You Have</Text>

            {activeEnabledPaid.map((mod) => (
              <View key={mod.key} style={cs.haveRow}>
                <Text style={cs.haveIcon}>{mod.icon}</Text>
                <Text style={cs.haveLabel}>{mod.label}</Text>
                <View style={cs.activePill}><Text style={cs.activePillTxt}>Active</Text></View>
              </View>
            ))}

            {freeMods.map((mod) => (
              <View key={mod.key} style={cs.haveRow}>
                <Text style={cs.haveIcon}>{mod.icon}</Text>
                <Text style={cs.haveLabel}>{mod.label}</Text>
                <View style={cs.freePill}><Text style={cs.freePillTxt}>Free</Text></View>
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
const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll:    { paddingHorizontal: 16, paddingTop: 12 },

  // Status bar
  statusBar:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F2040", borderRadius: 14, padding: 14, marginBottom: 20 },
  statusEmoji: { fontSize: 22, color: "#fff" },
  statusTitle: { fontSize: 15, fontWeight: "800", color: "#fff" },
  statusSub:   { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, lineHeight: 16 },

  // Sections
  section:        { marginBottom: 24 },
  sectionHeading: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  sectionSub:     { fontSize: 13, color: "#64748B", marginBottom: 14, lineHeight: 18 },
  footNote:       { fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 4 },

  // Cycle tabs
  cycleBar:       { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 3, marginBottom: 16 },
  cycleTab:       { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  cycleTabOn:     { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cycleTabTxt:    { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  cycleTabTxtOn:  { color: "#1E293B" },
  cycleSave:      { fontSize: 9, fontWeight: "700", color: "#94A3B8", marginTop: 1 },
  cycleSaveOn:    { color: "#10B981" },

  // Plan cards
  planCard:        { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1.5, borderColor: "#E2E8F0", padding: 18, marginBottom: 14, overflow: "hidden" },
  planCardPopular: { borderWidth: 2 },

  popularBadge:    { position: "absolute", top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 5, borderBottomLeftRadius: 12 },
  popularBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  planCardTop:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  planName:       { fontSize: 20, fontWeight: "800" },
  planTagline:    { fontSize: 12, color: "#64748B", marginTop: 3, lineHeight: 16 },
  planPriceBlock: { alignItems: "flex-end" },
  planPrice:      { fontSize: 28, fontWeight: "800" },
  planPriceSub:   { fontSize: 11, color: "#64748B", marginTop: 2, textAlign: "right" },
  planOrigPrice:  { fontSize: 12, color: "#94A3B8", textDecorationLine: "line-through", textAlign: "right" },
  planSaveTag:    { fontSize: 11, fontWeight: "700", color: "#10B981", textAlign: "right" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 },

  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 },
  featureDot: { fontSize: 13, fontWeight: "800", marginTop: 1 },
  featureTxt: { fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 },

  customRateNote:    { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 8, marginTop: 10 },
  customRateNoteTxt: { fontSize: 12, fontWeight: "700", color: "#92400E" },

  planBtn:       { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  planBtnLoading:{ opacity: 0.7 },
  planBtnTxt:    { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Module rows (à la carte)
  modRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: "#E2E8F0" },
  modRowOn:    { borderColor: "#0D7377", backgroundColor: "#F0FDFC" },
  cb:          { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#CBD5E1", marginRight: 12, alignItems: "center", justifyContent: "center" },
  cbOn:        { backgroundColor: "#0D7377", borderColor: "#0D7377" },
  cbTick:      { color: "#fff", fontSize: 13, fontWeight: "900" },
  modIcon:     { fontSize: 22, marginRight: 12 },
  modBody:     { flex: 1 },
  modLabel:    { fontSize: 14, fontWeight: "700", color: "#475569" },
  modLabelOn:  { color: "#0F2040" },
  modDesc:     { fontSize: 12, color: "#94A3B8", marginTop: 2, lineHeight: 16 },
  modPrice:    { alignItems: "flex-end", minWidth: 44 },
  modPriceAmt: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  modPricePer: { fontSize: 10, color: "#94A3B8" },

  // Cart bar
  cart:       { backgroundColor: "#0F2040", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  cartLeft:   { flex: 1 },
  cartItems:  { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 2 },
  cartTotal:  { color: "#fff", fontSize: 20, fontWeight: "800" },
  cartBtn:    { backgroundColor: "#0D7377", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  cartBtnOff: { opacity: 0.6 },
  cartBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // What you have
  haveRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  haveIcon:      { fontSize: 20, width: 28, textAlign: "center" },
  haveLabel:     { flex: 1, fontSize: 14, fontWeight: "600", color: "#1E293B" },
  activePill:    { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activePillTxt: { fontSize: 11, fontWeight: "700", color: "#065F46" },
  freePill:      { backgroundColor: "#DBEAFE", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  freePillTxt:   { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
});

export default UpgradeScreen;