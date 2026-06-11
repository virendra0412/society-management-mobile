/**
 * src/screens/sa/SASocieties.jsx
 * Super Admin societies management — monitor and control all societies
 * React Native / Expo version
 */

import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saSocietiesApi } from "../../api/sa.api";
import { COLORS, SPACING } from "../../constants/theme";

const SASocieties = ({ navigation }) => {
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSociety, setSelectedSociety] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendNote, setSuspendNote] = useState("");

  // Transfer Admin
  const [showTransferModal, setShowTransferModal]   = useState(false);
  const [transferEmail, setTransferEmail]           = useState("");
  const [transferLoading, setTransferLoading]       = useState(false);

  // Reset Admin Password
  const [resetLoading, setResetLoading]             = useState(false);
  const [resetResult, setResetResult]               = useState(null); // { adminEmail, tempPassword }

  const statusOptions = ["all", "active", "suspended", "trial"];

  useEffect(() => {
    fetchSocieties();
  }, [statusFilter]);

  const fetchSocieties = async () => {
    try {
      const params = {};
      if (statusFilter === "active")    params.isActive = true;
      if (statusFilter === "suspended") params.isActive = false;
      const res = await saSocietiesApi.getAll(params);
      let list = res.data?.societies || [];
      if (statusFilter === "trial") {
        list = list.filter((s) => s.subscription?.plan === "trial");
      }
      setSocieties(list);
    } catch (error) {
      console.error("Failed to fetch societies:", error);
      Alert.alert("Error", "Failed to load societies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSuspend = async (id) => {
    if (!suspendNote.trim()) {
      Alert.alert("Error", "Please provide a reason for suspension");
      return;
    }

    setActionLoading(true);
    try {
      await saSocietiesApi.suspend(id, suspendNote);
      Alert.alert("Success", "Society suspended");
      setSuspendNote("");
      setShowDetailsModal(false);
      setSelectedSociety(null);
      fetchSocieties();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to suspend"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (id) => {
    Alert.alert(
      "Reactivate Society",
      "Restore this society to active status?",
      [
        { text: "Cancel" },
        {
          text: "Reactivate",
          onPress: async () => {
            setActionLoading(true);
            try {
              await saSocietiesApi.reactivate(id);
              Alert.alert("Success", "Society reactivated");
              setShowDetailsModal(false);
              setSelectedSociety(null);
              fetchSocieties();
            } catch (error) {
              Alert.alert("Error", "Failed to reactivate");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleTransferAdmin = async () => {
    const email = transferEmail.trim();
    if (!email) {
      Alert.alert("Error", "Please enter the new admin's email address.");
      return;
    }
    const societyId = selectedSociety?._id || selectedSociety?.id;
    setTransferLoading(true);
    try {
      // Backend expects newAdminUserId; we pass email and let the SA look up
      // the user. If your backend validator accepts email, swap field name here.
      await saSocietiesApi.transferAdmin(societyId, { newAdminEmail: email });
      Alert.alert("Success", "Admin ownership transferred successfully.");
      setShowTransferModal(false);
      setTransferEmail("");
      setShowDetailsModal(false);
      setSelectedSociety(null);
      fetchSocieties();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to transfer admin.");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const societyId = selectedSociety?._id || selectedSociety?.id;
    Alert.alert(
      "Reset Admin Password",
      `Generate a new temporary password for ${selectedSociety?.name}'s admin?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResetLoading(true);
            try {
              const res = await saSocietiesApi.resetAdminPass(societyId);
              const data = res.data || res;
              setResetResult({
                adminEmail:   data.adminEmail   || "—",
                tempPassword: data.tempPassword || "(not returned in production)",
              });
            } catch (error) {
              Alert.alert("Error", error.response?.data?.message || "Failed to reset password.");
            } finally {
              setResetLoading(false);
            }
          },
        },
      ]
    );
  };


  //   s.name.toLowerCase().includes(searchText.toLowerCase())
  // );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return COLORS.success;
      case "suspended":
        return COLORS.error;
      case "trial":
        return COLORS.info;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderSocietyCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedSociety(item);
        setShowDetailsModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.societyName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.location} numberOfLines={1}>
            📍 {item.city}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status?.charAt(0).toUpperCase() +
              item.status?.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardStats}>
        <StatItem label="Units" value={item.totalUnits || 0} />
        <StatItem
          label="Users"
          value={(item.totalUsers || 0).toLocaleString()}
        />
        <StatItem label="Plan" value={item.plan || "Free"} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search societies..."
          placeholderTextColor={COLORS.placeholder}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.filterContainer}>
        {statusOptions.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              statusFilter === status && styles.filterTabActive,
            ]}
            onPress={() => {
              setLoading(true);
              setStatusFilter(status);
            }}
          >
            <Text
              style={[
                styles.filterTabText,
                statusFilter === status && styles.filterTabTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredSocieties}
        renderItem={renderSocietyCard}
        keyExtractor={(item) => item._id?.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchSocieties();
            }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No societies found</Text>
        }
      />

      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowDetailsModal(false);
          setSelectedSociety(null);
          setSuspendNote("");
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowDetailsModal(false);
                setSelectedSociety(null);
                setSuspendNote("");
              }}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedSociety?.name}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.detailsSection}>
              <DetailItem label="City" value={selectedSociety?.city} />
              <DetailItem label="State" value={selectedSociety?.state} />
              <DetailItem label="Status" value={selectedSociety?.status} />
              <DetailItem
                label="Plan"
                value={selectedSociety?.plan || "Free"}
              />
              <DetailItem
                label="Total Units"
                value={selectedSociety?.totalUnits || "N/A"}
              />
              <DetailItem
                label="Total Users"
                value={selectedSociety?.totalUsers || 0}
              />
              <DetailItem
                label="Created"
                value={
                  selectedSociety?.createdAt
                    ? new Date(selectedSociety.createdAt).toLocaleDateString()
                    : "N/A"
                }
              />
            </View>

            <TouchableOpacity
              style={styles.modulesButton}
              onPress={() => {
                const societyId = selectedSociety?._id || selectedSociety?.id;
                setShowDetailsModal(false);
                setSelectedSociety(null);
                navigation.navigate("SAModules", { societyId });
              }}
              disabled={actionLoading}
            >
              <Text style={styles.modulesButtonText}>Manage Modules</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.analyticsButton}
              onPress={() => {
                const societyId = selectedSociety?._id || selectedSociety?.id;
                setShowDetailsModal(false);
                setSelectedSociety(null);
                navigation.navigate("SAAnalytics", { societyId });
              }}
              disabled={actionLoading}
            >
              <Text style={styles.analyticsButtonText}>View Analytics</Text>
            </TouchableOpacity>

            {/* ── Transfer Admin ─────────────────────────────────────── */}
            <TouchableOpacity
              style={styles.transferButton}
              onPress={() => setShowTransferModal(true)}
              disabled={actionLoading || resetLoading}
            >
              <Text style={styles.transferButtonText}>Transfer Admin</Text>
            </TouchableOpacity>

            {/* ── Reset Admin Password ───────────────────────────────── */}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetPassword}
              disabled={actionLoading || resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Admin Password</Text>
              )}
            </TouchableOpacity>

            {selectedSociety?.status?.toLowerCase() === "suspended" ? (
              <TouchableOpacity
                style={styles.reactivateButton}
                onPress={() =>
                  handleReactivate(selectedSociety._id || selectedSociety.id)
                }
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.reactivateButtonText}>
                    Reactivate Society
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.suspendSection}>
                  <Text style={styles.suspendLabel}>
                    Suspension Reason (optional):
                  </Text>
                  <TextInput
                    style={styles.suspendInput}
                    placeholder="Enter reason..."
                    placeholderTextColor={COLORS.placeholder}
                    multiline
                    numberOfLines={3}
                    value={suspendNote}
                    onChangeText={setSuspendNote}
                    editable={!actionLoading}
                  />
                </View>
                <TouchableOpacity
                  style={styles.suspendButton}
                  onPress={() => handleSuspend(selectedSociety._id || selectedSociety.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.suspendButtonText}>
                      Suspend Society
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Transfer Admin Modal ───────────────────────────────────────── */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowTransferModal(false); setTransferEmail(""); }}
      >
        <View style={styles.overlayBg}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Transfer Admin</Text>
            <Text style={styles.alertBody}>
              Enter the email address of an existing approved member of{" "}
              <Text style={{ fontWeight: "700" }}>{selectedSociety?.name}</Text>.
            </Text>
            <TextInput
              style={styles.alertInput}
              placeholder="member@email.com"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={transferEmail}
              onChangeText={setTransferEmail}
              editable={!transferLoading}
            />
            <View style={styles.alertActions}>
              <TouchableOpacity
                style={styles.alertCancel}
                onPress={() => { setShowTransferModal(false); setTransferEmail(""); }}
                disabled={transferLoading}
              >
                <Text style={styles.alertCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertConfirm}
                onPress={handleTransferAdmin}
                disabled={transferLoading}
              >
                {transferLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.alertConfirmText}>Transfer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reset Password Result Modal ────────────────────────────────── */}
      <Modal
        visible={!!resetResult}
        transparent
        animationType="fade"
        onRequestClose={() => setResetResult(null)}
      >
        <View style={styles.overlayBg}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Temporary Password Generated</Text>
            <Text style={styles.alertBody}>
              Send these credentials to the society admin securely.
            </Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Admin email</Text>
              <Text style={styles.resultValue} selectable>{resetResult?.adminEmail}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Temp password</Text>
              <Text style={[styles.resultValue, styles.resultPassword]} selectable>
                {resetResult?.tempPassword}
              </Text>
            </View>
            <Text style={styles.resultNote}>
              The admin must change this password on next login.
            </Text>
            <TouchableOpacity
              style={[styles.alertConfirm, { marginTop: 16 }]}
              onPress={() => setResetResult(null)}
            >
              <Text style={styles.alertConfirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const StatItem = ({ label, value }) => (
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const DetailItem = ({ label, value }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value || "N/A"}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: "#fff",
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  societyName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  location: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 4,
    marginLeft: SPACING.md,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  cardStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalHeaderSpacer: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  detailsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  suspendSection: {
    marginBottom: SPACING.lg,
  },
  suspendLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  suspendInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: 13,
    color: COLORS.text,
    textAlignVertical: "top",
  },
  suspendButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
  suspendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modulesButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modulesButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  analyticsButton: {
    backgroundColor: COLORS.info,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  analyticsButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  reactivateButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
  reactivateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  transferButton: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  transferButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#6B7280",
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  overlayBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  alertBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: SPACING.lg,
    width: "100%",
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  alertBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  alertInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  alertActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  alertCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  alertCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  alertConfirm: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  alertConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  resultValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
  resultPassword: {
    fontFamily: "monospace",
    color: COLORS.error,
    fontWeight: "700",
  },
  resultNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },
});

export default SASocieties;