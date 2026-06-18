/**
 * src/screens/maintenance/sub-components/DefaulterList.jsx
 *
 * Admin-only panel: residents with unpaid / overdue payment records
 * across all published bills.
 *
 * Features (full web parity):
 *   ✅ Summary strip — Defaulting Flats / Overdue count / Total Outstanding
 *   ✅ Sort by Amount | Bill count | Flat number
 *   ✅ Expandable DefaulterCard with per-bill breakdown
 *   ✅ Per-bill: title, due date, status badge, amount, penalty callout
 *   ✅ Total outstanding row inside each card
 *   ✅ Loading / Error / Empty states
 *
 * API: GET /maintenance/defaulters
 *   → { data: { defaulters: [{ flat, wing, resident, records: [...] }] } }
 *
 * Each record has: { _id, bill: { title, dueDate, billMonth }, status, totalDue, penalty }
 *
 * Usage (from MaintenanceScreen):
 *   import { DefaulterList } from "./sub-components/DefaulterList";
 *   // replace the inline DefaulterView with:
 *   <DefaulterList />
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { useLanguage } from "../../../context/LanguageContext";

import { maintenanceApi }      from "../../../api/resources.api";
import { useToast }            from "../../../context/ToastContext";
import {
  Card, Badge, Spinner, EmptyState, ErrorState,
} from "../../../components/ui";
import { C, PAYMENT_STATUS_COLOR } from "../../../constants/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString("en-IN")}`
    : "—";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

const totalForDefaulter = (defaulter) =>
  (defaulter.records || []).reduce((s, r) => s + (r.totalDue || 0), 0);

// ─── Summary Strip ─────────────────────────────────────────────────────────────
/**
 * Three stat tiles at the top:
 *   🏠 Defaulting Flats  |  ⚠️ Overdue  |  💰 Total Outstanding
 */
