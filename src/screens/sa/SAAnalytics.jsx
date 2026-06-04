/**
 * src/screens/sa/SAAnalytics.jsx
 * Super Admin analytics dashboard — platform statistics and reports
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
import { saAnalyticsApi } from "../../api/sa.api";
import { COLORS, SPACING } from "../../constants/theme";

const SAAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("30d");

  const periods = [
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
  ];

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      const res = await saAnalyticsApi.overview({ period });
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      Alert.alert("Error", "Failed to load analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };

  const formatCurrency = (value) => {
    if (!value) return "₹0";
    return `₹${value.toLocaleString("en-IN")}`;
  };

  const formatNumber = (value) => {
    if (!value) return "0";
    return value.toLocaleString("en-IN");
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
        <View style={styles.periodContainer}>
          <Text style={styles.periodLabel}>Time Period:</Text>
          <View style={styles.periodButtons}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.periodButton,
                  period === p.value && styles.periodButtonActive,
                ]}
                onPress={() => {
                  setLoading(true);
                  setPeriod(p.value);
                }}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    period === p.value && styles.periodButtonTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {analytics && (
          <>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Total Societies"
                value={formatNumber(analytics.totalSocieties)}
                color={COLORS.primary}
                icon="🏘️"
              />
              <MetricCard
                title="Active Societies"
                value={formatNumber(analytics.activeSocieties)}
                color={COLORS.success}
                icon="✅"
              />
              <MetricCard
                title="Total Users"
                value={formatNumber(analytics.totalUsers)}
                color={COLORS.info}
                icon="👥"
              />
              <MetricCard
                title="Total Units"
                value={formatNumber(analytics.totalUnits)}
                color="#FF9800"
                icon="🏠"
              />
            </View>

            <Text style={styles.sectionTitle}>Revenue</Text>
            <View style={styles.revenueGrid}>
              <MetricCard
                title={`Total Revenue (${period})`}
                value={formatCurrency(analytics.totalRevenue)}
                color={COLORS.success}
                icon="💰"
              />
              <MetricCard
                title="Pending Payments"
                value={formatCurrency(analytics.pendingPayments)}
                color={COLORS.warning}
                icon="⏳"
              />
            </View>

            <Text style={styles.sectionTitle}>Applications</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Pending"
                value={formatNumber(analytics.pendingApplications)}
                color={COLORS.warning}
                icon="📋"
              />
              <MetricCard
                title="Approved"
                value={formatNumber(analytics.approvedApplications)}
                color={COLORS.success}
                icon="✓"
              />
              <MetricCard
                title="Rejected"
                value={formatNumber(analytics.rejectedApplications)}
                color={COLORS.error}
                icon="✕"
              />
              <MetricCard
                title="Total"
                value={formatNumber(analytics.totalApplications)}
                color={COLORS.textSecondary}
                icon="📊"
              />
            </View>

            {analytics.subscriptionMetrics && (
              <>
                <Text style={styles.sectionTitle}>Subscriptions</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Trial Plans"
                    value={formatNumber(
                      analytics.subscriptionMetrics.trialPlans
                    )}
                    color="#17A2B8"
                    icon="🆓"
                  />
                  <MetricCard
                    title="Basic Plans"
                    value={formatNumber(
                      analytics.subscriptionMetrics.basicPlans
                    )}
                    color="#6C757D"
                    icon="📦"
                  />
                  <MetricCard
                    title="Premium Plans"
                    value={formatNumber(
                      analytics.subscriptionMetrics.premiumPlans
                    )}
                    color="#FFD700"
                    icon="⭐"
                  />
                  <MetricCard
                    title="Enterprise"
                    value={formatNumber(
                      analytics.subscriptionMetrics.enterprisePlans
                    )}
                    color="#FF6B6B"
                    icon="👑"
                  />
                </View>
              </>
            )}

            {analytics.activityMetrics && (
              <>
                <Text style={styles.sectionTitle}>Activity</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Events Created"
                    value={formatNumber(analytics.activityMetrics.eventsCreated)}
                    color={"#9C27B0"}
                    icon="🎉"
                  />
                  <MetricCard
                    title="Maintenance Bills"
                    value={formatNumber(
                      analytics.activityMetrics.maintenanceBills
                    )}
                    color={"#FF9800"}
                    icon="📄"
                  />
                  <MetricCard
                    title="Issues Reported"
                    value={formatNumber(analytics.activityMetrics.issuesReported)}
                    color={"#E91E63"}
                    icon="🐛"
                  />
                  <MetricCard
                    title="Visitors Registered"
                    value={formatNumber(
                      analytics.activityMetrics.visitorsRegistered
                    )}
                    color={"#2196F3"}
                    icon="👤"
                  />
                </View>
              </>
            )}

            {analytics.growth && (
              <>
                <Text style={styles.sectionTitle}>Growth</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="New Societies"
                    value={formatNumber(analytics.growth.newSocieties)}
                    color={COLORS.success}
                    icon="📈"
                  />
                  <MetricCard
                    title="New Users"
                    value={formatNumber(analytics.growth.newUsers)}
                    color={COLORS.info}
                    icon="👥"
                  />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const MetricCard = ({ title, value, color, icon }) => (
  <View style={styles.card}>
    <View
      style={[
        styles.cardIconContainer,
        { backgroundColor: `${color}20` },
      ]}
    >
      <Text style={styles.cardIcon}>{icon}</Text>
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={[styles.cardValue, { color }]}>{value}</Text>
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  periodContainer: {
    marginBottom: SPACING.xl,
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  periodButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.lg,
    marginTop: SPACING.lg,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  revenueGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  card: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: "center",
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});

export default SAAnalytics;
