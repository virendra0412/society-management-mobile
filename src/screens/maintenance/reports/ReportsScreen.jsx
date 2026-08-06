/**
 * screens/maintenance/reports/ReportsScreen.jsx
 *
 * KEY FIX: All <Modal> components are rendered at the SafeAreaView root level,
 * OUTSIDE the <ScrollView>. React Native throws "Error while updating
 * accessibility state" when Modal or FlatList is nested inside ScrollView.
 * Also replaced all <FlatList> inside modals with ScrollView + .map() to avoid
 * the VirtualizedList-inside-ScrollView warning.
 */

import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { maintenanceApi }   from "../../../api/resources.api";
import { useAuth }          from "../../../context/AuthContext";
import { useToast }         from "../../../context/ToastContext";
import { Spinner, Card }    from "../../../components/ui";
import { C }                from "../../../constants/theme";
import { downloadPdf, shareCsv, shareHtml } from "./reportUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS      = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
const CUR_YEAR    = new Date().getFullYear();
const CUR_MONTH   = String(new Date().getMonth() + 1).padStart(2, "0");

const fmtYM = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
};

// ─── Shared components ────────────────────────────────────────────────────────

const BackHeader = ({ title, subtitle, onBack }) => (
  <View style={S.subHeader}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.75}>
      <Text style={S.backBtnText}>← Back</Text>
    </TouchableOpacity>
    <Text style={S.subHeaderTitle}>{title}</Text>
    {subtitle && <Text style={S.subHeaderSub}>{subtitle}</Text>}
  </View>
);

const ReportActions = ({ onDownload, onCsv, onShare, loading }) => (
  <View style={S.actions}>
    <TouchableOpacity style={S.actionBtn} onPress={onDownload} disabled={!!loading} activeOpacity={0.7}>
      {loading === "pdf" ? <ActivityIndicator size={14} color={C.navy} /> : <Text style={S.actionIcon}>⬇️</Text>}
      <Text style={S.actionLabel}>Download</Text>
    </TouchableOpacity>
    <TouchableOpacity style={S.actionBtn} onPress={onCsv} disabled={!!loading} activeOpacity={0.7}>
      {loading === "csv" ? <ActivityIndicator size={14} color={C.navy} /> : <Text style={S.actionIcon}>📊</Text>}
      <Text style={S.actionLabel}>CSV</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[S.actionBtn, { borderColor: "#25D366", borderWidth: 1.5 }]} onPress={onShare} disabled={!!loading} activeOpacity={0.7}>
      {loading === "share" ? <ActivityIndicator size={14} color="#25D366" /> : <Text style={S.actionIcon}>📲</Text>}
      <Text style={[S.actionLabel, { color: "#25D366" }]}>WhatsApp</Text>
    </TouchableOpacity>
  </View>
);