const SummaryStrip = ({ defaulters }) => {
  const { t } = useLanguage();
  const totalFlats       = defaulters.length;
  const totalOverdue     = defaulters.filter((d) =>
    (d.records || []).some((r) => r.status === "overdue")
  ).length;
  const totalOutstanding = defaulters.reduce(
    (s, d) => s + totalForDefaulter(d), 0
  );

  const TILES = [
    { icon: "🏠", label: t("defaulters_defaulting_flats", "Defaulting Flats"), value: String(totalFlats),       color: C.amber },
    { icon: "⚠️", label: t("defaulters_overdue", "Overdue"),          value: String(totalOverdue),     color: C.red   },
    { icon: "💰", label: t("defaulters_outstanding", "Outstanding"),       value: fmt(totalOutstanding),    color: C.red   },
  ];

  return (
    <View style={S.stripRow}>
      {TILES.map(({ icon, label, value, color }) => (
        <View
          key={label}
          style={[S.stripTile, { backgroundColor: color + "14", borderColor: color + "22" }]}
        >
          <Text style={S.stripIcon}>{icon}</Text>
          <Text style={[S.stripValue, { color }]}>{value}</Text>
          <Text style={S.stripLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Sort Controls ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "amount", label: "Amount",  translationKey: "defaulters_sort_amount" },
  { key: "count",  label: "Bills",   translationKey: "defaulters_sort_bills"  },
  { key: "flat",   label: "Flat",    translationKey: "defaulters_sort_flat"   },
];

const SortBar = ({ value, onChange }) => {
  const { t } = useLanguage();
  return (
    <View style={S.sortRow}>
      <Text style={S.sortLabel}>{t("defaulters_sort_by", "Sort by:")}</Text>
    {SORT_OPTIONS.map(({ key, label, translationKey }) => {
      const active = value === key;
      return (
        <TouchableOpacity
          key={key}
          onPress={() => onChange(key)}
          activeOpacity={0.75}
          style={[S.sortBtn, active && S.sortBtnActive]}
        >
          <Text style={[S.sortBtnText, active && S.sortBtnTextActive]}>
            {t(translationKey, label)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
  );
};

// ─── DefaulterCard ─────────────────────────────────────────────────────────────
/**
 * Collapsed:   flat badge | name | bill count + overdue pill | total due
 * Expanded:    + per-bill breakdown rows + total outstanding row
 */
const DefaulterCard = ({ defaulter }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const records      = defaulter.records || [];
  const total        = totalForDefaulter(defaulter);
  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const hasOverdue   = overdueCount > 0;

  return (
    <Card style={S.defaulterCard}>
      {/* ── Collapsed header row ───────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        style={S.cardHeader}
      >
        {/* Flat badge */}
        <View style={[
          S.flatBadge,
          { backgroundColor: hasOverdue ? C.red + "18" : C.amber + "18" },
        ]}>
          <Text style={[
            S.flatBadgeText,
            { color: hasOverdue ? C.red : C.amber },
          ]}>
            {defaulter.flat}
          </Text>
        </View>

        {/* Info column */}
        <View style={S.cardInfoCol}>
          <Text style={S.cardFlatName}>
            Flat {defaulter.flat}{defaulter.wing ? ` · ${defaulter.wing}` : ""}
          </Text>
          {defaulter.resident?.name ? (
            <Text style={S.cardResidentName} numberOfLines={1}>
              {defaulter.resident.name}
            </Text>
          ) : null}

          {/* Status pills */}
          <View style={S.pillRow}>
            <View style={[S.pill, { backgroundColor: C.red + "15" }]}>
              <Text style={[S.pillText, { color: C.red }]}>
                {records.length} {t("defaulters_unpaid_bills", "bill")}{records.length !== 1 ? "s" : ""} {t("defaulters_unpaid", "unpaid")}
              </Text>
            </View>
            {hasOverdue && (
              <View style={[S.pill, { backgroundColor: C.red + "25" }]}>
                <Text style={[S.pillText, { color: C.red }]}>
                  ⚠️ {overdueCount} {t("defaulters_overdue", "overdue")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: total + chevron */}
        <View style={S.cardRight}>
          <Text style={S.cardTotal}>{fmt(total)}</Text>
          <Text style={S.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded: per-bill rows ────────────────────────────────────── */}
      {expanded && (
        <View style={S.expandedBody}>
          {records.map((r) => {
            const sc = PAYMENT_STATUS_COLOR[r.status] || {};
            return (
              <View key={r._id} style={S.billBreakRow}>
                {/* Left: bill title + due date */}
                <View style={S.billBreakLeft}>
                  <Text style={S.billBreakTitle} numberOfLines={1}>
                    {r.bill?.title || t("defaulters_bill_title", "Bill")}
                  </Text>
                  <Text style={S.billBreakMeta}>
                    {t("defaulters_due", "Due")} {fmtDate(r.bill?.dueDate || r.dueDate)}
                    {r.bill?.billMonth ? `  ·  ${r.bill.billMonth}` : ""}
                  </Text>
                </View>

                {/* Right: badge + amount */}
                <View style={S.billBreakRight}>
                  <Badge
                    label={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    bg={sc.bg}
                    text={sc.text}
                    dot={sc.dot}
                  />
                  <Text style={S.billBreakAmt}>{fmt(r.totalDue)}</Text>
                  {r.penalty > 0 && (
                    <Text style={S.penaltyTag}>
                      +{fmt(r.penalty)} {t("defaulters_penalty", "penalty")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Total outstanding row */}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>{t("defaulters_total_outstanding", "Total Outstanding")}</Text>
            <Text style={S.totalValue}>{fmt(total)}</Text>
          </View>
        </View>
      )}
    </Card>
  );
};

// ─── DefaulterList (exported) ──────────────────────────────────────────────────
export const DefaulterList = () => {
  const toast = useToast();
  const [defaulters, setDefaulters] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [sortBy,     setSortBy]     = useState("amount"); // "amount" | "count" | "flat"

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await maintenanceApi.getDefaulters();
      setDefaulters(res.data?.defaulters || []);
    } catch (e) {
      setError(e?.response?.data?.message || t("maint_load_defaulters_failed", "Failed to load defaulters."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = [...defaulters].sort((a, b) => {
    if (sortBy === "amount") return totalForDefaulter(b) - totalForDefaulter(a);
    if (sortBy === "count")  return (b.records?.length || 0) - (a.records?.length || 0);
    return (a.flat || "").localeCompare(b.flat || "");
  });

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.centerState}>
        <Spinner size={32} />
      </View>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const { t } = useLanguage();

  if (defaulters.length === 0) {
    return (
      <EmptyState icon="🎉" message={t("defaulters_empty", "No defaulters! All flats are up to date.")} />
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View>
      <SummaryStrip defaulters={defaulters} />
      <SortBar value={sortBy} onChange={setSortBy} />
      {sorted.map((d, i) => (
        <DefaulterCard key={`${d.flat}-${i}`} defaulter={d} />
      ))}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  centerState: { alignItems: "center", justifyContent: "center", padding: 48 },

  // ── Summary strip ──────────────────────────────────────────────────────────
  stripRow:   { flexDirection: "row", gap: 8, marginBottom: 16 },
  stripTile:  {
    flex: 1, borderRadius: 12, padding: 10, borderWidth: 1,
    alignItems: "center",
  },
  stripIcon:  { fontSize: 16, marginBottom: 3 },
  stripValue: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  stripLabel: { fontSize: 9, color: C.gray500, fontWeight: "600", marginTop: 2, textAlign: "center" },

  // ── Sort bar ───────────────────────────────────────────────────────────────
  sortRow:          { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  sortLabel:        { fontSize: 11, fontWeight: "600", color: C.gray500 },
  sortBtn:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.gray100 },
  sortBtnActive:    { backgroundColor: C.navy },
  sortBtnText:      { fontSize: 11, fontWeight: "600", color: C.gray700 },
  sortBtnTextActive:{ color: "#fff" },

  // ── Defaulter card ─────────────────────────────────────────────────────────
  defaulterCard: { marginBottom: 10, padding: 0, overflow: "hidden" },

  cardHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14,
  },

  flatBadge: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  flatBadgeText: { fontSize: 11, fontWeight: "800" },

  cardInfoCol: { flex: 1, minWidth: 0 },
  cardFlatName: { fontSize: 14, fontWeight: "700", color: C.navy },
  cardResidentName: { fontSize: 12, color: C.gray500, marginTop: 1 },

  pillRow:    { flexDirection: "row", gap: 6, marginTop: 5, flexWrap: "wrap" },
  pill:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillText:   { fontSize: 10, fontWeight: "700" },

  cardRight:  { alignItems: "flex-end", flexShrink: 0 },
  cardTotal:  { fontSize: 15, fontWeight: "800", color: C.red },
  chevron:    { fontSize: 12, color: C.gray300, marginTop: 4 },

  // ── Expanded body ──────────────────────────────────────────────────────────
  expandedBody: {
    borderTopWidth: 1, borderTopColor: C.gray100,
    paddingHorizontal: 14, paddingBottom: 12,
  },

  billBreakRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.gray100,
    gap: 10,
  },
  billBreakLeft: { flex: 1 },
  billBreakTitle:{ fontSize: 13, fontWeight: "600", color: C.text },
  billBreakMeta: { fontSize: 11, color: C.gray500, marginTop: 2 },

  billBreakRight:{ alignItems: "flex-end", gap: 4, flexShrink: 0 },
  billBreakAmt:  { fontSize: 13, fontWeight: "700", color: C.red },
  penaltyTag:    { fontSize: 10, color: C.red },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingTop: 10, marginTop: 2,
  },
  totalLabel: { fontSize: 13, fontWeight: "700", color: C.gray700 },
  totalValue: { fontSize: 15, fontWeight: "800", color: C.red },
});