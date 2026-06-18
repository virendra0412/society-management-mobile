/**
 * screens/maintenance/MaintenanceScreen.jsx
 *
 * Full React Native port of web MaintenanceScreen.
 *
 * Views (state-machine, no extra navigator needed):
 *   "dashboard"          → bill list + stats header
 *   "detail"             → bill detail modal sheet (bill header + payments)
 *   "my-payments"        → resident payment history
 *   "defaulters"         → admin defaulter list
 *
 * Admin features:
 *   • Create / Edit draft bills
 *   • Publish bill → generates payment records
 *   • Apply late penalty (bulk)
 *   • Close bill
 *   • Record payment per flat (method + txnId + note)
 *   • Apply discount per flat
 *   • Filter by status + month
 *   • Defaulter triage
 *
 * Resident features:
 *   • View published bills list
 *   • My payment history (status, amount, method, date)
 *   • Bill detail — own payment record only
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, Switch, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { maintenanceApi } from "../../api/resources.api";
import { useAuth }        from "../../context/AuthContext";
import { useToast }       from "../../context/ToastContext";
import { useLanguage }    from "../../context/LanguageContext";
import {
  Card, Badge, Modal, Input, Btn, Spinner,
  EmptyState, ErrorState, FilterPill, ScreenHeader,
} from "../../components/ui";
import { C, PAYMENT_STATUS_COLOR, BILL_STATUS, PAYMENT_METHODS } from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString("en-IN")}`
    : "—";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const billStatusInfo = (bill) => {
  if (bill.isClosed)    return BILL_STATUS.closed;
  if (bill.isPublished) return BILL_STATUS.published;
  return BILL_STATUS.draft;
};

const isOverdue = (bill) =>
  bill.isPublished && !bill.isClosed && new Date(bill.dueDate) < new Date();

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionLabel = ({ title, count }) => (
  <View style={S.sectionRow}>
    <Text style={S.sectionTitle}>{title}</Text>
    {count !== undefined && (
      <View style={S.countBadge}>
        <Text style={S.countText}>{count}</Text>
      </View>
    )}
  </View>
);

// ─── Stat Box (header) ────────────────────────────────────────────────────────
const StatBox = ({ icon, label, value, color = "#fff" }) => (
  <View style={S.statBox}>
    <Text style={S.statIcon}>{icon}</Text>
    <Text style={[S.statValue, { color }]}>{value}</Text>
    <Text style={S.statLabel}>{label}</Text>
  </View>
);

// ─── Collection Analytics Chart (admin only, pure RN — no SVG lib needed) ────
// Shows collected (green) vs pending (amber) bars for last 6 published bills.
// Uses View-based bars instead of SVG — works identically on iOS + Android.
const CollectionChart = ({ bills }) => {
  const { t } = useLanguage();
  const data = bills
    .filter((b) => b.isPublished && b.collectionSummary?.total > 0)
    .map((b) => ({
      label:     (b.billMonth || b.title || "").slice(0, 7),
      collected: b.collectionSummary?.collected || 0,
      pending:   b.collectionSummary?.pending   || 0,
      total:     b.collectionSummary?.total      || 1,
    }))
    .sort((a, z) => (a.label > z.label ? 1 : -1))
    .slice(-6);

  if (data.length === 0) return null;

  const maxVal  = Math.max(...data.map((d) => d.total), 1);
  const fmtK    = (n) => n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${n}`;
  const BAR_H   = 80; // max bar height in dp

  return (
    <View style={chartStyles.card}>
      {/* Header row */}
      <View style={chartStyles.headerRow}>
        <Text style={chartStyles.chartTitle}>📊 {t("payments_collection_analytics", "Collection Analytics")}</Text>
        <View style={chartStyles.legendRow}>
          <View style={[chartStyles.legendDot, { backgroundColor: C.green }]} />
          <Text style={chartStyles.legendText}>{t("payments_collected", "Collected")}</Text>
          <View style={[chartStyles.legendDot, { backgroundColor: C.amber, marginLeft: 8 }]} />
          <Text style={chartStyles.legendText}>{t("payments_pending", "Pending")}</Text>
        </View>
      </View>

      {/* Bar group */}
      <View style={chartStyles.barsRow}>
        {data.map((d) => (
          <View key={d.label} style={chartStyles.barGroup}>
            {/* Collected bar */}
            <View style={chartStyles.barPair}>
              <View style={[
                chartStyles.bar,
                {
                  height: Math.max(4, (d.collected / maxVal) * BAR_H),
                  backgroundColor: C.green,
                },
              ]} />
              <View style={[
                chartStyles.bar,
                {
                  height: Math.max(4, (d.pending / maxVal) * BAR_H),
                  backgroundColor: C.amber,
                  opacity: 0.8,
                },
              ]} />
            </View>
            <Text style={chartStyles.barLabel} numberOfLines={1}>{d.label.slice(2)}</Text>
          </View>
        ))}
      </View>

      {/* Max value hint */}
      <Text style={chartStyles.maxHint}>Max: {fmtK(maxVal)}</Text>
    </View>
  );
};

const chartStyles = StyleSheet.create({
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.gray100 },
  headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  chartTitle:  { fontSize: 12, fontWeight: "700", color: C.navy },
  legendRow:   { flexDirection: "row", alignItems: "center" },
  legendDot:   { width: 8, height: 8, borderRadius: 2, marginRight: 4 },
  legendText:  { fontSize: 10, color: C.gray500 },
  barsRow:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 90, paddingBottom: 4 },
  barGroup:    { flex: 1, alignItems: "center", gap: 2 },
  barPair:     { flexDirection: "row", gap: 3, alignItems: "flex-end" },
  bar:         { width: 12, borderRadius: 3 },
  barLabel:    { fontSize: 9, color: C.gray500, marginTop: 4, fontWeight: "600", textAlign: "center" },
  maxHint:     { fontSize: 10, color: C.gray300, textAlign: "right", marginTop: 4 },
});

// ─── Progress Bar (bill collection) ───────────────────────────────────────────
const ProgressBar = ({ pct, color = C.teal }) => (
  <View style={S.progressTrack}>
    <View style={[S.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? C.green : color }]} />
  </View>
);