const YearPicker = ({ year, onChange }) => (
  <View style={S.yearRow}>
    <TouchableOpacity onPress={() => onChange(year - 1)} style={S.yearBtn} disabled={year <= 2020}>
      <Text style={S.yearBtnTxt}>‹</Text>
    </TouchableOpacity>
    <Text style={S.yearLabel}>{year}</Text>
    <TouchableOpacity onPress={() => onChange(Math.min(year + 1, CUR_YEAR))} style={S.yearBtn} disabled={year >= CUR_YEAR}>
      <Text style={S.yearBtnTxt}>›</Text>
    </TouchableOpacity>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
// All modal state lives HERE so modals render at root level, outside ScrollView.

export default function ReportsScreen({ onBack, bills = [] }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  // ── Month picker (Collection report) ─────────────────────────────────────
  const [collMonth,      setCollMonth]      = useState(`${CUR_YEAR}-${CUR_MONTH}`);
  const [collPickerOpen, setCollPickerOpen] = useState(false);
  const [collPickerYear, setCollPickerYear] = useState(CUR_YEAR);
  const [collLoading,    setCollLoading]    = useState(null);

  // ── Bill picker ───────────────────────────────────────────────────────────
  const [selectedBill,   setSelectedBill]   = useState(null);
  const [billPickerOpen, setBillPickerOpen] = useState(false);
  const [billLoading,    setBillLoading]    = useState(null);

  // ── Resident search (history) ─────────────────────────────────────────────
  const [histQuery,      setHistQuery]      = useState("");
  const [histResults,    setHistResults]    = useState([]);
  const [histSearching,  setHistSearching]  = useState(false);
  const [histSelected,   setHistSelected]   = useState(null);
  const [histYear,       setHistYear]       = useState(CUR_YEAR);
  const [histLoading,    setHistLoading]    = useState(null);

  // ── My history (resident) ─────────────────────────────────────────────────
  const [myYear,    setMyYear]    = useState(CUR_YEAR);
  const [myLoading, setMyLoading] = useState(null);

  // ── Summary ───────────────────────────────────────────────────────────────
  const [sumYear,    setSumYear]    = useState(CUR_YEAR);
  const [sumLoading, setSumLoading] = useState(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handlePdfAction = useCallback(async ({ path, params, setL, filename }) => {
    setL("pdf");
    try {
      console.log("[handlePdfAction] Fetching HTML from:", path, "params:", params);
      const html = await maintenanceApi.downloadReportHtml(path, { ...params, format: "html" });
      console.log("[handlePdfAction] HTML received, size:", html?.length);
      
      if (!html) {
        throw new Error("Empty HTML response from server");
      }
      
      console.log("[handlePdfAction] Calling downloadPdf");
      await downloadPdf({ htmlString: html, filename });
    } catch (e) {
      console.error("[handlePdfAction] Error:", e.message, e);
      toast.error(e?.message || "Could not download the report.");
    } finally {
      setL(null);
    }
  }, [toast]);

  const handleCsvAction = useCallback(async ({ path, params, setL, filename }) => {
    setL("csv");
    try {
      const csv = await maintenanceApi.downloadReportCsv(path, { ...params, format: "csv" });
      await shareCsv({ csvString: csv, filename });
    } catch (e) {
      toast.error(e?.message || "Could not export the CSV file.");
    } finally {
      setL(null);
    }
  }, [toast]);

  const handleShareAction = useCallback(async ({ path, params, setL, filename }) => {
    setL("share");
    try {
      const html = await maintenanceApi.downloadReportHtml(path, { ...params, format: "html" });
      await shareHtml({ htmlString: html, filename: filename.replace(/\.pdf$/i, ".html") });
    } catch (e) {
      toast.error(e?.message || "Could not share the report.");
    } finally {
      setL(null);
    }
  }, [toast]);

  const searchResidents = useCallback(async (q) => {
    if (q.length < 2) { setHistResults([]); return; }
    setHistSearching(true);
    try {
      const res = await maintenanceApi.getDefaulters({ search: q, limit: 10 });
      setHistResults(res.data?.defaulters || res.data?.members || []);
    } catch { setHistResults([]); }
    finally { setHistSearching(false); }
  }, []);

  const publishedBills = (bills || []).filter((b) => b.isPublished);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <BackHeader title="📄 Reports" subtitle="Download, CSV or WhatsApp" onBack={onBack} />

      {/* ── MONTH PICKER MODAL — at root, outside ScrollView ──────────────── */}
      <Modal visible={collPickerOpen} transparent animationType="slide" onRequestClose={() => setCollPickerOpen(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>Select Month</Text>
            <View style={S.yearRow}>
              <TouchableOpacity onPress={() => setCollPickerYear((y) => y - 1)} style={S.yearBtn}>
                <Text style={S.yearBtnTxt}>‹</Text>
              </TouchableOpacity>
              <Text style={S.yearLabel}>{collPickerYear}</Text>
              <TouchableOpacity onPress={() => setCollPickerYear((y) => Math.min(y + 1, CUR_YEAR))} style={S.yearBtn}>
                <Text style={S.yearBtnTxt}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={S.monthGrid}>
              {MONTHS.map((m, i) => {
                const ym      = `${collPickerYear}-${m}`;
                const isFuture = ym > `${CUR_YEAR}-${CUR_MONTH}`;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[S.monthCell, isFuture && S.monthCellDisabled]}
                    onPress={() => { if (!isFuture) { setCollMonth(ym); setCollPickerOpen(false); } }}
                    disabled={isFuture}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.monthCellTxt, isFuture && { color: C.gray300 }]}>
                      {MONTH_NAMES[i].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={S.modalClose} onPress={() => setCollPickerOpen(false)}>
              <Text style={S.modalCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BILL PICKER MODAL — at root, outside ScrollView ───────────────── */}
      <Modal visible={billPickerOpen} transparent animationType="slide" onRequestClose={() => setBillPickerOpen(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>Select Bill</Text>
            {/* ScrollView + map instead of FlatList to avoid VirtualizedList nesting */}
            <ScrollView style={{ maxHeight: 320 }}>
              {publishedBills.length === 0 ? (
                <Text style={{ color: C.gray500, textAlign: "center", padding: 20 }}>
                  No published bills found.
                </Text>
              ) : publishedBills.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={[S.billPickerRow, selectedBill?._id === item._id && S.billPickerRowActive]}
                  onPress={() => { setSelectedBill(item); setBillPickerOpen(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={S.billPickerTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={S.billPickerSub}>
                      {item.billMonth} · Due {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  {selectedBill?._id === item._id && <Text style={{ color: C.teal, fontWeight: "700" }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={S.modalClose} onPress={() => setBillPickerOpen(false)}>
              <Text style={S.modalCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── SCROLLABLE CONTENT ────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

        <View style={S.hintRow}>
          <Text style={S.hintIcon}>ℹ️</Text>
          <Text style={S.hintText}>
            Tap Download to save a PDF directly to your device, or use CSV / WhatsApp for sharing.
          </Text>
        </View>

        {/* ── Admin reports ──────────────────────────────────────────────── */}
        {isAdmin && (
          <>

            {/* Monthly Collection */}
            <Card style={S.sectionCard}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionIcon}>📊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.sectionTitle}>Monthly Collection Report</Text>
                  <Text style={S.sectionSub}>All bills, flat-by-flat breakdown</Text>
                </View>
              </View>
              <TouchableOpacity style={S.pickerBtn} onPress={() => setCollPickerOpen(true)}>
                <Text style={S.pickerIcon}>📅</Text>
                <Text style={S.pickerTxt}>{fmtYM(collMonth)}</Text>
                <Text style={S.pickerArrow}>›</Text>
              </TouchableOpacity>
              <ReportActions
                loading={collLoading}
                onDownload={() => handlePdfAction({ path: "collection", params: { month: collMonth }, setL: setCollLoading, filename: `collection-${collMonth}.pdf` })}
                onCsv={() => handleCsvAction({ path: "collection", params: { month: collMonth }, setL: setCollLoading, filename: `collection-${collMonth}.csv` })}
                onShare={() => handleShareAction({ path: "collection", params: { month: collMonth }, setL: setCollLoading, filename: `collection-${collMonth}.pdf` })}
              />
            </Card>

            {/* Maintenance Bill */}
            <Card style={S.sectionCard}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionIcon}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.sectionTitle}>Maintenance Bill</Text>
                  <Text style={S.sectionSub}>Full flat-wise bill with collection status</Text>
                </View>
              </View>
              <TouchableOpacity style={S.pickerBtn} onPress={() => setBillPickerOpen(true)}>
                <Text style={S.pickerIcon}>🗂️</Text>
                <Text style={S.pickerTxt} numberOfLines={1}>
                  {selectedBill ? selectedBill.title : "Select a bill…"}
                </Text>
                <Text style={S.pickerArrow}>›</Text>
              </TouchableOpacity>
              <ReportActions
                loading={billLoading}
                onDownload={() => {
                  if (!selectedBill) { toast.error("Please select a bill first."); return; }
                  handlePdfAction({ path: `bill/${selectedBill._id}`, params: {}, setL: setBillLoading, filename: `bill-${selectedBill.billMonth}.pdf` });
                }}
                onCsv={() => {
                  if (!selectedBill) { toast.error("Please select a bill first."); return; }
                  handleCsvAction({ path: `bill/${selectedBill._id}`, params: {}, setL: setBillLoading, filename: `bill-${selectedBill.billMonth}.csv` });
                }}
                onShare={() => {
                  if (!selectedBill) { toast.error("Please select a bill first."); return; }
                  handleShareAction({ path: `bill/${selectedBill._id}`, params: {}, setL: setBillLoading, filename: `bill-${selectedBill.billMonth}.pdf` });
                }}
              />
            </Card>

            {/* Resident History (admin — any resident) */}
            <Card style={S.sectionCard}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionIcon}>🕑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.sectionTitle}>Resident Payment History</Text>
                  <Text style={S.sectionSub}>Full payment trail for any flat</Text>
                </View>
              </View>
              <View style={S.searchBox}>
                <TextInput
                  style={S.searchInput}
                  placeholder="Search flat, wing or name…"
                  placeholderTextColor={C.gray500}
                  value={histQuery}
                  onChangeText={(t) => { setHistQuery(t); searchResidents(t); }}
                  autoCorrect={false}
                />
                {histSearching && <ActivityIndicator size={14} color={C.teal} style={{ marginLeft: 8 }} />}
              </View>
              {histResults.length > 0 && (
                <View style={S.resultsList}>
                  {histResults.slice(0, 5).map((r) => (
                    <TouchableOpacity
                      key={r._id}
                      style={[S.resultRow, histSelected?._id === r._id && S.resultRowActive]}
                      onPress={() => { setHistSelected(r); setHistResults([]); setHistQuery(`${r.flat ? r.flat + " · " : ""}${r.name}`); }}
                    >
                      <Text style={S.resultFlat}>{r.wing ? `${r.wing} · ` : ""}{r.flat}</Text>
                      <Text style={S.resultName}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={S.fieldLabel}>Year</Text>
              <YearPicker year={histYear} onChange={setHistYear} />
              <ReportActions
                loading={histLoading}
                onDownload={() => {
                  if (!histSelected) { toast.error("Please select a resident first."); return; }
                  handlePdfAction({ path: "history", params: { residentId: histSelected._id, year: histYear }, setL: setHistLoading, filename: `history-${histSelected.flat}-${histYear}.pdf` });
                }}
                onCsv={() => {
                  if (!histSelected) { toast.error("Please select a resident first."); return; }
                  handleCsvAction({ path: "history", params: { residentId: histSelected._id, year: histYear }, setL: setHistLoading, filename: `history-${histSelected.flat}-${histYear}.csv` });
                }}
                onShare={() => {
                  if (!histSelected) { toast.error("Please select a resident first."); return; }
                  handleShareAction({ path: "history", params: { residentId: histSelected._id, year: histYear }, setL: setHistLoading, filename: `history-${histSelected.flat}-${histYear}.pdf` });
                }}
              />
            </Card>

            {/* Financial Summary */}
            <Card style={S.sectionCard}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionIcon}>💰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.sectionTitle}>Society Financial Summary</Text>
                  <Text style={S.sectionSub}>Month-by-month overview for the year</Text>
                </View>
              </View>
              <Text style={S.fieldLabel}>Year</Text>
              <YearPicker year={sumYear} onChange={setSumYear} />
              <ReportActions
                loading={sumLoading}
                onDownload={() => handlePdfAction({ path: "summary", params: { year: sumYear }, setL: setSumLoading, filename: `summary-${sumYear}.pdf` })}
                onCsv={() => handleCsvAction({ path: "summary", params: { year: sumYear }, setL: setSumLoading, filename: `summary-${sumYear}.csv` })}
                onShare={() => handleShareAction({ path: "summary", params: { year: sumYear }, setL: setSumLoading, filename: `summary-${sumYear}.pdf` })}
              />
            </Card>

          </>
        )}

        {/* ── Resident — My Payment History ──────────────────────────────── */}
        <Card style={S.sectionCard}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionIcon}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.sectionTitle}>My Payment History</Text>
              <Text style={S.sectionSub}>
                {user?.flat ? `Flat ${user.flat} · ` : ""}All bills and receipts
              </Text>
            </View>
          </View>
          <Text style={S.fieldLabel}>Year</Text>
          <YearPicker year={myYear} onChange={setMyYear} />
          <ReportActions
            loading={myLoading}
            onDownload={() => handlePdfAction({ path: "history", params: { year: myYear }, setL: setMyLoading, filename: `my-payments-${myYear}.pdf` })}
            onCsv={() => handleCsvAction({ path: "history", params: { year: myYear }, setL: setMyLoading, filename: `my-payments-${myYear}.csv` })}
            onShare={() => handleShareAction({ path: "history", params: { year: myYear }, setL: setMyLoading, filename: `my-payments-${myYear}.pdf` })}
          />
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },

  subHeader:      { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  subHeaderTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginTop: 8 },
  subHeaderSub:   { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  backBtnText:    { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },

  hintRow:  { flexDirection: "row", gap: 8, backgroundColor: C.teal + "12", borderRadius: 10, padding: 12, marginBottom: 16 },
  hintIcon: { fontSize: 16 },
  hintText: { flex: 1, fontSize: 12, color: C.teal, lineHeight: 18 },

  sectionCard:   { padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  sectionIcon:   { fontSize: 28, marginTop: 2 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: C.text },
  sectionSub:    { fontSize: 12, color: C.gray500, marginTop: 2 },

  actions:     { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn:   { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.gray300, gap: 4 },
  actionIcon:  { fontSize: 18 },
  actionLabel: { fontSize: 11, fontWeight: "600", color: C.gray700, textAlign: "center" },

  pickerBtn:   { flexDirection: "row", alignItems: "center", backgroundColor: C.gray50, borderRadius: 10, borderWidth: 1, borderColor: C.gray300, padding: 12, gap: 8, marginBottom: 4 },
  pickerIcon:  { fontSize: 16 },
  pickerTxt:   { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  pickerArrow: { fontSize: 18, color: C.gray500 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalTitle:   { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 16 },
  modalClose:   { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: C.gray100, alignItems: "center" },
  modalCloseTxt:{ fontWeight: "600", color: C.gray700 },

  yearRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16 },
  yearBtn:    { padding: 8 },
  yearBtnTxt: { fontSize: 22, color: C.teal, fontWeight: "700" },
  yearLabel:  { fontSize: 20, fontWeight: "700", color: C.text, minWidth: 60, textAlign: "center" },

  monthGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell:         { width: "22%", paddingVertical: 10, borderRadius: 8, backgroundColor: C.gray50, alignItems: "center", borderWidth: 1, borderColor: C.gray100 },
  monthCellDisabled: { opacity: 0.4 },
  monthCellTxt:      { fontSize: 13, fontWeight: "600", color: C.text },

  billPickerRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: C.gray100, gap: 8 },
  billPickerRowActive: { backgroundColor: C.teal + "10" },
  billPickerTitle:     { fontSize: 14, fontWeight: "600", color: C.text },
  billPickerSub:       { fontSize: 12, color: C.gray500, marginTop: 2 },

  searchBox:  { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.gray300, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", marginBottom: 8 },
  searchInput:{ flex: 1, fontSize: 14, color: C.text },
  resultsList:{ borderWidth: 1, borderColor: C.gray100, borderRadius: 10, overflow: "hidden", marginBottom: 12 },
  resultRow:  { padding: 12, borderBottomWidth: 1, borderColor: C.gray100, flexDirection: "row", alignItems: "center", gap: 10 },
  resultRowActive: { backgroundColor: C.teal + "12" },
  resultFlat: { fontSize: 13, fontWeight: "700", color: C.teal, minWidth: 70 },
  resultName: { fontSize: 13, color: C.gray700, flex: 1 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
});