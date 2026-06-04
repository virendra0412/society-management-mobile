/**
 * src/screens/sa/SADashboard.jsx
 * Super Admin dashboard with overview stats and quick actions
 * React Native / Expo version
 */

import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSAAuth } from "../../context/SAAuthContext";
import { saAnalyticsApi } from "../../api/sa.api";
import { COLORS, SPACING } from "../../constants/theme";

const SADashboard = ({ navigation }) => {
  const { saUser, logout } = useSAAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await saAnalyticsApi.overview({ period: "30d" });
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert("Error", "Logout failed");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            Welcome, {saUser?.name || "Admin"}
          </Text>
          <Text style={styles.subtitleText}>Platform Overview</Text>
        </View>

        {analytics && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {analytics.totalSocieties || 0}
              </Text>
              <Text style={styles.statLabel}>Total Societies</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {analytics.activeSocieties || 0}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.warning }]}>
                {analytics.pendingApplications || 0}
              </Text>
              <Text style={styles.statLabel}>Pending Apps</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ₹{(analytics.totalRevenue || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Revenue (30d)</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("SAApplications")}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionIcon}>📋</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>
                  Manage Applications
                </Text>
                <Text style={styles.actionSubtitle}>
                  Review new society applications
                </Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("SASocieties")}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionIcon}>🏘️</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Manage Societies</Text>
                <Text style={styles.actionSubtitle}>
                  Monitor and control societies
                </Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("SAAnalytics")}
            activeOpacity={0.7}
          >
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionIcon}>📊</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>View Analytics</Text>
                <Text style={styles.actionSubtitle}>
                  Platform statistics and reports
                </Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitleText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  actionArrow: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.lg,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SADashboard;
