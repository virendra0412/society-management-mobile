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

  const filteredSocieties = societies.filter((s) =>
    s.name.toLowerCase().includes(searchText.toLowerCase())
  );

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
});

export default SASocieties;