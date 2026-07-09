/**
 * screens/maintenance/reports/ReportsScreen.jsx
 *
 * Hub screen for all 5 maintenance reports.
 *
 * Admin/Treasurer sees all 5:
 *   📋 Maintenance Bill        → all flats in a bill
 *   🧾 Payment Receipt         → single paid record (from bill detail)
 *   📊 Monthly Collection      → all bills for a selected month
 *   🕑 Resident History        → any resident's full payment trail
 *   💰 Financial Summary       → year-over-year month breakdown
 *
 * Resident sees 2:
 *   🧾 My Payment History      → own records
 *   🧾 Payment Receipt         → from bill detail (not directly from here)
 *
 * Each report card has:
 *   🖨️ Print / PDF    → opens in browser (user can print or Save as PDF)
 *   📊 Export Excel   → downloads CSV → share sheet
 *   📲 Share          → same as Export (share sheet includes WhatsApp)
 *
 * Uses:
 *   expo-web-browser  (already installed)
 *   expo-file-system  (already installed)
 *   expo-sharing      (already installed)
 */

import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput, FlatList,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { maintenanceApi }      from "../../../api/resources.api";
import { BASE_URL }            from "../../../api/client";
import { tokenStorage }        from "../../../utils/storage";
import { useAuth }             from "../../../context/AuthContext";
import { useToast }            from "../../../context/ToastContext";
import { Spinner, Card }       from "../../../components/ui";
import { C }                   from "../../../constants/theme";
import {
  openHtml, shareHtml, shareCsv,
} from "./reportUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "01","02","03","04","05","06","07","08","09","10","11","12",
];
const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const currentYear  = new Date().getFullYear();
const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

const fmt = (ym) => {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const BackHeader = ({ title, subtitle, onBack }) => (
  <View style={S.subHeader}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={S.backBtn}>
      <Text style={S.backBtnText}>← Back</Text>
    </TouchableOpacity>
    <Text style={S.subHeaderTitle}>{title}</Text>
    {subtitle && <Text style={S.subHeaderSub}>{subtitle}</Text>}
  </View>
);

// Three export action buttons for a report
const ReportActions = ({ onPrint, onCsv, onShare, loading }) => (
  <View style={S.actions}>
    <TouchableOpacity style={S.actionBtn} onPress={onPrint} disabled={loading} activeOpacity={0.7}>
      {loading === "html" ? <ActivityIndicator size={14} color={C.navy} /> : <Text style={S.actionIcon}>🖨️</Text>}
      <Text style={S.actionLabel}>Print / PDF</Text>
    </TouchableOpacity>
    <TouchableOpacity style={S.actionBtn} onPress={onCsv} disabled={loading} activeOpacity={0.7}>
      {loading === "csv" ? <ActivityIndicator size={14} color={C.navy} /> : <Text style={S.actionIcon}>📊</Text>}
      <Text style={S.actionLabel}>Export Excel</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[S.actionBtn, { borderColor: "#25D366", borderWidth: 1.5 }]}
      onPress={onShare} disabled={loading} activeOpacity={0.7}>
      {loading === "share" ? <ActivityIndicator size={14} color="#25D366" /> : <Text style={S.actionIcon}>📲</Text>}
      <Text style={[S.actionLabel, { color: "#25D366" }]}>WhatsApp</Text>
    </TouchableOpacity>
  </View>
);

// ─── Month picker modal ────────────────────────────────────────────────────────

