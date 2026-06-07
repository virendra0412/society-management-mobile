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
import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, Modal,
} from "react-native";
import { SafeAreaView }  from "react-native-safe-area-context";
import { Ionicons }      from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAuth }     from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { issuesApi, helpApi, noticesApi, maintenanceApi } from "../../api/resources.api";
import {
  Badge, Card, Spinner, EmptyState,
} from "../../components/ui";
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
const SectionHeader = ({ title, onSeeAll }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAll}>See all →</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Due Bill Banner (TC-HOME-02) ─────────────────────────────────────────────
// Shows when the resident has one or more unpaid/overdue bills.
// dueBills: array of { title, dueDate, totalDue, status, isOverdue }
const DueBillBanner = ({ dueBills, onPress }) => {
  if (!dueBills || dueBills.length === 0) return null;

  const hasOverdue  = dueBills.some((b) => b.isOverdue);
  const totalDue    = dueBills.reduce((s, b) => s + (b.totalDue || 0), 0);
  const accent      = hasOverdue ? C.red : C.amber;
  const eyebrow     = hasOverdue ? "⚠️  OVERDUE BILL" : "💰  DUE BILL";
  const countLabel  = dueBills.length > 1 ? `${dueBills.length} bills pending` : dueBills[0].title;
  const dueDateText = dueBills.length === 1
    ? `Due ${fmtDate(dueBills[0].dueDate)}`
    : `Earliest due ${fmtDate(dueBills.reduce((min, b) => b.dueDate < min ? b.dueDate : min, dueBills[0].dueDate))}`;

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

// ─── Language options (shared with MoreScreen) ────────────────────────────────
const LOCALES = [
  { code: "en", native: "English",  label: "English"  },
  { code: "hi", native: "हिंदी",    label: "Hindi"    },
  { code: "gu", native: "ગુજરાતી", label: "Gujarati" },
];

// ─── Language Dropdown ────────────────────────────────────────────────────────
const LanguageDropdown = () => {
  const { locale, changeLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={langStyles.pill}
      >
        <Text style={langStyles.pillText}>🌐 {current.native}</Text>
        <Text style={langStyles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={langStyles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={langStyles.sheet}>
            <Text style={langStyles.sheetTitle}>Select Language</Text>
            {LOCALES.map((loc) => {
              const active = locale === loc.code;
              return (
                <TouchableOpacity
                  key={loc.code}
                  onPress={() => { changeLocale(loc.code); setOpen(false); }}
                  activeOpacity={0.75}
                  style={[langStyles.option, active && langStyles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[langStyles.optionNative, active && { color: C.teal }]}>
                      {loc.native}
                    </Text>
                    <Text style={langStyles.optionLabel}>{loc.label}</Text>
                  </View>
                  {active && <Text style={langStyles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const langStyles = StyleSheet.create({
  pill:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillText:     { fontSize: 12, fontWeight: "700", color: "#fff" },
  arrow:        { fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle:   { fontSize: 13, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 },
  option:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionActive: { backgroundColor: C.teal + "12" },
  optionNative: { fontSize: 17, fontWeight: "700", color: C.navy },
  optionLabel:  { fontSize: 12, color: C.gray500, marginTop: 2 },
  check:        { fontSize: 16, color: C.teal, fontWeight: "700" },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export const HomeScreen = () => {
  const { user, isAdmin, hasPermission, committeeTitle } = useAuth();
  const { t }             = useLanguage();
  const navigation        = useNavigation();

  const [issues,    setIssues]    = useState([]);
  const [help,      setHelp]      = useState([]);
  const [notices,   setNotices]   = useState([]);
  const [dueBills,  setDueBills]  = useState([]);   // TC-HOME-02
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [iRes, hRes, nRes, mRes] = await Promise.allSettled([
          issuesApi.getAll({ limit: 3, sort: "-createdAt" }),
          helpApi.getAll({ limit: 2 }),
          noticesApi.getAll({ limit: 5 }),
          // TC-HOME-02: fetch resident's own bills — silently ignored on failure
          maintenanceApi.getMyBills({ isPublished: true, limit: 20 }),
        ]);

        if (iRes.status === "fulfilled") setIssues(iRes.value.data?.issues   || []);
        if (hRes.status === "fulfilled") setHelp(hRes.value.data?.posts     || []);
        if (nRes.status === "fulfilled") setNotices(nRes.value.data?.notices || []);

        // TC-HOME-02 — derive unpaid/overdue bills from the resident's payment records
        if (mRes.status === "fulfilled") {
          const bills = mRes.value.data?.bills || [];
          const now   = new Date();
          const unpaid = bills
            .filter((b) => {
              // A bill has b.payments = [myPaymentRecord] when scoped to resident
              const myPay = Array.isArray(b.payments) ? b.payments[0] : null;
              if (!myPay) return false;
              return myPay.status === "unpaid" || myPay.status === "overdue";
            })
            .map((b) => {
              const myPay = b.payments[0];
              return {
                _id:      b._id,
                title:    b.title || "Maintenance Bill",
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
    };
    load();
  }, []);

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
          <Text style={styles.heroSub}>
            {user?.society?.name || "No society"}
            {user?.flat ? ` · Flat ${user.flat}` : ""}
          </Text>

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
              { icon: "🏊", label: t("nav_amenity", "Amenity"),     color: C.teal,    onPress: () => goMore("Amenity") },
              { icon: "👤", label: t("btn_profile", "Profile"),     color: C.gray700, onPress: () => goMore("Profile") },
              // Committee-aware actions — shown based on module permissions
              ...(hasPermission("notices", "write") ? [
                { icon: "📋", label: "Post Notice", color: C.navy,  onPress: () => goMore("Notices") },
              ] : []),
              ...(hasPermission("maintenance", "read") ? [
                { icon: "💰", label: "Billing",     color: C.teal,  onPress: () => go("Maintenance") },
              ] : []),
              ...(isAdmin ? [
                { icon: "👑", label: "Approvals",   color: C.amber, onPress: () => go("Admin") },
                { icon: "🛡️", label: "Committee",   color: C.purple, onPress: () => goMore("Committee") },
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
                  {urgentNotice.tag === "Urgent" ? "URGENT NOTICE" : "LATEST NOTICE"}
                </Text>
                <Text style={styles.urgentTitle} numberOfLines={1}>{urgentNotice.title}</Text>
                <Text style={styles.urgentBody} numberOfLines={2}>{urgentNotice.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.gray300} />
            </TouchableOpacity>
          )}

          {/* ── Recent Issues ── */}
          <SectionHeader title={t("home_recent_issues")} onSeeAll={() => go("Issues")} />
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
                        {issue.isAnonymous ? "Anonymous" : (issue.flat || issue.reporter?.flat || "—")}
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
          <SectionHeader title={t("home_community")} onSeeAll={() => goMore("Help")} />
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
                        {" · "}{h.replyCount ?? 0} replies
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
  heroSub:     { fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 20 },
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