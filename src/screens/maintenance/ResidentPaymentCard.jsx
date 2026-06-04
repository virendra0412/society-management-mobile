/**
 * screens/maintenance/ResidentPaymentCard.jsx
 * React Native port of the web ResidentPaymentCard.
 *
 * Shown inside BillDetailView when the viewer is a resident.
 * The backend scopes bill.payments to only the resident's own record,
 * so this card always receives payment = bill.payments[0] or null.
 *
 * Props:
 *   payment  — single payment sub-document (bill.payments[0]) or null
 *   bill     — parent bill object (for dueDate, title context)
 *
 * Web → RN changes:
 *   div/span    → View/Text
 *   CSS strings → StyleSheet numbers
 *   fontFamily "Syne" → fontWeight "800" (fallback; add expo-font for Syne)
 */
import { View, Text, StyleSheet } from "react-native";
import { Badge }                   from "../../components/ui";
import { C, PAYMENT_STATUS_COLOR } from "../../constants/theme";

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

// ─── No-record state ──────────────────────────────────────────────────────────
const NoRecord = () => (
  <View style={styles.noRecord}>
    <Text style={styles.noRecordIcon}>🔍</Text>
    <Text style={styles.noRecordTitle}>No record found</Text>
    <Text style={styles.noRecordBody}>
      You don't have a payment record for this bill.
      This may be because it targets specific flats only.
      Contact your society admin if you believe this is an error.
    </Text>
  </View>
);

// ─── Amount breakdown row ─────────────────────────────────────────────────────
const BreakdownRow = ({ label, value, color, bold, topBorder }) => (
  <View style={[styles.breakdownRow, topBorder && styles.breakdownTopBorder]}>
    <Text style={[styles.breakdownLabel, bold && { fontWeight: "700", color: C.gray700 }]}>
      {label}
    </Text>
    <Text style={[styles.breakdownValue, { color: color || C.text }, bold && { fontSize: 15, fontWeight: "800" }]}>
      {value}
    </Text>
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────
export const ResidentPaymentCard = ({ payment, bill }) => {
  if (!payment) return <NoRecord />;

  const sc        = PAYMENT_STATUS_COLOR[payment.status] ?? {};
  const isPaid    = payment.status === "paid" || payment.status === "waived";
  const isOverdue = payment.status === "overdue";

  // Banner gradient colours simulated with solid tinted backgrounds
  const bannerBg    = isPaid ? C.green + "18" : isOverdue ? C.red + "12" : C.teal + "10";
  const bannerBorder= isPaid ? C.green + "25" : isOverdue ? C.red + "25" : C.teal + "25";
  const amountColor = isPaid ? C.green : isOverdue ? C.red : C.navy;
  const bannerIcon  = isPaid ? "✅" : isOverdue ? "⚠️" : "⏳";

  return (
    <View style={styles.container}>

      {/* ── Status banner ─────────────────────────────────────────────────── */}
      <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
        <Text style={styles.bannerIcon}>{bannerIcon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerAmount, { color: amountColor }]}>
            {fmt(isPaid ? (payment.paidAmount || payment.totalDue) : payment.totalDue)}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Badge
              label={payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              bg={sc.bg}
              text={sc.text}
              dot={sc.dot}
            />
          </View>
        </View>
      </View>

      {/* ── Amount breakdown ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Amount Breakdown</Text>

        <BreakdownRow label="Base Amount"  value={fmt(payment.amount)}   color={C.text} />
        {payment.penalty  > 0 && (
          <BreakdownRow label="Late Penalty"  value={`+ ${fmt(payment.penalty)}`}  color={C.red}   />
        )}
        {payment.discount > 0 && (
          <BreakdownRow label="Discount"      value={`- ${fmt(payment.discount)}`} color={C.green} />
        )}
        <BreakdownRow
          label="Total Due"
          value={fmt(payment.totalDue)}
          color={C.navy}
          bold
          topBorder
        />
      </View>

      {/* ── Due date warning (unpaid only) ────────────────────────────────── */}
      {!isPaid && (
        <View style={[
          styles.dueDateRow,
          { backgroundColor: isOverdue ? C.red + "10" : C.amber + "10",
            borderColor:      isOverdue ? C.red + "25" : C.amber + "25" },
        ]}>
          <Text style={styles.dueDateIcon}>{isOverdue ? "🔴" : "📅"}</Text>
          <View>
            <Text style={[styles.dueDateTitle, { color: isOverdue ? C.red : C.amber }]}>
              {isOverdue ? "Payment Overdue" : "Due Date"}
            </Text>
            <Text style={styles.dueDateValue}>
              {fmtDate(bill?.dueDate)}
              {isOverdue ? " — please pay as soon as possible." : ""}
            </Text>
          </View>
        </View>
      )}

      {/* ── Payment receipt (paid / waived only) ──────────────────────────── */}
      {isPaid && (
        <View style={styles.receiptSection}>
          <Text style={styles.receiptTitle}>✅  Payment Receipt</Text>

          {[
            ["Paid On",   fmtDate(payment.paidAt)],
            ["Method",    payment.paymentMethod?.toUpperCase()],
            payment.transactionId && ["Reference", payment.transactionId],
            payment.receiptNote   && ["Note",       payment.receiptNote],
          ].filter(Boolean).map(([label, value]) => (
            <View key={label} style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>{label}</Text>
              <Text style={styles.receiptValue} numberOfLines={2}>{value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginTop: 8 },

  // No-record
  noRecord:     { backgroundColor: C.gray50, borderRadius: 14, padding: 24, alignItems: "center", borderWidth: 1.5, borderColor: C.gray100, borderStyle: "dashed", marginTop: 8 },
  noRecordIcon: { fontSize: 32, marginBottom: 10 },
  noRecordTitle:{ fontSize: 15, fontWeight: "700", color: C.gray700, marginBottom: 6 },
  noRecordBody: { fontSize: 13, color: C.gray500, textAlign: "center", lineHeight: 20 },

  // Banner
  banner:       { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 14 },
  bannerIcon:   { fontSize: 36 },
  bannerAmount: { fontSize: 24, fontWeight: "800" },

  // Breakdown section
  section:       { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.gray100, marginBottom: 14 },
  sectionLabel:  { fontSize: 11, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  breakdownRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: C.gray100 },
  breakdownTopBorder: { borderTopWidth: 2, borderColor: C.gray100, marginTop: 2 },
  breakdownLabel:{ fontSize: 13, color: C.gray500, fontWeight: "500" },
  breakdownValue:{ fontSize: 14, fontWeight: "600" },

  // Due date
  dueDateRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  dueDateIcon:   { fontSize: 20 },
  dueDateTitle:  { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  dueDateValue:  { fontSize: 12, color: C.gray700, lineHeight: 18 },

  // Receipt
  receiptSection:{ backgroundColor: C.green + "08", borderRadius: 12, borderWidth: 1, borderColor: C.green + "20", padding: 14 },
  receiptTitle:  { fontSize: 12, fontWeight: "700", color: C.green, marginBottom: 10 },
  receiptRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderColor: C.green + "15" },
  receiptLabel:  { fontSize: 12, color: C.gray500 },
  receiptValue:  { fontSize: 12, color: C.text, fontWeight: "600", textAlign: "right", maxWidth: "60%" },
});