/**
 * src/screens/sa/SAApplications.jsx
 * Super Admin applications management — approve/reject society applications
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
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saApplicationsApi } from "../../api/sa.api";
import { COLORS, SPACING } from "../../constants/theme";

const SAApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const filters = ["pending", "approved", "rejected"];

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    try {
      const res = await saApplicationsApi.getAll({ status: filter });
      setApplications(res.data?.applications || []);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
      Alert.alert("Error", "Failed to load applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (id) => {
    Alert.alert(
      "Approve Application",
      "This will create a new society. Continue?",
      [
        { text: "Cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setActionLoading(true);
            try {
              await saApplicationsApi.approve(id);
              Alert.alert("Success", "Application approved");
              fetchApplications();
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to approve"
              );
            } finally {
              setActionLoading(false);
            }
          },
          style: "default",
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      Alert.alert("Error", "Please provide a rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      await saApplicationsApi.reject(selectedApp._id || selectedApp.id, rejectNote);
      Alert.alert("Success", "Application rejected");
      setShowModal(false);
      setRejectNote("");
      setSelectedApp(null);
      fetchApplications();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to reject"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "pending":
        return COLORS.warning;
      case "approved":
        return COLORS.success;
      case "rejected":
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderApplicationCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.societyName} numberOfLines={2}>
            {item.societyName}
          </Text>
          <Text style={styles.location} numberOfLines={1}>
            📍 {item.city}, {item.state}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusBadgeColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <DetailRow label="Contact" value={item.adminName || item.contactName || item.name} />
        <DetailRow label="Email" value={item.adminEmail || item.email || item.adminEmail} />
        <DetailRow label="Phone" value={item.adminPhone || item.phone || item.adminPhone} />
        <DetailRow
          label="Units"
          value={`${item.totalUnits || "N/A"} units`}
        />
      </View>

      {item.status === "pending" && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item._id)}
            disabled={actionLoading}
          >
            <Text style={styles.approveButtonText}>✓ Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              setSelectedApp(item);
              setShowModal(true);
            }}
            disabled={actionLoading}
          >
            <Text style={styles.rejectButtonText}>✕ Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => {
              setLoading(true);
              setFilter(f);
            }}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === f && styles.filterTabTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={applications}
        renderItem={renderApplicationCard}
        keyExtractor={(item) => item._id?.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchApplications();
            }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No applications found</Text>
        }
      />

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          setRejectNote("");
          setSelectedApp(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            <Text style={styles.modalSubtitle}>
              {selectedApp?.societyName}
            </Text>

            <TextInput
              style={styles.rejectInput}
              placeholder="Reason for rejection..."
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={4}
              value={rejectNote}
              onChangeText={setRejectNote}
              editable={!actionLoading}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowModal(false);
                  setRejectNote("");
                  setSelectedApp(null);
                }}
                disabled={actionLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue} numberOfLines={1}>
      {value}
    </Text>
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
    paddingHorizontal: SPACING.md,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
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
  cardDetails: {
    padding: SPACING.md,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButton: {
    backgroundColor: "rgba(40, 167, 69, 0.1)",
  },
  approveButtonText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: "600",
  },
  rejectButton: {
    backgroundColor: "rgba(220, 53, 69, 0.1)",
  },
  rejectButtonText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: "top",
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  submitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SAApplications;