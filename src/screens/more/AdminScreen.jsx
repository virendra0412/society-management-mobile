/**
 * screens/more/AdminScreen.jsx
 *
 * Converted from web AdminScreen.jsx → React Native (Expo).
 * Features:
 *   • Approve / reject resident registrations
 *   • Session stats (approved/rejected counts)
 *   • Refresh pending list
 *   • Info note about rejected members
 */
import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { userApi }  from "../../api/resources.api";
import { useToast } from "../../context/ToastContext";
import {
  Badge, Btn, Card, EmptyState, Spinner, ScreenHeader,
} from "../../components/ui";
import { C } from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, count, color }) => (
  <View style={[s.statPill, { backgroundColor: color + "12", borderColor: color + "25" }]}>
    <Text style={[s.statCount, { color }]}>{count}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

// ─── Pending Member Card ──────────────────────────────────────────────────────
const PendingCard = ({ member, onApprove, onReject, busy }) => (
  <Card style={{ marginBottom: 10 }}>
    {/* Member info */}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
      {/* Avatar */}
      <View style={s.avatarBox}>
        <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.memberName}>{member.name}</Text>
        <Text style={s.memberEmail}>{member.email}</Text>
        <Text style={s.memberMeta}>
          {[member.flat && `Flat ${member.flat}`, member.wing && member.wing].filter(Boolean).join(" · ") || "No flat info"}
          {" · "}{timeAgo(member.createdAt)}
        </Text>
      </View>
      <Badge label="Pending" bg="#FEF3C7" text="#92400E" dot="#F59E0B" />
    </View>

    {/* Phone */}
    {!!member.phone && (
      <View style={s.phoneBox}>
        <Text style={s.phoneText}>📞 {member.phone}</Text>
      </View>
    )}

    {/* Actions */}
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Btn
        small variant="primary"
        onPress={() => onApprove(member._id)}
        loading={busy === member._id + "_approve"}
        style={{ flex: 1 }}
      >
        ✓ Approve
      </Btn>
      <Btn
        small variant="danger"
        onPress={() => onReject(member._id)}
        loading={busy === member._id + "_reject"}
        style={{ flex: 1 }}
      >
        ✕ Reject
      </Btn>
    </View>
  </Card>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const AdminScreen = ({ navigation }) => {
  const toast = useToast();

  const [pending,       setPending]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [busy,          setBusy]          = useState(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await userApi.getPendingMembers();
      setPending(res.data.members || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load pending members");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadPending(); }, []);

  const handleApprove = async (userId) => {
    setBusy(userId + "_approve");
    try {
      await userApi.approveMember(userId);
      setPending((p) => p.filter((m) => m._id !== userId));
      setApprovedCount((c) => c + 1);
      toast.success("Member approved successfully!");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Approval failed");
    } finally { setBusy(null); }
  };

  const handleReject = async (userId) => {
    setBusy(userId + "_reject");
    try {
      await userApi.rejectMember(userId);
      setPending((p) => p.filter((m) => m._id !== userId));
      setRejectedCount((c) => c + 1);
      toast.success("Member rejected.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Rejection failed");
    } finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerSub}>Admin Panel</Text>
        <Text style={s.headerTitle}>👑 Member Approvals</Text>
        <Text style={s.headerDesc}>Review and approve new residents joining your society</Text>
      </View>

      <FlatList
        data={pending}
        keyExtractor={(m) => m._id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View>
            {/* Session stats */}
            {(approvedCount > 0 || rejectedCount > 0) && (
              <Card style={{ marginBottom: 16 }}>
                <Text style={s.sectionLabel}>This Session</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <StatPill label="Approved" count={approvedCount} color={C.green} />
                  <StatPill label="Rejected" count={rejectedCount} color={C.red} />
                </View>
              </Card>
            )}

            {/* Pending header row */}
            <View style={s.pendingHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={s.pendingHeaderText}>Pending Requests</Text>
                {pending.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{pending.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={loadPending}
                disabled={loading}
                style={s.refreshBtn}
              >
                {loading ? <Spinner size={12} /> : <Text style={s.refreshBtnText}>↻ Refresh</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          loading ? (
            <View style={{ gap: 10 }}>
              {[1, 2, 3].map((k) => (
                <View key={k} style={s.skeleton} />
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState icon="✅" message="No pending approvals. All caught up!" />
            </Card>
          )
        )}
        ListFooterComponent={() => (
          <View style={s.infoBanner}>
            <Text style={s.infoBannerText}>
              ℹ️ Rejected members will have their accounts deactivated. They will need to re-register with a new account to join.
            </Text>
          </View>
        )}
        renderItem={({ item: member }) => (
          <PendingCard
            member={member}
            onApprove={handleApprove}
            onReject={handleReject}
            busy={busy}
          />
        )}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  header:          { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  headerSub:       { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:     { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerDesc:      { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 },
  list:            { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  sectionLabel:    { fontSize: 11, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  statPill:        { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1 },
  statCount:       { fontSize: 22, fontWeight: "800" },
  statLabel:       { fontSize: 11, color: C.gray500, marginTop: 2 },
  pendingHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pendingHeaderText:{ fontSize: 13, fontWeight: "700", color: C.gray700 },
  countBadge:      { backgroundColor: C.amber + "25", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:  { fontSize: 11, fontWeight: "700", color: C.amber },
  refreshBtn:      { borderWidth: 1, borderColor: C.gray100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refreshBtnText:  { fontSize: 11, color: C.gray700 },
  avatarBox:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purple + "20", alignItems: "center", justifyContent: "center" },
  avatarText:      { fontSize: 18, fontWeight: "700", color: C.purple },
  memberName:      { fontSize: 14, fontWeight: "700", color: C.text },
  memberEmail:     { fontSize: 12, color: C.gray500 },
  memberMeta:      { fontSize: 11, color: C.gray500, marginTop: 2 },
  phoneBox:        { backgroundColor: C.gray50, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  phoneText:       { fontSize: 12, color: C.gray700 },
  skeleton:        { height: 130, borderRadius: 14, backgroundColor: C.gray100 },
  infoBanner:      { marginTop: 16, padding: 14, backgroundColor: C.blue + "10", borderRadius: 12, borderWidth: 1, borderColor: C.blue + "25" },
  infoBannerText:  { fontSize: 12, color: C.blue, lineHeight: 18 },
});