// ─── Payment Method Picker (pill row) ─────────────────────────────────────────
const MethodPicker = ({ value, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
    {PAYMENT_METHODS.map((m) => {
      const active = value === m;
      return (
        <TouchableOpacity
          key={m}
          onPress={() => onChange(m)}
          activeOpacity={0.75}
          style={[S.methodPill, active && S.methodPillActive]}
        >
          <Text style={[S.methodPillText, active && S.methodPillTextActive]}>
            {m.toUpperCase()}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

// ─── Target Mode picker ───────────────────────────────────────────────────────
const TargetPicker = ({ value, onChange }) => {
  const { t } = useLanguage();
  return (
    <View style={S.targetRow}>
      {["all", "specific"].map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => onChange(m)}
          activeOpacity={0.75}
          style={[S.targetBtn, value === m && S.targetBtnActive]}
        >
          <Text style={[S.targetBtnText, value === m && S.targetBtnTextActive]}>
            {m === "all" ? t("payments_all_flats", "All Flats") : t("payments_specific_flats", "Specific Flats")}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ─── Month Picker (horizontal chip strip) ─────────────────────────────────────
const MonthPicker = ({ value, onChange }) => {
  const { t } = useLanguage();
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    months.push({ key, label });
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <TouchableOpacity
        onPress={() => onChange("")}
        activeOpacity={0.75}
        style={[S.monthChip, !value && S.monthChipActive]}
      >
        <Text style={[S.monthChipText, !value && S.monthChipTextActive]}>{t("payments_month_all", "All")}</Text>
      </TouchableOpacity>
      {months.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          onPress={() => onChange(value === key ? "" : key)}
          activeOpacity={0.75}
          style={[S.monthChip, value === key && S.monthChipActive]}
        >
          <Text style={[S.monthChipText, value === key && S.monthChipTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CREATE / EDIT BILL MODAL ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const BLANK_BILL = {
  title: "", description: "", billMonth: "", baseAmount: "",
  dueDate: "", penaltyEnabled: false, penaltyAmount: "",
  targetMode: "all", targetFlats: "",
};

const CreateBillModal = ({ open, onClose, bill, onSaved }) => {
  const toast  = useToast();
  const { t }  = useLanguage();
  const isEdit = !!bill;
  const [form,   setForm]   = useState(BLANK_BILL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(bill ? {
        title:          bill.title          || "",
        description:    bill.description    || "",
        billMonth:      bill.billMonth      || "",
        baseAmount:     String(bill.baseAmount ?? ""),
        dueDate:        bill.dueDate ? bill.dueDate.slice(0, 10) : "",
        penaltyEnabled: bill.penaltyEnabled || false,
        penaltyAmount:  String(bill.penaltyAmount ?? ""),
        targetMode:     bill.targetMode     || "all",
        targetFlats:    (bill.targetFlats   || []).join(", "),
      } : BLANK_BILL);
    }
  }, [open, bill]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim())                             return toast.error(t("maint_err_title_required", "Title is required."));
    if (!form.baseAmount || Number(form.baseAmount) < 1) return toast.error(t("maint_err_amount", "Amount must be ≥ ₹1."));
    if (!form.dueDate)                                  return toast.error(t("maint_err_due_date", "Due date is required."));
    if (form.penaltyEnabled && Number(form.penaltyAmount) < 1)
      return toast.error(t("maint_err_penalty_amount", "Penalty amount must be ≥ ₹1."));

    const payload = {
      title:          form.title.trim(),
      description:    form.description.trim() || undefined,
      billMonth:      form.billMonth          || undefined,
      baseAmount:     Number(form.baseAmount),
      dueDate:        form.dueDate,
      penaltyEnabled: form.penaltyEnabled,
      penaltyAmount:  form.penaltyEnabled ? Number(form.penaltyAmount) : 0,
      targetMode:     form.targetMode,
      targetFlats:    form.targetMode === "specific"
        ? form.targetFlats.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await maintenanceApi.updateBill(bill._id, payload)
        : await maintenanceApi.createBill(payload);
      onSaved(res.data.bill, isEdit ? "update" : "create");
      toast.success(isEdit ? t("maint_bill_updated", "Bill updated.") : t("maint_draft_created", "Draft bill created."));
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("maint_save_failed", "Save failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("maint_edit_bill_title", "Edit Bill") : t("maint_create_bill_title", "Create Maintenance Bill")}>
      <Input label={t("maint_bill_title_label", "Bill Title *")}        value={form.title}       onChangeText={set("title")}       placeholder={t("maint_bill_title_ph", "e.g. January 2025 Maintenance")} />
      <Input label={t("maint_description_label", "Description")}         value={form.description} onChangeText={set("description")} placeholder={t("maint_description_ph", "Any notes for residents…")} multiline />
      <View style={S.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input label={t("maint_bill_month_label", "Bill Month (YYYY-MM)")} value={form.billMonth}  onChangeText={set("billMonth")}  placeholder={t("maint_bill_month_ph", "2025-01")} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t("maint_amount_label", "Amount (₹) *")}    value={form.baseAmount}  onChangeText={set("baseAmount")}  placeholder={t("maint_amount_ph", "2500")} keyboardType="numeric" />
        </View>
      </View>
      <Input label={t("maint_due_date_label", "Due Date (YYYY-MM-DD) *")} value={form.dueDate} onChangeText={set("dueDate")} placeholder={t("maint_due_date_ph", "2025-01-31")} keyboardType="numbers-and-punctuation" />

      <Text style={S.inputLabel}>{t("maint_target_label", "Target")}</Text>
      <TargetPicker value={form.targetMode} onChange={set("targetMode")} />

      {form.targetMode === "specific" && (
        <Input
          label={t("maint_flat_numbers_label", "Flat Numbers (comma-separated)")}
          value={form.targetFlats}
          onChangeText={set("targetFlats")}
          placeholder={t("maint_flat_numbers_ph", "101, 102, 203A")}
        />
      )}

      {/* Penalty toggle */}
      <View style={S.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={S.toggleLabel}>{t("maint_penalty_label", "Late Penalty")}</Text>
          <Text style={S.toggleHint}>{t("maint_penalty_hint", "Auto-charge overdue flats")}</Text>
        </View>
        <Switch
          value={form.penaltyEnabled}
          onValueChange={set("penaltyEnabled")}
          thumbColor="#fff"
          trackColor={{ false: C.gray300, true: C.teal }}
        />
      </View>

      {form.penaltyEnabled && (
        <Input label={t("maint_penalty_amount_label", "Penalty Amount (₹) *")} value={form.penaltyAmount} onChangeText={set("penaltyAmount")} placeholder={t("maint_penalty_amount_ph", "200")} keyboardType="numeric" />
      )}

      <Btn onPress={handleSave} loading={saving}>
        {isEdit ? t("maint_save_changes", "Save Changes") : t("maint_create_draft", "Create Draft Bill")}
      </Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RECORD PAYMENT MODAL ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const RecordPaymentModal = ({ open, onClose, paymentRecord, billId, onSaved }) => {
  const toast = useToast();
  const [method, setMethod]   = useState("upi");
  const [amount, setAmount]   = useState("");
  const [txnId,  setTxnId]    = useState("");
  const [note,   setNote]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (open && paymentRecord) {
      setAmount(String(paymentRecord.totalDue ?? paymentRecord.amount ?? ""));
      setMethod("upi"); setTxnId(""); setNote("");
    }
  }, [open, paymentRecord]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        paymentMethod: method,
        paidAmount:    amount ? Number(amount) : undefined,
        transactionId: txnId.trim()  || undefined,
        receiptNote:   note.trim()   || undefined,
      };
      const res = await maintenanceApi.recordPayment(billId, paymentRecord._id, payload);
      onSaved(res.data.bill);
      toast.success(t("maint_payment_recorded", "Payment recorded."));
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("maint_payment_record_failed", "Failed to record payment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("maint_record_payment_title", "Record Payment")}>
      {paymentRecord && (
        <View style={S.infoBox}>
          <Text style={S.infoTitle}>Flat {paymentRecord.flat}{paymentRecord.wing ? ` · ${paymentRecord.wing}` : ""}</Text>
          <Text style={S.infoMeta}>
            Amount Due: {fmt(paymentRecord.totalDue)}
            {paymentRecord.penalty > 0 ? `  +${fmt(paymentRecord.penalty)} penalty` : ""}
          </Text>
        </View>
      )}
      <Input label={t("maint_amount_paid_label", "Amount Paid (₹)")} value={amount} onChangeText={setAmount} placeholder={t("maint_amount_paid_ph", "Leave blank for full amount")} keyboardType="numeric" />
      <Text style={S.inputLabel}>{t("maint_method_label", "Payment Method *")}</Text>
      <MethodPicker value={method} onChange={setMethod} />
      <Input label={t("maint_txn_label", "Transaction ID / Ref (optional)")} value={txnId} onChangeText={setTxnId} placeholder={t("maint_txn_ph", "UPI ref, cheque no., etc.")} />
      <Input label={t("maint_receipt_note_label", "Receipt Note (optional)")} value={note} onChangeText={setNote} placeholder={t("maint_receipt_note_ph", "Any note…")} multiline />
      <Btn onPress={handleSave} loading={saving}>{t("maint_mark_paid", "Mark as Paid")}</Btn>
    </Modal>
  );
};

// ─── Discount Modal ────────────────────────────────────────────────────────────
const DiscountModal = ({ open, onClose, paymentRecord, billId, onSaved }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [discount, setDiscount] = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open) setDiscount(String(paymentRecord?.discount ?? ""));
  }, [open, paymentRecord]);

  const handleSave = async () => {
    if (discount === "" || Number(discount) < 0) return toast.error(t("maint_err_discount", "Discount must be ≥ 0."));
    setSaving(true);
    try {
      const res = await maintenanceApi.applyDiscount(billId, paymentRecord._id, Number(discount));
      onSaved(res.data.bill);
      toast.success(t("maint_discount_applied", "Discount applied."));
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("maint_discount_failed", "Failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("maint_discount_title", "Apply Discount")}>
      {paymentRecord && (
        <View style={S.infoBox}>
          <Text style={S.infoTitle}>Flat {paymentRecord.flat}</Text>
          <Text style={S.infoMeta}>Base: {fmt(paymentRecord.amount)}</Text>
        </View>
      )}
      <Input label={t("maint_discount_label", "Discount Amount (₹) *")} value={discount} onChangeText={setDiscount} placeholder={t("maint_discount_ph", "e.g. 200")} keyboardType="numeric" />
      <Btn onPress={handleSave} loading={saving}>{t("maint_apply_discount", "Apply Discount")}</Btn>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BILL DETAIL MODAL ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const BillDetailModal = ({ open, billId, onClose, isAdmin }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [bill,         setBill]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [actionBusy,   setActionBusy]   = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [recordModal,  setRecordModal]  = useState(null);
  const [discountModal,setDiscountModal]= useState(null);

  const loadBill = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    try {
      const res = await maintenanceApi.getBillById(billId);
      setBill(res.data.bill);
    } catch {
      toast.error(t("payments_load_bill_failed","Failed to load bill."));
    } finally {
      setLoading(false);
    }
  }, [billId, t]);

  useEffect(() => {
    if (open && billId) loadBill();
    else setBill(null);
  }, [open, billId]);

  const doAction = (action, label, fn) => {
    Alert.alert(label, t("payments_action_cannot_undo","This cannot be undone."), [
      { text: t("btn_cancel","Cancel"), style: "cancel" },
      { text: t("btn_confirm","Confirm"), style: action === "close" ? "destructive" : "default",
        onPress: async () => {
          setActionBusy(action);
          try {
            const res = await fn();
            setBill(res.data.bill);
            toast.success(t("payments_action_success","Action successful."));
          } catch (e) {
            toast.error(e?.response?.data?.message || t("payments_action_failed","Action failed."));
          } finally {
            setActionBusy(null);
          }
        },
      },
    ]);
  };

  const patchBill = (updatedBill) => setBill(updatedBill);

  if (!open) return null;

  const status      = bill ? billStatusInfo(bill) : null;
  const summary     = bill?.collectionSummary || {};
  const paidPct     = summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0;
  const overdueBool = bill ? isOverdue(bill) : false;

  const filteredPayments = (bill?.payments || []).filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSearch = !search.trim() ||
      p.flat?.toLowerCase().includes(search.toLowerCase()) ||
      p.resident?.name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = (bill?.payments || []).reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Modal open={open} onClose={onClose} title={bill?.title || "Bill Detail"}>
      {loading && (
        <View style={S.center}>
          <Spinner size={32} />
        </View>
      )}

      {!loading && bill && (
        <>
          {/* Status + meta */}
          <View style={S.billMetaRow}>
            <View style={{ flex: 1 }}>
              <Text style={S.billMonth}>{bill.billMonth || "Maintenance Bill"}</Text>
              <Text style={S.billDue}>
                Due {fmtDate(bill.dueDate)}{overdueBool ? " · ⚠️ Overdue" : ""}
              </Text>
            </View>
            <View style={[S.statusChip, { backgroundColor: status.bg + "33" }]}>
              <Text style={[S.statusChipText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>

          {/* Collection progress (admin, published) */}
          {bill.isPublished && isAdmin && (
            <View style={S.collectionCard}>
              <View style={S.collectionRow}>
                <View style={[S.collectionBox, { backgroundColor: C.green + "15" }]}>
                  <Text style={[S.collectionAmount, { color: C.green }]}>{fmt(summary.collected)}</Text>
                  <Text style={S.collectionLabel}>Collected</Text>
                </View>
                <View style={[S.collectionBox, { backgroundColor: C.amber + "15" }]}>
                  <Text style={[S.collectionAmount, { color: C.amber }]}>{fmt(summary.pending)}</Text>
                  <Text style={S.collectionLabel}>Pending</Text>
                </View>
                <View style={[S.collectionBox, { backgroundColor: C.gray50 }]}>
                  <Text style={[S.collectionAmount, { color: C.navy }]}>{fmt(summary.total)}</Text>
                  <Text style={S.collectionLabel}>Total</Text>
                </View>
              </View>
              <ProgressBar pct={paidPct} />
              <Text style={S.pctLabel}>{paidPct}% collected</Text>
            </View>
          )}

          {/* Bill info rows */}
          <View style={S.detailCard}>
            <SectionLabel title="Bill Details" />
            {[
              ["Base Amount", fmt(bill.baseAmount)],
              ["Due Date",    fmtDate(bill.dueDate)],
              ["Target",      bill.targetMode === "all" ? "All Flats" : `${bill.targetFlats?.length || 0} flats`],
              bill.penaltyEnabled ? ["Late Penalty", fmt(bill.penaltyAmount)] : null,
              bill.description   ? ["Description",  bill.description]        : null,
            ].filter(Boolean).map(([label, value]) => (
              <View key={label} style={S.detailRow}>
                <Text style={S.detailLabel}>{label}</Text>
                <Text style={S.detailValue}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Admin actions */}
          {isAdmin && (
            <View style={[S.detailCard, { marginBottom: 12 }]}>
              <SectionLabel title="Admin Actions" />
              <View style={S.actionRow}>
                {!bill.isPublished && !bill.isClosed && (
                  <Btn small loading={actionBusy === "publish"}
                    onPress={() => doAction("publish", "Publish bill", () => maintenanceApi.publishBill(bill._id))}>
                    📢 Publish
                  </Btn>
                )}
                {bill.isPublished && !bill.isClosed && bill.penaltyEnabled && overdueBool && (
                  <Btn small variant="ghost" loading={actionBusy === "penalty"}
                    onPress={() => doAction("penalty", "Apply penalty", () => maintenanceApi.applyPenalty(bill._id))}>
                    ⚠️ Apply Penalty
                  </Btn>
                )}
                {bill.isPublished && !bill.isClosed && (
                  <Btn small variant="danger" loading={actionBusy === "close"}
                    onPress={() => doAction("close", "Close bill", () => maintenanceApi.closeBill(bill._id))}>
                    🔒 Close
                  </Btn>
                )}
              </View>
            </View>
          )}

          {/* Payment records */}
          {bill.isPublished && (
            <>
              {isAdmin ? (
                <>
                  {/* Status filter */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {[
                      { key: "all",     label: `All (${bill.payments?.length || 0})` },
                      { key: "unpaid",  label: `Unpaid (${statusCounts.unpaid  || 0})` },
                      { key: "overdue", label: `Overdue (${statusCounts.overdue || 0})` },
                      { key: "paid",    label: `Paid (${statusCounts.paid      || 0})` },
                    ].map(({ key, label }) => (
                      <FilterPill
                        key={key}
                        label={label}
                        active={statusFilter === key}
                        onPress={() => setStatusFilter(key)}
                      />
                    ))}
                  </ScrollView>

                  {/* Search */}
                  <View style={S.searchRow}>
                    <Text style={S.searchIcon}>🔍</Text>
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search by flat or resident…"
                      placeholderTextColor={C.gray300}
                      style={S.searchInput}
                    />
                  </View>

                  <SectionLabel title="Payment Records" count={filteredPayments.length} />

                  {filteredPayments.length === 0
                    ? <EmptyState icon="📋" message="No records match." />
                    : filteredPayments.map((p) => {
                        const sc     = PAYMENT_STATUS_COLOR[p.status] || {};
                        const isPaid = p.status === "paid" || p.status === "waived";
                        return (
                          <View key={p._id} style={S.paymentRow}>
                            <View style={S.flatBadge}>
                              <Text style={S.flatBadgeText}>{p.flat}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={S.flatName}>Flat {p.flat}{p.wing ? ` · ${p.wing}` : ""}</Text>
                              {p.resident?.name && <Text style={S.flatResident}>{p.resident.name}</Text>}
                              <View style={S.paymentMeta}>
                                <Badge label={p.status.charAt(0).toUpperCase() + p.status.slice(1)} bg={sc.bg} text={sc.text} dot={sc.dot} />
                                <Text style={[S.paymentAmt, { color: isPaid ? C.green : C.red }]}>
                                  {fmt(isPaid ? (p.paidAmount || p.totalDue) : p.totalDue)}
                                </Text>
                                {p.penalty > 0  && <Text style={S.penaltyText}>+{fmt(p.penalty)}</Text>}
                                {p.discount > 0 && <Text style={S.discountText}>-{fmt(p.discount)}</Text>}
                              </View>
                              {isPaid && p.paidAt && (
                                <Text style={S.paidMeta}>
                                  Paid {fmtDate(p.paidAt)} via {p.paymentMethod}
                                  {p.transactionId ? `  ·  ${p.transactionId}` : ""}
                                </Text>
                              )}
                            </View>
                            {!isPaid && !bill.isClosed && (
                              <View style={S.recordActions}>
                                <TouchableOpacity onPress={() => setRecordModal(p)} style={S.recordBtn} activeOpacity={0.75}>
                                  <Text style={S.recordBtnText}>✓ Pay</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setDiscountModal(p)} style={S.discountBtn} activeOpacity={0.75}>
                                  <Text style={S.discountBtnText}>%</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })
                  }
                </>
              ) : (
                // Resident: own record only
                <>
                  <SectionLabel title="Your Payment" />
                  {bill.payments?.length > 0 ? (() => {
                    const p  = bill.payments[0];
                    const sc = PAYMENT_STATUS_COLOR[p.status] || {};
                    const isPaid = p.status === "paid" || p.status === "waived";
                    return (
                      <View style={S.residentPayCard}>
                        <View style={S.paymentMeta}>
                          <Badge label={p.status.charAt(0).toUpperCase() + p.status.slice(1)} bg={sc.bg} text={sc.text} dot={sc.dot} />
                          <Text style={[S.paymentAmt, { color: isPaid ? C.green : C.red }]}>
                            {fmt(isPaid ? (p.paidAmount || p.totalDue) : p.totalDue)}
                          </Text>
                        </View>
                        {p.penalty  > 0 && <Text style={S.penaltyText}>+{fmt(p.penalty)} late penalty</Text>}
                        {p.discount > 0 && <Text style={S.discountText}>-{fmt(p.discount)} discount</Text>}
                        {isPaid && p.paidAt && (
                          <Text style={S.paidMeta}>
                            Paid {fmtDate(p.paidAt)} via {p.paymentMethod}
                          </Text>
                        )}
                        {!isPaid && (
                          <View style={[S.alertBox, { backgroundColor: C.amber + "15" }]}>
                            <Text style={{ fontSize: 12, color: C.amber, fontWeight: "600" }}>
                              ⏰ Payment due by {fmtDate(bill.dueDate)}. Please pay at the office or contact admin.
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })() : (
                    <EmptyState icon="💰" message="No payment record yet. Bill may not have been published for your flat." />
                  )}
                </>
              )}
            </>
          )}

          {/* Draft info */}
          {!bill.isPublished && !bill.isClosed && (
            <View style={[S.alertBox, { backgroundColor: C.amber + "12", marginTop: 8 }]}>
              <Text style={{ fontSize: 13, color: C.gray700, lineHeight: 20 }}>
                ℹ️ This bill is a <Text style={{ fontWeight: "700" }}>draft</Text>. Publish it to generate payment records and notify residents.
              </Text>
            </View>
          )}
        </>
      )}

      {/* Nested modals */}
      <RecordPaymentModal
        open={!!recordModal}
        onClose={() => setRecordModal(null)}
        paymentRecord={recordModal}
        billId={bill?._id}
        onSaved={(b) => { patchBill(b); setRecordModal(null); }}
      />
      <DiscountModal
        open={!!discountModal}
        onClose={() => setDiscountModal(null)}
        paymentRecord={discountModal}
        billId={bill?._id}
        onSaved={(b) => { patchBill(b); setDiscountModal(null); }}
      />
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MY PAYMENTS VIEW (Resident history) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const MyPaymentsView = ({ onBack }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const { dataVersion } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await maintenanceApi.getMyPayments();
      const list = res.data?.payments || [];
      setPayments(list.map((item) => ({ ...item, ...(item.payment || {}) })));
    } catch (e) {
      setError(e?.response?.data?.message || t("payments_load_history_failed","Failed to load payment history."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load, dataVersion]);

  const totalPaid    = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.paidAmount || 0), 0);
  const totalPending = payments.filter((p) => ["unpaid", "overdue"].includes(p.status)).reduce((s, p) => s + (p.totalDue || 0), 0);

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <View style={S.subHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={S.backBtn}>
          <Text style={S.backBtnText}>{t("btn_back","← Back")}</Text>
        </TouchableOpacity>
        <Text style={S.subHeaderTitle}>{t("payments_my_payments_title","💳 My Payments")}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading && <Spinner size={32} />}
        {error   && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && payments.length > 0 && (
          <View style={S.summaryRow}>
            <StatBox icon="✅" label={t("payments_total_paid","Total Paid")}  value={fmt(totalPaid)}    color={C.green} />
            <StatBox icon="⏳" label={t("payments_pending","Pending")}     value={fmt(totalPending)} color={totalPending > 0 ? C.red : C.gray500} />
            <StatBox icon="📋" label={t("payments_bills","Bills")}       value={payments.length}  color={C.navy} />
          </View>
        )}

        {!loading && !error && payments.length === 0 && (
          <View style={S.emptyBills}>
            <Text style={S.emptyBillsIcon}>💰</Text>
            <Text style={S.emptyBillsTitle}>{t("payments_no_bills","No bills yet")}</Text>
            <Text style={S.emptyBillsSub}>{t("payments_no_bills_sub","Your maintenance bills will appear here once admin publishes them.")}</Text>
          </View>
        )}

        {!loading && !error && payments.map((p) => {
          const sc     = PAYMENT_STATUS_COLOR[p.status] || {};
          const isPaid = p.status === "paid" || p.status === "waived";
          return (
            <Card key={p._id}>
              <View style={S.myBillRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.myBillTitle}>{p.bill?.title || "Maintenance Bill"}</Text>
                  <Text style={S.myBillMeta}>
                    Due {fmtDate(p.bill?.dueDate || p.dueDate)}
                    {p.bill?.billMonth ? `  ·  ${p.bill.billMonth}` : ""}
                  </Text>
                  <View style={S.paymentMeta}>
                    <Badge label={p.status.charAt(0).toUpperCase() + p.status.slice(1)} bg={sc.bg} text={sc.text} dot={sc.dot} />
                    <Text style={[S.paymentAmt, { color: isPaid ? C.green : C.text }]}>
                      {fmt(isPaid ? (p.paidAmount || p.totalDue) : p.totalDue)}
                    </Text>
                    {p.penalty  > 0 && <Text style={S.penaltyText}>+{fmt(p.penalty)}</Text>}
                    {p.discount > 0 && <Text style={S.discountText}>-{fmt(p.discount)}</Text>}
                  </View>
                  {isPaid && p.paidAt && (
                    <Text style={S.paidMeta}>Paid {fmtDate(p.paidAt)} via {p.paymentMethod}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 28, opacity: isPaid ? 1 : 0.35 }}>
                  {isPaid ? "✅" : "⏳"}
                </Text>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DEFAULTER VIEW ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const DefaulterView = ({ onBack }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const { dataVersion } = useAuth();
  const [defaulters, setDefaulters] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

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
  }, [t]);

  useEffect(() => { load(); }, [load, dataVersion]);

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <View style={S.subHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={S.backBtn}>
          <Text style={S.backBtnText}>{t("btn_back","← Back")}</Text>
        </TouchableOpacity>
        <Text style={S.subHeaderTitle}>{t("payments_defaulter_triage","⚠️ Defaulter Triage")}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading && <View style={S.center}><Spinner size={32} /></View>}
        {error   && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && defaulters.length === 0 && (
          <EmptyState icon="🎉" message={t("payments_no_defaulters","No defaulters! All dues are clear.")} />
        )}
        {!loading && !error && defaulters.map((d, i) => (
          <Card key={d._id || i}>
            <View style={S.defaulterRow}>
              <View style={S.flatBadge}>
                <Text style={S.flatBadgeText}>{d.flat}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.flatName}>{d.residentName || `Flat ${d.flat}`}</Text>
                <Text style={S.flatResident}>
                  {d.unpaidCount || 0} {t("payments_unpaid_label","unpaid")} · {fmt(d.totalDue)}
                </Text>
              </View>
              <View style={[S.statusChip, { backgroundColor: C.red + "15" }]}>
                <Text style={[S.statusChipText, { color: C.red }]}>
                  {d.overdueCount > 0 ? t("payments_overdue","Overdue") : t("payments_unpaid","Unpaid")}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAINTENANCE DASHBOARD (main list view) ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const BILL_STATUS_FILTERS = ["All", "Draft", "Published", "Closed"];

const MaintenanceDashboard = ({ isAdmin, onOpenBill, onOpenMyPayments, onOpenDefaulters }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [bills,        setBills]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [monthFilter,  setMonthFilter]  = useState("");
  const [showCreate,   setShowCreate]   = useState(false);
  const [editBill,     setEditBill]     = useState(null);

  const handleDeleteBill = useCallback((billId) => {
    Alert.alert(
      t("payments_delete_bill_title", "Delete Draft Bill"),
      t("payments_delete_bill_body", "This draft bill will be permanently deleted. This cannot be undone."),
      [
        { text: t("btn_cancel", "Cancel"), style: "cancel" },
        {
          text: t("btn_delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await maintenanceApi.deleteBill(billId);
              setBills((prev) => prev.filter((b) => b._id !== billId));
              toast.success(t("payments_draft_deleted", "Draft bill deleted."));
            } catch (e) {
              toast.error(e?.response?.data?.message || t("payments_delete_failed", "Delete failed."));
            }
          },
        },
      ]
    );
  }, [toast]);

  const loadBills = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (statusFilter === "Draft")     { params.isPublished = false; }
      if (statusFilter === "Published") { params.isPublished = true; params.isClosed = false; }
      if (statusFilter === "Closed")    { params.isClosed = true; }
      if (monthFilter) params.billMonth = monthFilter;
      const res = await maintenanceApi.getAllBills(params);
      setBills(res.data?.bills || []);
    } catch (e) {
      setError(e?.response?.data?.message || t("payments_load_bills_failed", "Failed to load bills."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const handleBillSaved = (bill, mode) => {
    if (mode === "create") setBills((p) => [bill, ...p]);
    else setBills((p) => p.map((b) => b._id === bill._id ? bill : b));
  };

  const publishedBills = bills.filter((b) => b.isPublished && !b.isClosed);
  const totalCollected = publishedBills.reduce((s, b) => s + (b.collectionSummary?.collected || 0), 0);
  const totalPending   = publishedBills.reduce((s, b) => s + (b.collectionSummary?.pending   || 0), 0);
  const overdueCount   = publishedBills.filter((b) => isOverdue(b)).length;

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.headerLabel}>{t("payments_header_label", "MAINTENANCE")}</Text>
        <Text style={S.headerTitle}>💰 {t("payments_title", "Payments")}</Text>
        {isAdmin && bills.length > 0 && (
          <View style={S.headerStats}>
            <StatBox icon="✅" label={t("payments_collected", "Collected")}     value={fmt(totalCollected)} color={C.green}             />
            <StatBox icon="⏳" label={t("payments_pending", "Pending")}       value={fmt(totalPending)}   color={totalPending > 0 ? C.amber : "#fff"} />
            <StatBox icon="⚠️" label={t("payments_overdue_bills", "Overdue Bills")} value={overdueCount}        color={overdueCount > 0 ? "#FC8181" : "#fff"} />
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* My Payments shortcut */}
        <TouchableOpacity onPress={onOpenMyPayments} activeOpacity={0.85} style={S.shortcutCard}>
          <View>
            <Text style={[S.shortcutTitle, { color: C.teal }]}>{t("maint_my_payment_shortcut", "💳 My Payment History")}</Text>
            <Text style={S.shortcutSub}>{t("maint_my_payment_shortcut_sub", "View your maintenance bills and payment status")}</Text>
          </View>
          <Text style={[S.shortcutArrow, { color: C.teal }]}>›</Text>
        </TouchableOpacity>

        {/* Collection analytics chart (admin only) */}
        {isAdmin && bills.length > 0 && <CollectionChart bills={bills} />}

        {/* Defaulter shortcut (admin only) */}
        {isAdmin && (
          <TouchableOpacity onPress={onOpenDefaulters} activeOpacity={0.85} style={[S.shortcutCard, S.shortcutDanger]}>
            <View>
              <Text style={[S.shortcutTitle, { color: C.red }]}>{t("maint_defaulter_shortcut", "⚠️ Defaulter Triage")}</Text>
              <Text style={S.shortcutSub}>{t("maint_defaulter_shortcut_sub", "Residents with unpaid or overdue records")}</Text>
            </View>
            <Text style={[S.shortcutArrow, { color: C.red }]}>›</Text>
          </TouchableOpacity>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <>
            <View style={S.filterHeaderRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BILL_STATUS_FILTERS.map((f) => (
                  <FilterPill key={f} label={f} active={statusFilter === f} onPress={() => setStatusFilter(f)} />
                ))}
              </ScrollView>
              <Btn small onPress={() => setShowCreate(true)} style={{ marginLeft: 10 }}>{t("maint_new_btn", "+ New")}</Btn>
            </View>
            <MonthPicker value={monthFilter} onChange={setMonthFilter} />
          </>
        )}

        {/* Bills list */}
        {loading && [1, 2, 3].map((k) => (
          <View key={k} style={[S.skeletonBlock, { height: 100 }]} />
        ))}
        {error   && <ErrorState message={error} onRetry={loadBills} />}
        {!loading && !error && bills.length === 0 && (
          <EmptyState
            icon="💰"
            message={
              monthFilter
                ? `${t("maint_no_bills_month", "No bills for")} ${monthFilter}.`
                : isAdmin
                  ? t("maint_no_bills_admin", "No bills yet. Create your first maintenance bill.")
                  : t("maint_no_bills_resident", "No maintenance bills published yet.")
            }
          />
        )}

        {!loading && !error && bills.map((bill) => {
          const st          = billStatusInfo(bill);
          const summary     = bill.collectionSummary || {};
          const overdueBool = isOverdue(bill);
          const paidPct     = summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0;
          const isDraft     = !bill.isPublished && !bill.isClosed;

          return (
            <Card key={bill._id} onPress={() => onOpenBill(bill._id)}>
              <View style={S.billCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={S.billCardTitle}>{bill.title}</Text>
                  <Text style={S.billCardMeta}>
                    Due {fmtDate(bill.dueDate)}
                    {bill.billMonth ? `  ·  ${bill.billMonth}` : ""}
                    {overdueBool ? "  ·  ⚠️ Overdue" : ""}
                  </Text>
                </View>
                <View style={S.billCardRight}>
                  <View style={[S.statusChip, { backgroundColor: st.bg }]}>
                    <Text style={[S.statusChipText, { color: st.text }]}>{st.label}</Text>
                  </View>
                  <Text style={S.billCardAmount}>{fmt(bill.baseAmount)}</Text>
                </View>
              </View>

              {bill.isPublished && (
                <>
                  <ProgressBar pct={paidPct} />
                  <View style={S.billCardFooter}>
                    <Text style={S.billFooterText}>✅ {bill.paidCount ?? 0} paid</Text>
                    <Text style={S.billFooterText}>⏳ {bill.unpaidCount ?? 0} pending</Text>
                    <Text style={[S.billFooterText, { color: C.teal, fontWeight: "700" }]}>{paidPct}% collected</Text>
                  </View>
                </>
              )}

              {/* Draft actions — Edit & Delete */}
              {isAdmin && isDraft && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); setEditBill(bill); }}
                    style={[S.draftActionBtn, { borderColor: C.amber + "50", backgroundColor: C.amber + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.draftActionText, { color: C.amber }]}>{t("maint_edit_draft", "✏️ Edit Draft")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); handleDeleteBill(bill._id); }}
                    style={[S.draftActionBtn, { borderColor: C.red + "40", backgroundColor: C.red + "10" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.draftActionText, { color: C.red }]}>{t("maint_delete_draft", "🗑 Delete")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>

      <CreateBillModal open={showCreate}  onClose={() => setShowCreate(false)} bill={null}     onSaved={handleBillSaved} />
      <CreateBillModal open={!!editBill}  onClose={() => setEditBill(null)}    bill={editBill} onSaved={(b, m) => { handleBillSaved(b, m); setEditBill(null); }} />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ROOT MaintenanceScreen ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export const MaintenanceScreen = () => {
  const { isAdmin } = useAuth();
  const [view,       setView]      = useState("dashboard"); // "dashboard" | "my-payments" | "defaulters"
  const [openBillId, setOpenBillId]= useState(null);

  if (view === "my-payments") return <MyPaymentsView  onBack={() => setView("dashboard")} />;
  if (view === "defaulters")  return <DefaulterView   onBack={() => setView("dashboard")} />;

  return (
    <>
      <MaintenanceDashboard
        isAdmin={isAdmin}
        onOpenBill={(id)     => setOpenBillId(id)}
        onOpenMyPayments={()  => setView("my-payments")}
        onOpenDefaulters={()  => setView("defaulters")}
      />
      <BillDetailModal
        open={!!openBillId}
        billId={openBillId}
        onClose={() => setOpenBillId(null)}
        isAdmin={isAdmin}
      />
    </>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.bg },
  center:           { alignItems: "center", justifyContent: "center", padding: 40 },

  // Header
  header:           { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  headerLabel:      { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 1.2 },
  headerTitle:      { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 4 },
  headerStats:      { flexDirection: "row", gap: 10, marginTop: 16 },

  // Sub-screen header (my-payments / defaulters)
  subHeader:        { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  subHeaderTitle:   { fontSize: 20, fontWeight: "800", color: "#fff", marginTop: 8 },
  backBtn:          { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  backBtnText:      { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Stat box
  statBox:          { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, alignItems: "center" },
  statIcon:         { fontSize: 18, marginBottom: 2 },
  statValue:        { fontSize: 16, fontWeight: "800", lineHeight: 20 },
  statLabel:        { fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, textAlign: "center" },
  summaryRow:       { flexDirection: "row", gap: 10, marginBottom: 16 },

  // Shortcuts
  shortcutCard:     { backgroundColor: C.teal + "0D", borderWidth: 1.5, borderColor: C.teal + "25", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shortcutDanger:   { backgroundColor: C.red + "08", borderColor: C.red + "20" },
  shortcutTitle:    { fontSize: 14, fontWeight: "700" },
  shortcutSub:      { fontSize: 12, color: C.gray500, marginTop: 2 },
  shortcutArrow:    { fontSize: 22 },

  // Filter row
  filterHeaderRow:  { flexDirection: "row", alignItems: "center", marginBottom: 10 },

  // Month chips
  monthChip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.gray100, marginRight: 6 },
  monthChipActive:  { backgroundColor: C.teal },
  monthChipText:    { fontSize: 11, fontWeight: "600", color: C.gray700 },
  monthChipTextActive:{ color: "#fff" },

  // Bill card
  billCardTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  billCardTitle:    { fontSize: 15, fontWeight: "700", color: C.navy, marginBottom: 2 },
  billCardMeta:     { fontSize: 11, color: C.gray500 },
  billCardRight:    { alignItems: "flex-end", gap: 4 },
  billCardAmount:   { fontSize: 15, fontWeight: "800", color: C.navy },
  billCardFooter:   { flexDirection: "row", gap: 12, marginTop: 6 },
  billFooterText:   { fontSize: 11, color: C.gray500 },
  draftActionBtn:   { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, alignItems: "center" },
  draftActionText:  { fontSize: 12, fontWeight: "700" },

  // Progress
  progressTrack:    { height: 5, backgroundColor: C.gray100, borderRadius: 3, overflow: "hidden", marginVertical: 6 },
  progressFill:     { height: "100%", borderRadius: 3 },
  pctLabel:         { fontSize: 11, color: C.teal, fontWeight: "700", textAlign: "right" },

  // Status chip
  statusChip:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText:   { fontSize: 10, fontWeight: "700" },

  // Bill detail
  billMetaRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  billMonth:        { fontSize: 11, color: C.gray500, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  billDue:          { fontSize: 13, color: C.text, marginTop: 2 },

  // Collection card
  collectionCard:   { backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 12 },
  collectionRow:    { flexDirection: "row", gap: 8, marginBottom: 8 },
  collectionBox:    { flex: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  collectionAmount: { fontSize: 14, fontWeight: "800" },
  collectionLabel:  { fontSize: 10, color: C.gray500, marginTop: 2 },

  // Detail card rows
  detailCard:       { backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 12 },
  detailRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  detailLabel:      { fontSize: 12, color: C.gray500, fontWeight: "600" },
  detailValue:      { fontSize: 13, color: C.text, fontWeight: "500", maxWidth: "60%", textAlign: "right" },

  // Section
  sectionRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8, marginTop: 4 },
  sectionTitle:     { fontSize: 12, fontWeight: "700", color: C.gray700, textTransform: "uppercase", letterSpacing: 0.6 },
  countBadge:       { backgroundColor: C.gray100, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1, marginLeft: 8 },
  countText:        { fontSize: 11, color: C.gray500 },

  // Admin actions
  actionRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },

  // Search
  searchRow:        { flexDirection: "row", alignItems: "center", backgroundColor: C.gray50, borderRadius: 10, borderWidth: 1.5, borderColor: C.gray100, paddingHorizontal: 10, marginBottom: 10 },
  searchIcon:       { fontSize: 14, color: C.gray300, marginRight: 6 },
  searchInput:      { flex: 1, paddingVertical: 9, fontSize: 13, color: C.text },

  // Payment rows
  paymentRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.gray100, gap: 10 },
  flatBadge:        { width: 36, height: 36, borderRadius: 8, backgroundColor: C.navy + "12", alignItems: "center", justifyContent: "center" },
  flatBadgeText:    { fontSize: 11, fontWeight: "800", color: C.navy },
  flatName:         { fontSize: 13, fontWeight: "700", color: C.text },
  flatResident:     { fontSize: 11, color: C.gray500, marginTop: 1 },
  paymentMeta:      { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 },
  paymentAmt:       { fontSize: 13, fontWeight: "800" },
  penaltyText:      { fontSize: 11, color: C.red },
  discountText:     { fontSize: 11, color: C.green },
  paidMeta:         { fontSize: 11, color: C.gray500, marginTop: 3 },

  recordActions:    { flexDirection: "column", gap: 4 },
  recordBtn:        { backgroundColor: C.teal, borderRadius: 7, paddingVertical: 5, paddingHorizontal: 10 },
  recordBtnText:    { fontSize: 11, fontWeight: "700", color: "#fff" },
  discountBtn:      { backgroundColor: C.amber + "20", borderRadius: 7, paddingVertical: 5, paddingHorizontal: 10, alignItems: "center" },
  discountBtnText:  { fontSize: 11, fontWeight: "700", color: C.amber },

  residentPayCard:  { backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 8 },

  // Info box (in modals)
  infoBox:          { backgroundColor: C.gray50, borderRadius: 10, padding: "10px 14px", marginBottom: 14 },
  infoTitle:        { fontSize: 13, fontWeight: "700", color: C.navy },
  infoMeta:         { fontSize: 12, color: C.gray500, marginTop: 2 },

  // Alert box
  alertBox:         { borderRadius: 12, padding: 12, marginTop: 4 },

  // Method picker
  methodPill:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100, marginRight: 8 },
  methodPillActive: { borderColor: C.teal, backgroundColor: C.teal + "15" },
  methodPillText:   { fontSize: 11, fontWeight: "700", color: C.gray700 },
  methodPillTextActive:{ color: C.teal },

  // Target mode
  targetRow:        { flexDirection: "row", gap: 8, marginBottom: 14 },
  targetBtn:        { flex: 1, padding: 9, borderRadius: 8, backgroundColor: C.gray100, alignItems: "center" },
  targetBtnActive:  { backgroundColor: C.navy },
  targetBtnText:    { fontSize: 13, fontWeight: "600", color: C.gray700 },
  targetBtnTextActive:{ color: "#fff" },

  // Toggle
  toggleRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.gray50, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.gray100 },
  toggleLabel:      { fontSize: 13, fontWeight: "600", color: C.text },
  toggleHint:       { fontSize: 11, color: C.gray500, marginTop: 2 },

  // My bills
  myBillRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  myBillTitle:      { fontSize: 14, fontWeight: "700", color: C.navy, marginBottom: 2 },
  myBillMeta:       { fontSize: 11, color: C.gray500, marginBottom: 6 },

  // Defaulter row
  defaulterRow:     { flexDirection: "row", alignItems: "center", gap: 12 },

  // Skeleton
  skeletonBlock:    { backgroundColor: C.gray100, borderRadius: 14, marginBottom: 10 },

  // Empty bills
  emptyBills:       { backgroundColor: C.gray50, borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1.5, borderColor: C.gray100, borderStyle: "dashed", marginTop: 8 },
  emptyBillsIcon:   { fontSize: 40, marginBottom: 12 },
  emptyBillsTitle:  { fontSize: 15, fontWeight: "700", color: C.gray700, marginBottom: 6 },
  emptyBillsSub:    { fontSize: 13, color: C.gray500, textAlign: "center", lineHeight: 20 },

  // Form helpers
  inputLabel:       { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 5 },
  row:              { flexDirection: "row" },
});