const MonthPicker = ({ visible, onClose, onSelect, initialYear }) => {
  const [year, setYear] = useState(initialYear || currentYear);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <Text style={S.modalTitle}>Select Month</Text>
          <View style={S.yearRow}>
            <TouchableOpacity onPress={() => setYear((y) => y - 1)} style={S.yearBtn}>
              <Text style={S.yearBtnTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={S.yearLabel}>{year}</Text>
            <TouchableOpacity onPress={() => setYear((y) => Math.min(y + 1, currentYear))} style={S.yearBtn}>
              <Text style={S.yearBtnTxt}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={S.monthGrid}>
            {MONTHS.map((m, i) => {
              const ym      = `${year}-${m}`;
              const isFuture = ym > `${currentYear}-${currentMonth}`;
              return (
                <TouchableOpacity
                  key={m}
                  style={[S.monthCell, isFuture && S.monthCellDisabled]}
                  onPress={() => { if (!isFuture) { onSelect(ym); onClose(); } }}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text style={[S.monthCellTxt, isFuture && { color: C.gray300 }]}>
                    {MONTH_LABELS[i].slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={S.modalClose} onPress={onClose}>
            <Text style={S.modalCloseTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Year picker ──────────────────────────────────────────────────────────────

const YearPicker = ({ year, onChange }) => (
  <View style={S.yearRow}>
    <TouchableOpacity
      onPress={() => onChange(year - 1)}
      style={S.yearBtn}
      disabled={year <= 2020}
    >
      <Text style={S.yearBtnTxt}>‹</Text>
    </TouchableOpacity>
    <Text style={S.yearLabel}>{year}</Text>
    <TouchableOpacity
      onPress={() => onChange(Math.min(year + 1, currentYear))}
      style={S.yearBtn}
      disabled={year >= currentYear}
    >
      <Text style={S.yearBtnTxt}>›</Text>
    </TouchableOpacity>
  </View>
);

// ─── Shared: build authenticated HTML URL ────────────────────────────────────

const buildUrl = (path, params = {}) => {
  const token = tokenStorage.getAccess();
  const qs    = new URLSearchParams({ ...params, token }).toString();
  return `${BASE_URL}/maintenance/reports/${path}?${qs}`;
};

// ─── Shared: download HTML string from API ───────────────────────────────────

const fetchHtml = async (path, params = {}) => {
  const csvString = await maintenanceApi.downloadReportCsv(path, { ...params, format: "html" });
  return csvString; // axios responseType:"text" returns the raw HTML string
};

// ─── Section: Monthly Collection ──────────────────────────────────────────────

const CollectionSection = ({ bills }) => {
  const [month,       setMonth]       = useState(`${currentYear}-${currentMonth}`);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [loading,     setLoading]     = useState(null);
  const toast = useToast();

  const handleAction = useCallback(async (type) => {
    setLoading(type);
    try {
      const path   = "collection";
      const params = { month };

      if (type === "html" || type === "share") {
        const html     = await maintenanceApi.downloadReportCsv(path, { ...params, format: "html" });
        await shareHtml({ htmlString: html, filename: `collection-${month}.html` });
      } else {
        const csvStr = await maintenanceApi.downloadReportCsv(path, { ...params, format: "csv" });
        await shareCsv({ csvString: csvStr, filename: `collection-${month}.csv` });
      }
    } catch (e) {
      toast.error(e?.message || "Could not generate report.");
    } finally {
      setLoading(null);
    }
  }, [month]);

  const handlePrint = useCallback(async () => {
    setLoading("html");
    try {
      const url = buildUrl("collection", { month, format: "html" });
      await openHtml(url);
    } catch (e) {
      toast.error("Could not open report.");
    } finally {
      setLoading(null);
    }
  }, [month]);

  return (
    <Card style={S.sectionCard}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionIcon}>📊</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>Monthly Collection Report</Text>
          <Text style={S.sectionSub}>All bills, flat-by-flat breakdown</Text>
        </View>
      </View>

      <TouchableOpacity style={S.monthPickerBtn} onPress={() => setPickerOpen(true)}>
        <Text style={S.monthPickerIcon}>📅</Text>
        <Text style={S.monthPickerTxt}>{fmt(month)}</Text>
        <Text style={S.monthPickerArrow}>›</Text>
      </TouchableOpacity>

      <MonthPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setMonth}
      />

      <ReportActions
        loading={loading}
        onPrint={handlePrint}
        onCsv={() => handleAction("csv")}
        onShare={() => handleAction("share")}
      />
    </Card>
  );
};

// ─── Section: Bill Report ──────────────────────────────────────────────────────

const BillSection = ({ bills }) => {
  const [selectedBill, setSelectedBill] = useState(null);
  const [loading,      setLoading]      = useState(null);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const toast = useToast();

  const handlePrint = async () => {
    if (!selectedBill) { toast.error("Please select a bill first."); return; }
    setLoading("html");
    try {
      const url = buildUrl(`bill/${selectedBill._id}`, { format: "html" });
      await openHtml(url);
    } catch (e) {
      toast.error("Could not open report.");
    } finally { setLoading(null); }
  };

  const handleCsv = async () => {
    if (!selectedBill) { toast.error("Please select a bill first."); return; }
    setLoading("csv");
    try {
      const csv = await maintenanceApi.downloadReportCsv(`bill/${selectedBill._id}`, { format: "csv" });
      await shareCsv({ csvString: csv, filename: `bill-${selectedBill.billMonth}.csv` });
    } catch (e) {
      toast.error("Could not export.");
    } finally { setLoading(null); }
  };

  const handleShare = async () => {
    if (!selectedBill) { toast.error("Please select a bill first."); return; }
    setLoading("share");
    try {
      const html = await maintenanceApi.downloadReportCsv(`bill/${selectedBill._id}`, { format: "html" });
      await shareHtml({ htmlString: html, filename: `bill-${selectedBill.billMonth}.html` });
    } catch (e) {
      toast.error("Could not share.");
    } finally { setLoading(null); }
  };

  const publishedBills = (bills || []).filter((b) => b.isPublished);

  return (
    <Card style={S.sectionCard}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionIcon}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>Maintenance Bill</Text>
          <Text style={S.sectionSub}>Full flat-wise bill with collection status</Text>
        </View>
      </View>

      <TouchableOpacity style={S.monthPickerBtn} onPress={() => setPickerOpen(true)}>
        <Text style={S.monthPickerIcon}>🗂️</Text>
        <Text style={S.monthPickerTxt} numberOfLines={1}>
          {selectedBill ? selectedBill.title : "Select a bill…"}
        </Text>
        <Text style={S.monthPickerArrow}>›</Text>
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>Select Bill</Text>
            {publishedBills.length === 0 ? (
              <Text style={{ color: C.gray500, textAlign: "center", padding: 20 }}>
                No published bills found.
              </Text>
            ) : (
              <FlatList
                data={publishedBills}
                keyExtractor={(b) => b._id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[S.billPickerRow, selectedBill?._id === item._id && S.billPickerRowActive]}
                    onPress={() => { setSelectedBill(item); setPickerOpen(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={S.billPickerTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={S.billPickerSub}>{item.billMonth} · Due {new Date(item.dueDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</Text>
                    </View>
                    {selectedBill?._id === item._id && (
                      <Text style={{ color: C.teal, fontWeight: "700" }}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={S.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={S.modalCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ReportActions loading={loading} onPrint={handlePrint} onCsv={handleCsv} onShare={handleShare} />
    </Card>
  );
};

// ─── Section: Resident History (Admin view — any resident) ────────────────────

const ResidentHistorySection = () => {
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [year,       setYear]       = useState(currentYear);
  const [loading,    setLoading]    = useState(null);
  const toast = useToast();

  const search = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { members } = await maintenanceApi.getDefaulters({ search: q, limit: 10 });
      // Fall back to searching residents via users endpoint if available
      setResults(members || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handlePrint = async () => {
    if (!selected) { toast.error("Please select a resident first."); return; }
    setLoading("html");
    try {
      const url = buildUrl("history", { residentId: selected._id, year, format: "html" });
      await openHtml(url);
    } catch (e) {
      toast.error("Could not open report.");
    } finally { setLoading(null); }
  };

  const handleCsv = async () => {
    if (!selected) { toast.error("Please select a resident first."); return; }
    setLoading("csv");
    try {
      const csv = await maintenanceApi.downloadReportCsv("history", { residentId: selected._id, year, format: "csv" });
      await shareCsv({ csvString: csv, filename: `history-${selected.flat || selected._id}-${year}.csv` });
    } catch (e) {
      toast.error("Could not export.");
    } finally { setLoading(null); }
  };

  const handleShare = async () => {
    if (!selected) { toast.error("Please select a resident first."); return; }
    setLoading("share");
    try {
      const html = await maintenanceApi.downloadReportCsv("history", { residentId: selected._id, year, format: "html" });
      await shareHtml({ htmlString: html, filename: `history-${selected.flat || selected._id}-${year}.html` });
    } catch (e) {
      toast.error("Could not share.");
    } finally { setLoading(null); }
  };

  return (
    <Card style={S.sectionCard}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionIcon}>🕑</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>Resident Payment History</Text>
          <Text style={S.sectionSub}>Full payment trail for any flat</Text>
        </View>
      </View>

      {/* Resident search */}
      <View style={S.searchBox}>
        <TextInput
          style={S.searchInput}
          placeholder="Search flat, wing or name…"
          placeholderTextColor={C.gray500}
          value={query}
          onChangeText={(t) => { setQuery(t); search(t); }}
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size={14} color={C.teal} style={{ marginLeft: 8 }} />}
      </View>

      {results.length > 0 && (
        <View style={S.resultsList}>
          {results.slice(0, 5).map((r) => (
            <TouchableOpacity
              key={r._id}
              style={[S.resultRow, selected?._id === r._id && S.resultRowActive]}
              onPress={() => { setSelected(r); setResults([]); setQuery(`${r.flat ? r.flat + " · " : ""}${r.name}`); }}
            >
              <Text style={S.resultFlat}>{r.wing ? `${r.wing} · ` : ""}{r.flat}</Text>
              <Text style={S.resultName}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Year picker */}
      <Text style={S.fieldLabel}>Year</Text>
      <YearPicker year={year} onChange={setYear} />

      <ReportActions loading={loading} onPrint={handlePrint} onCsv={handleCsv} onShare={handleShare} />
    </Card>
  );
};

// ─── Section: My History (Resident view) ─────────────────────────────────────

const MyHistorySection = ({ user }) => {
  const [year,    setYear]    = useState(currentYear);
  const [loading, setLoading] = useState(null);
  const toast = useToast();

  const handlePrint = async () => {
    setLoading("html");
    try {
      const url = buildUrl("history", { year, format: "html" });
      await openHtml(url);
    } catch (e) {
      toast.error("Could not open report.");
    } finally { setLoading(null); }
  };

  const handleCsv = async () => {
    setLoading("csv");
    try {
      const csv = await maintenanceApi.downloadReportCsv("history", { year, format: "csv" });
      await shareCsv({ csvString: csv, filename: `my-payments-${year}.csv` });
    } catch (e) {
      toast.error("Could not export.");
    } finally { setLoading(null); }
  };

  const handleShare = async () => {
    setLoading("share");
    try {
      const html = await maintenanceApi.downloadReportCsv("history", { year, format: "html" });
      await shareHtml({ htmlString: html, filename: `my-payments-${year}.html` });
    } catch (e) {
      toast.error("Could not share.");
    } finally { setLoading(null); }
  };

  return (
    <Card style={S.sectionCard}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionIcon}>🧾</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>My Payment History</Text>
          <Text style={S.sectionSub}>
            Flat {user?.flat || "—"} · all bills and receipts
          </Text>
        </View>
      </View>

      <Text style={S.fieldLabel}>Year</Text>
      <YearPicker year={year} onChange={setYear} />

      <ReportActions loading={loading} onPrint={handlePrint} onCsv={handleCsv} onShare={handleShare} />
    </Card>
  );
};

// ─── Section: Financial Summary (Admin only) ──────────────────────────────────

const SummarySection = () => {
  const [year,    setYear]    = useState(currentYear);
  const [loading, setLoading] = useState(null);
  const toast = useToast();

  const handlePrint = async () => {
    setLoading("html");
    try {
      const url = buildUrl("summary", { year, format: "html" });
      await openHtml(url);
    } catch (e) {
      toast.error("Could not open report.");
    } finally { setLoading(null); }
  };

  const handleCsv = async () => {
    setLoading("csv");
    try {
      const csv = await maintenanceApi.downloadReportCsv("summary", { year, format: "csv" });
      await shareCsv({ csvString: csv, filename: `financial-summary-${year}.csv` });
    } catch (e) {
      toast.error("Could not export.");
    } finally { setLoading(null); }
  };

  const handleShare = async () => {
    setLoading("share");
    try {
      const html = await maintenanceApi.downloadReportCsv("summary", { year, format: "html" });
      await shareHtml({ htmlString: html, filename: `financial-summary-${year}.html` });
    } catch (e) {
      toast.error("Could not share.");
    } finally { setLoading(null); }
  };

  return (
    <Card style={S.sectionCard}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionIcon}>💰</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.sectionTitle}>Society Financial Summary</Text>
          <Text style={S.sectionSub}>Month-by-month overview for the year</Text>
        </View>
      </View>

      <Text style={S.fieldLabel}>Year</Text>
      <YearPicker year={year} onChange={setYear} />

      <ReportActions loading={loading} onPrint={handlePrint} onCsv={handleCsv} onShare={handleShare} />
    </Card>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen({ onBack, bills = [] }) {
  const { user, isAdmin } = useAuth();

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <BackHeader
        title="📄 Reports"
        subtitle="Download, print or share"
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={S.scroll}>

        {/* Hint row */}
        <View style={S.hintRow}>
          <Text style={S.hintIcon}>ℹ️</Text>
          <Text style={S.hintText}>
            Print / PDF opens in your browser — use the browser's Print option to Save as PDF.
            Export Excel downloads a .csv file that opens in Excel or Google Sheets.
          </Text>
        </View>

        {/* Admin reports */}
        {isAdmin && (
          <>
            <CollectionSection bills={bills} />
            <BillSection bills={bills} />
            <ResidentHistorySection />
            <SummarySection />
          </>
        )}

        {/* Resident reports */}
        <MyHistorySection user={user} />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },

  // Sub-header (matches other maintenance sub-screens)
  subHeader:      { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  subHeaderTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginTop: 8 },
  subHeaderSub:   { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  backBtn:        { alignSelf: "flex-start" },
  backBtnText:    { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },

  // Hint
  hintRow:  { flexDirection: "row", gap: 8, backgroundColor: C.teal + "12", borderRadius: 10, padding: 12, marginBottom: 16 },
  hintIcon: { fontSize: 16 },
  hintText: { flex: 1, fontSize: 12, color: C.teal, lineHeight: 18 },

  // Section card
  sectionCard:   { padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  sectionIcon:   { fontSize: 28, marginTop: 2 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: C.text },
  sectionSub:    { fontSize: 12, color: C.gray500, marginTop: 2 },

  // Action buttons
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.gray300,
    gap: 4,
  },
  actionIcon:  { fontSize: 18 },
  actionLabel: { fontSize: 11, fontWeight: "600", color: C.gray700, textAlign: "center" },

  // Month picker button
  monthPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.gray300,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  monthPickerIcon:  { fontSize: 16 },
  monthPickerTxt:   { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  monthPickerArrow: { fontSize: 18, color: C.gray500 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 16 },
  modalClose: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.gray100,
    alignItems: "center",
  },
  modalCloseTxt: { fontWeight: "600", color: C.gray700 },

  // Month grid
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16 },
  yearBtn: { padding: 8 },
  yearBtnTxt: { fontSize: 22, color: C.teal, fontWeight: "700" },
  yearLabel:  { fontSize: 20, fontWeight: "700", color: C.text, minWidth: 60, textAlign: "center" },
  monthGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell:  {
    width: "22%",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.gray50,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.gray100,
  },
  monthCellDisabled: { opacity: 0.4 },
  monthCellTxt:      { fontSize: 13, fontWeight: "600", color: C.text },

  // Bill picker
  billPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: C.gray100,
    gap: 8,
  },
  billPickerRowActive: { backgroundColor: C.teal + "10" },
  billPickerTitle:     { fontSize: 14, fontWeight: "600", color: C.text },
  billPickerSub:       { fontSize: 12, color: C.gray500, marginTop: 2 },

  // Resident search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.gray300,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  resultsList: {
    borderWidth: 1,
    borderColor: C.gray100,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
  },
  resultRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: C.gray100,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultRowActive: { backgroundColor: C.teal + "12" },
  resultFlat: { fontSize: 13, fontWeight: "700", color: C.teal, minWidth: 70 },
  resultName: { fontSize: 13, color: C.gray700, flex: 1 },

  // Field label
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
});
