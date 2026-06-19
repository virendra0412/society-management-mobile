/**
 * screens/home/HomeScreen.jsx
 * Main dashboard. Mirrors web HomeScreen.
 *
 * Sections:
 *  - Gradient hero with user greeting + live stats
 *  - Due Bill highlight banner (TC-HOME-02 — new, was a product gap on both platforms)
 *  - Quick action grid (role-aware)
 *  - Urgent notice banner
 *  - Recent issues list (latest 3)
 *  - Community help posts (latest 2)
 *
 * TC-HOME-02 fix:
 *   Fetches maintenanceApi.getMyBills({ isPublished: true, limit: 10 }) alongside
 *   the existing calls. If any bill has an unpaid/overdue payment record for this
 *   resident it shows a red/amber "Due Bill" banner above Quick Actions that deep-
 *   links to the Maintenance tab. Silently suppressed if the API call fails (no
 *   error shown to user — dashboard should never break because of a billing fetch).
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions,
} from "react-native";
import { SafeAreaView }  from "react-native-safe-area-context";
import { Ionicons }      from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth }     from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { issuesApi, helpApi, noticesApi, maintenanceApi } from "../../api/resources.api";
import {
  Badge, Card, Spinner, EmptyState, Modal,
} from "../../components/ui";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import {
  C, STATUS_COLOR, CATEGORY_ICON, NOTICE_TAG_COLOR,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

const { width } = Dimensions.get("window");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString("en-IN")}`
    : "—";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

// ─── Stat box inside hero ─────────────────────────────────────────────────────
const StatBox = ({ icon, count, label, loading }) => (
  <View style={styles.statBox}>
    <Text style={styles.statIcon}>{icon}</Text>
    {loading
      ? <Spinner size={18} color="#fff" />
      : <Text style={styles.statCount}>{count ?? 0}</Text>
    }
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Quick Action grid ────────────────────────────────────────────────────────
// Renders all actions in strict 4-per-row layout.
// Calculates tile width from screen width minus container padding and gaps
// so tiles NEVER wrap to a new line unexpectedly.
const COLS        = 4;
const H_PADDING   = 32;   // styles.body paddingHorizontal * 2
const GAP         = 8;
const TILE_WIDTH  = (width - H_PADDING - GAP * (COLS - 1)) / COLS;

const QuickActionGrid = ({ actions }) => {
  // Pad to a full row so the last row aligns left (no stretching)
  const remainder = actions.length % COLS;
  const padded = remainder === 0
    ? actions
    : [...actions, ...Array(COLS - remainder).fill(null)];

  // Chunk into rows of 4
  const rows = [];
  for (let i = 0; i < padded.length; i += COLS) {
    rows.push(padded.slice(i, i + COLS));
  }

  return (
    <View style={{ marginBottom: 12, gap: GAP }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: GAP }}>
          {row.map((action, ci) =>
            action ? (
              <TouchableOpacity
                key={ci}
                onPress={action.onPress}
                activeOpacity={0.75}
                style={[
                  styles.quickTile,
                  { borderColor: action.color + "30", backgroundColor: action.color + "10" },
                ]}
              >
                <Text style={styles.quickIcon}>{action.icon}</Text>
                <Text style={[styles.quickLabel, { color: action.color }]} numberOfLines={2}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ) : (
              // Invisible spacer to keep alignment
              <View key={`pad-${ci}`} style={{ width: TILE_WIDTH }} />
            )
          )}
        </View>
      ))}
    </View>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, onSeeAll, t }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAll}>{t("home_see_all")}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Due Bill Banner (TC-HOME-02) ─────────────────────────────────────────────
// Shows when the resident has one or more unpaid/overdue bills.
// dueBills: array of { title, dueDate, totalDue, status, isOverdue }
const DueBillBanner = ({ dueBills, onPress }) => {
  const { t } = useLanguage();
  if (!dueBills || dueBills.length === 0) return null;

  const hasOverdue  = dueBills.some((b) => b.isOverdue);
  const totalDue    = dueBills.reduce((s, b) => s + (b.totalDue || 0), 0);
  const accent      = hasOverdue ? C.red : C.amber;
  const eyebrow     = hasOverdue ? "⚠️  OVERDUE BILL" : "💰  DUE BILL";
  const countLabel  = dueBills.length > 1 ? `${dueBills.length} ${t("home_bills_pending", "bills pending")}` : dueBills[0].title;
  const dueDateText = dueBills.length === 1
    ? `${t("home_due", "Due")} ${fmtDate(dueBills[0].dueDate)}`
    : `${t("home_earliest_due", "Earliest due")} ${fmtDate(dueBills.reduce((min, b) => b.dueDate < min ? b.dueDate : min, dueBills[0].dueDate))}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.dueBanner, { borderColor: accent + "40", backgroundColor: accent + "0C" }]}
    >
      <View style={[styles.dueIconBox, { backgroundColor: accent + "20" }]}>
        <Text style={{ fontSize: 22 }}>{hasOverdue ? "🚨" : "💸"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.dueEyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={styles.dueTitle} numberOfLines={1}>{countLabel}</Text>
        <Text style={[styles.dueSub, { color: accent }]}>
          {fmt(totalDue)}  ·  {dueDateText}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={accent} />
    </TouchableOpacity>
  );
};

// ─── Trial Countdown Banner ───────────────────────────────────────────────────
// Shows orange warning when trial has ≤ 7 days remaining.
// Hides after trial expires (plan becomes "free").
const TrialBanner = ({ plan, daysLeft, onPress, t }) => {
  // Only show if plan is "trial" and <= 7 days left
  if (plan !== "trial" || !daysLeft || daysLeft > 7) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.trialBanner, { borderColor: C.amber + "40", backgroundColor: C.amber + "0C" }]}
    >
      <View style={[styles.trialIconBox, { backgroundColor: C.amber + "20" }]}>
        <Text style={{ fontSize: 22 }}>⏳</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.trialEyebrow, { color: C.amber }]}>⏰  {t("home_trial_warning")}</Text>
        <Text style={styles.trialTitle}>
          {daysLeft} {daysLeft === 1 ? t("home_trial_day_singular", "day") : t("home_trial_day_plural", "days")} {t("home_trial_days_left")}
        </Text>
        <Text style={[styles.trialSub, { color: C.amber }]}>
          {daysLeft <= 3 ? t("home_trial_upgrade_cta", "Upgrade now to avoid losing access to premium features") : t("home_trial_info_cta", "Tap to see what's included after trial")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.amber} />
    </TouchableOpacity>
  );
};

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export const HomeScreen = () => {
  const { user, isAdmin, hasPermission, committeeTitle, memberships, switchSociety, activeSocietyId, plan, trialDaysLeft, dataVersion } = useAuth();
  const { t }             = useLanguage();
  const navigation        = useNavigation();

  const [issues,    setIssues]    = useState([]);
  const [help,      setHelp]      = useState([]);
  const [notices,   setNotices]   = useState([]);
  const [dueBills,  setDueBills]  = useState([]);   // TC-HOME-02
  const [loading,   setLoading]   = useState(true);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching,    setSwitching]    = useState(null);

  const load = useCallback(async () => {
      setLoading(true);
      try {
        const [iRes, hRes, nRes, mRes] = await Promise.allSettled([
          issuesApi.getAll({ limit: 3, sort: "-createdAt" }),
          helpApi.getAll({ limit: 2 }),
          noticesApi.getAll({ limit: 5 }),
          maintenanceApi.getMyBills({ isPublished: true, limit: 20 }),
        ]);

        if (iRes.status === "fulfilled") setIssues(iRes.value.data?.issues   || []);
        if (hRes.status === "fulfilled") setHelp(hRes.value.data?.posts     || []);
        if (nRes.status === "fulfilled") setNotices(nRes.value.data?.notices || []);

        if (mRes.status === "fulfilled") {
          const bills = mRes.value.data?.bills || [];
          const now   = new Date();
          const unpaid = bills
            .filter((b) => {
              const myPay = Array.isArray(b.payments) ? b.payments[0] : null;
              if (!myPay) return false;
              return myPay.status === "unpaid" || myPay.status === "overdue";
            })
            .map((b) => {
              const myPay = b.payments[0];
              return {
                _id:      b._id,
                title:    b.title || t("home_maintenance_bill_fallback", "Maintenance Bill"),
                dueDate:  b.dueDate,
                totalDue: myPay?.totalDue ?? b.baseAmount ?? 0,
                status:   myPay?.status,
                isOverdue: b.dueDate ? new Date(b.dueDate) < now : false,
              };
            });
          setDueBills(unpaid);
        }
      } finally {
        setLoading(false);
      }
    }, [dataVersion, t]);

  useEffect(() => { load(); }, [load]);

  // Refresh notices (and all data) every time user navigates back to Home tab
  // This fixes the stale notice banner showing deleted/edited notices
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCount    = issues.filter((i) => i.status !== "Resolved").length;
  const urgentNotice = notices.find((n) => n.tag === "Urgent") || notices[0];

  // Navigate to a root tab
  const go = (tab) => navigation.navigate(tab);
  // Navigate to a screen nested inside the More tab's stack
  const goMore = (screen) => navigation.navigate("More", { screen });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero Banner ── */}
        <View style={styles.hero}>
          {/* Top row: greeting + language switcher */}
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>{t("home_welcome")} 👋</Text>
            <LanguageDropdown />
          </View>
          <Text style={styles.heroName}>{user?.name || "—"}</Text>
          <TouchableOpacity
            onPress={() => memberships.length > 1 ? setShowSwitcher(true) : goMore("Profile")}
            activeOpacity={0.75}
            style={styles.heroSocietyButton}
          >
            <Text style={styles.heroSub} numberOfLines={1}>
              {user?.society?.name || user?.activeSocietyId?.name || t("home_no_society", "No society")}
              {user?.flat ? ` · ${t("home_flat", "Flat")} ${user.flat}` : ""}
            </Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>

          {/* ── Society Switcher Bottom Sheet ─────────────────────────────── */}
          <Modal
            visible={showSwitcher}
            transparent
            animationType="slide"
            onRequestClose={() => setShowSwitcher(false)}
          >
            <TouchableOpacity
              style={styles.switcherBackdrop}
              activeOpacity={1}
              onPress={() => setShowSwitcher(false)}
            >
              <View style={styles.switcherSheet}>
                <View style={styles.switcherHandle} />
                <Text style={styles.switcherTitle}>{t("home_your_societies", "Your Societies")}</Text>
                {memberships.map((m) => {
                  const soc  = m.society || {};
                  const sid  = soc?._id?.toString() || m.society?.toString();
                  const isActive = sid === (activeSocietyId?.toString() || activeSocietyId);
                  const isBusy   = switching === sid;
                  return (
                    <TouchableOpacity
                      key={sid}
                      style={[styles.switcherRow, isActive && styles.switcherRowActive]}
                      activeOpacity={isActive ? 1 : 0.7}
                      onPress={async () => {
                        if (isActive || isBusy) return;
                        setSwitching(sid);
                        try { await switchSociety(sid); setShowSwitcher(false); }
                        catch { /* keep sheet open on error */ }
                        finally { setSwitching(null); }
                      }}
                    >
                      <View style={[styles.switcherAvatar, isActive && styles.switcherAvatarActive]}>
                        <Text style={[styles.switcherAvatarText, isActive && { color: C.teal }]}>
                          {(soc?.name || "?").split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switcherName} numberOfLines={1}>{soc?.name || "Unknown"}</Text>
                        <Text style={styles.switcherMeta}>
                          {[m.flat && `${t("home_flat", "Flat")} ${m.flat}`, m.wing && `${t("home_wing", "Wing")} ${m.wing}`].filter(Boolean).join(" · ")}
                          {!m.isApproved ? ` · ${t("home_pending", "Pending")}` : ""}
                        </Text>
                      </View>
                      {isActive
                        ? <Ionicons name="checkmark-circle" size={20} color={C.teal} />
                        : isBusy
                        ? <Ionicons name="hourglass-outline" size={18} color={C.gray400} />
                        : <Ionicons name="chevron-forward" size={18} color={C.gray400} />
                      }
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.switcherAddBtn}
                  onPress={() => { setShowSwitcher(false); goMore("Profile"); }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={C.teal} />
                  <Text style={styles.switcherAddText}>{t("home_join_society", "Join another society")}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatBox icon="🔴" count={openCount}      label={t("home_open_issues")} loading={loading} />
            <StatBox icon="📢" count={notices.length} label={t("home_notices")}     loading={loading} />
            <StatBox icon="🤝" count={help.length}    label={t("home_help_posts")}  loading={loading} />
          </View>
        </View>

        <View style={styles.body}>

          {/* ── Due Bill Banner (TC-HOME-02) ── */}
          {!loading && !isAdmin && (
            <DueBillBanner
              dueBills={dueBills}
              onPress={() => go("Maintenance")}
            />
          )}

          {/* ── Trial Countdown Banner ── */}
          {!loading && (
            <TrialBanner
              plan={plan}
              daysLeft={trialDaysLeft}
              onPress={() => goMore("Upgrade")}
              t={t}
            />
          )}

          {/* ── Quick Actions ── */}
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>{t("home_quick_actions")}</Text>
          <QuickActionGrid
            actions={[
              { icon: "🔴", label: t("home_report_issue"),          color: C.red,     onPress: () => go("Issues") },
              { icon: "🤝", label: t("home_ask_help"),              color: C.amber,   onPress: () => goMore("Help") },
              { icon: "📢", label: t("nav_notices"),                color: C.teal,    onPress: () => goMore("Notices") },
              { icon: "🗳️", label: t("nav_polls"),                  color: C.purple,  onPress: () => goMore("Polls") },
              { icon: "🎉", label: t("nav_events",  "Events"),      color: "#D97706", onPress: () => goMore("Events") },
              { icon: "🚗", label: t("nav_parking", "Parking"),     color: C.navy,    onPress: () => goMore("Parking") },
              { icon: "🏊", label: t("nav_amenities", "Amenities"), color: C.teal,    onPress: () => goMore("Amenity") },
              { icon: "👤", label: t("btn_profile", "Profile"),     color: C.gray700, onPress: () => goMore("Profile") },
              // Committee-aware actions — shown based on module permissions
              ...(hasPermission("notices", "write") ? [
                { icon: "📋", label: t("home_post_notice", "Post Notice"), color: C.navy,  onPress: () => goMore("Notices") },
              ] : []),
              ...(hasPermission("maintenance", "read") ? [
                { icon: "💰", label: t("home_billing", "Billing"),     color: C.teal,  onPress: () => go("Maintenance") },
              ] : []),
              ...(isAdmin ? [
                { icon: "👑", label: t("nav_admin", "Approvals"),   color: C.amber, onPress: () => go("Admin") },
                { icon: "🛡️", label: t("home_committee", "Committee"),   color: C.purple, onPress: () => goMore("Committee") },
              ] : []),
            ]}
          />

          {/* ── Urgent Notice Banner ── */}
          {urgentNotice && (
            <TouchableOpacity
              onPress={() => goMore("Notices")}
              activeOpacity={0.85}
              style={[styles.urgentBanner, { borderColor: (NOTICE_TAG_COLOR[urgentNotice.tag] || C.red) + "40" }]}
            >
              <Text style={styles.urgentIcon}>📢</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgentEyebrow, { color: NOTICE_TAG_COLOR[urgentNotice.tag] || C.red }]}>
                  {urgentNotice.tag === "Urgent" ? t("home_urgent_notice", "URGENT NOTICE") : t("home_latest_notice", "LATEST NOTICE")}
                </Text>
                <Text style={styles.urgentTitle} numberOfLines={1}>{urgentNotice.title}</Text>
                <Text style={styles.urgentBody} numberOfLines={2}>{urgentNotice.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.gray300} />
            </TouchableOpacity>
          )}

          {/* ── Recent Issues ── */}
          <SectionHeader title={t("home_recent_issues")} onSeeAll={() => go("Issues")} t={t} />
          {loading
            ? <View style={styles.skeleton} />
            : issues.length === 0
              ? <EmptyState icon="✅" message={t("home_no_issues")} />
              : issues.map((issue) => (
                <Card key={issue._id} style={{ marginBottom: 8 }}>
                  <View style={styles.issueRow}>
                    <Text style={styles.issueIcon}>{CATEGORY_ICON[issue.category] || "📋"}</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
                      <Text style={styles.issueSub}>
                        {issue.isAnonymous ? t("home_anonymous", "Anonymous") : (issue.flat || issue.reporter?.flat || "—")}
                        {" · "}{timeAgo(issue.createdAt)}
                      </Text>
                    </View>
                    <Badge
                      label={issue.status}
                      {...(STATUS_COLOR[issue.status] || {})}
                    />
                  </View>
                </Card>
              ))
          }

          {/* ── Community Help ── */}
          <SectionHeader title={t("home_community")} onSeeAll={() => goMore("Help")} t={t} />
          {loading
            ? <View style={[styles.skeleton, { height: 64 }]} />
            : help.length === 0
              ? <EmptyState icon="🤝" message={t("home_no_help")} />
              : help.map((h) => (
                <Card key={h._id} style={{ marginBottom: 8 }}>
                  <View style={styles.helpRow}>
                    <View style={styles.helpAvatar}>
                      <Text style={{ fontSize: 18 }}>🤝</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.helpTitle} numberOfLines={1}>{h.title}</Text>
                      <Text style={styles.helpSub}>
                        {h.flat || h.author?.flat || "—"}
                        {" · "}{h.replyCount ?? 0} {t("home_replies", "replies")}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.navy },
  scroll: { paddingBottom: 32 },

  // Hero
  hero:        { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  heroTopRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  heroEyebrow: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "600", letterSpacing: 0.6 },
  heroName:    { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 2 },
  heroSocietyButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%", marginBottom: 20 },

  // Society switcher sheet
  switcherBackdrop:     { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  switcherSheet:        { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  switcherHandle:       { width: 36, height: 4, backgroundColor: C.gray200, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  switcherTitle:        { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 12 },
  switcherRow:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  switcherRowActive:    { opacity: 1 },
  switcherAvatar:       { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gray100, alignItems: "center", justifyContent: "center" },
  switcherAvatarActive: { backgroundColor: C.teal + "20" },
  switcherAvatarText:   { fontSize: 13, fontWeight: "700", color: C.gray500 },
  switcherName:         { fontSize: 14, fontWeight: "600", color: C.text },
  switcherMeta:         { fontSize: 12, color: C.gray500, marginTop: 1 },
  switcherAddBtn:       { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 14 },
  switcherAddText:      { fontSize: 14, color: C.teal, fontWeight: "600" },
  heroSub:     { fontSize: 13, color: "rgba(255,255,255,0.55)", flexShrink: 1 },
  statsRow:    { flexDirection: "row", gap: 10 },
  statBox:     { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, alignItems: "center" },
  statIcon:    { fontSize: 18, marginBottom: 4 },
  statCount:   { fontSize: 20, fontWeight: "800", color: "#fff", lineHeight: 24 },
  statLabel:   { fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2, textAlign: "center" },

  // Body
  body: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -16, paddingTop: 20, paddingHorizontal: 16 },

  // Due bill banner (TC-HOME-02)
  dueBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 13, borderWidth: 1.5, marginBottom: 14,
  },
  dueIconBox:  { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dueEyebrow:  { fontSize: 9, fontWeight: "800", letterSpacing: 0.9, marginBottom: 2 },
  dueTitle:    { fontSize: 13, fontWeight: "700", color: C.navy, marginBottom: 2 },
  dueSub:      { fontSize: 12, fontWeight: "600" },

  // Trial countdown banner
  trialBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 13, borderWidth: 1.5, marginBottom: 14,
  },
  trialIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  trialEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 0.9, marginBottom: 2 },
  trialTitle:   { fontSize: 13, fontWeight: "700", color: C.navy, marginBottom: 2 },
  trialSub:     { fontSize: 12, fontWeight: "600" },

  // Quick actions
  quickTile: {
    width: TILE_WIDTH,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  quickIcon:  { fontSize: 22 },
  quickLabel: { fontSize: 10, fontWeight: "700", textAlign: "center", lineHeight: 13 },

  // Section header
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 8 },
  sectionTitle:  { fontSize: 13, fontWeight: "700", color: C.gray700 },
  seeAll:        { fontSize: 12, color: C.teal, fontWeight: "600" },

  // Urgent notice
  urgentBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    borderWidth: 1.5, marginBottom: 8,
  },
  urgentIcon:    { fontSize: 24 },
  urgentEyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  urgentTitle:   { fontSize: 14, fontWeight: "700", color: C.navy, marginTop: 1 },
  urgentBody:    { fontSize: 12, color: C.gray500, marginTop: 2, lineHeight: 17 },

  // Issue card row
  issueRow:  { flexDirection: "row", alignItems: "center" },
  issueIcon: { fontSize: 24 },
  issueTitle:{ fontSize: 13, fontWeight: "700", color: C.text },
  issueSub:  { fontSize: 11, color: C.gray500, marginTop: 2 },

  // Help card row
  helpRow:   { flexDirection: "row", alignItems: "center" },
  helpAvatar:{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.amber + "18", alignItems: "center", justifyContent: "center" },
  helpTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  helpSub:   { fontSize: 11, color: C.gray500, marginTop: 2 },

  // Skeleton
  skeleton: { height: 90, backgroundColor: C.gray100, borderRadius: 14, marginBottom: 8 },
});