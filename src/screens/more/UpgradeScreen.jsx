/**
 * src/screens/more/UpgradeScreen.jsx
 * Society Admin view — shows module status (read-only) with "Request Upgrade" buttons
 * for locked modules. Mirrors what SA sees but is read-only.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { modulesApi } from "../../api/resources.api";
import { COLORS, SPACING } from "../../constants/theme";

const MODULE_META = {
  notices:     { icon: "📢", labelKey: "upgrade_mod_notices_label", descKey: "upgrade_mod_notices_desc", label: "Notices", desc: "Post announcements. Always free." },
  polls:       { icon: "🗳️", labelKey: "upgrade_mod_polls_label", descKey: "upgrade_mod_polls_desc", label: "Polls", desc: "Vote on decisions. Always free." },
  contacts:    { icon: "📞", labelKey: "upgrade_mod_contacts_label", descKey: "upgrade_mod_contacts_desc", label: "Contacts", desc: "Emergency & vendor directory. Always free." },
  issues:      { icon: "🔧", labelKey: "upgrade_mod_issues_label", descKey: "upgrade_mod_issues_desc", label: "Issues", desc: "Complaint tracking, escalation, assignment." },
  visitors:    { icon: "👁️", labelKey: "upgrade_mod_visitors_label", descKey: "upgrade_mod_visitors_desc", label: "Visitor Mgmt", desc: "OTP entry, walk-ins, trusted visitors, visitor logs." },
  maintenance: { icon: "💰", labelKey: "upgrade_mod_maintenance_label", descKey: "upgrade_mod_maintenance_desc", label: "Maintenance", desc: "Bills, payments, defaulter tracking." },
  amenities:   { icon: "🏊", labelKey: "upgrade_mod_amenities_label", descKey: "upgrade_mod_amenities_desc", label: "Amenity Booking", desc: "Clubhouse, gym, pool slots. Conflict detection." },
  events:      { icon: "🎉", labelKey: "upgrade_mod_events_label", descKey: "upgrade_mod_events_desc", label: "Events", desc: "RSVP management, attendance, notifications." },
  parking:     { icon: "🅿️", labelKey: "upgrade_mod_parking_label", descKey: "upgrade_mod_parking_desc", label: "Parking", desc: "Slot assignment, visitor parking, vehicle registry." },
  community:   { icon: "🤝", labelKey: "upgrade_mod_community_label", descKey: "upgrade_mod_community_desc", label: "Community Help", desc: "Resident-to-resident help & marketplace." },
  analytics:   { icon: "📊", labelKey: "upgrade_mod_analytics_label", descKey: "upgrade_mod_analytics_desc", label: "Analytics", desc: "Collection rates, issue trends, visitor reports." },
  multilang:   { icon: "🌍", labelKey: "upgrade_mod_multilang_label", descKey: "upgrade_mod_multilang_desc", label: "Multi-Language", desc: "Hindi + Gujarati + English support." },
};

const UpgradeScreen = () => {
  const { plan, trialDaysLeft } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await modulesApi.getStatus();
      setData(res.data || res);
    } catch (err) {
      Alert.alert(t("error_title", "Error"), err.response?.data?.message || t("upgrade_load_status_failed", "Failed to load module status"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRequestUpgrade = (key) => {
    const meta = MODULE_META[key];
    const label = t(meta.labelKey, meta.label);
    Alert.alert(
      t("upgrade_request_title", "Request %s", { label }),
      t("upgrade_request_body", "This will notify our team to enable the %s module for your society. They will contact you to confirm pricing.", { label }),
      [
        { text: t("upgrade_request_cancel", "Cancel") },
        {
          text: t("upgrade_request_send", "Send Request"),
          onPress: async () => {
            setRequesting((prev) => ({ ...prev, [key]: true }));
            try {
              await modulesApi.requestUpgrade(key);
              Alert.alert(t("upgrade_requested_title", "Requested!"), t("upgrade_request_success", "Your upgrade request for %s has been submitted. We'll review it shortly.", { label }));
              fetchStatus();
            } catch (err) {
              Alert.alert(t("error_title", "Error"), err.response?.data?.message || t("upgrade_request_failed", "Request failed. Please try again."));
            } finally {
              setRequesting((prev) => ({ ...prev, [key]: false }));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const modules = data?.modules || {};
  const freeKeys = Object.keys(MODULE_META).filter((k) => MODULE_META[k] && modules[k]?.isFree);
  const enabledPaid = Object.keys(MODULE_META).filter((k) => !modules[k]?.isFree && modules[k]?.enabled);
  const lockedPaid  = Object.keys(MODULE_META).filter((k) => !modules[k]?.isFree && !modules[k]?.enabled);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} />}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.pageTitle}>{t("upgrade_page_title", "Your Modules")}</Text>
        <Text style={styles.pageSub}>
          {t("upgrade_page_subtitle", "Manage features for your society. Locked modules show the option to request an upgrade from our team.")}
        </Text>

        {/* ── Plan Status Card ── */}
        <View style={[styles.planCard, plan === "trial" ? { borderColor: "#F59E0B", backgroundColor: "#FFFBF0" } : { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }]}>
          <View style={{ marginBottom: 12 }}>
            {plan === "trial" ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#D97706", marginBottom: 4 }}>🎉 {t("upgrade_free_trial_badge", "FREE TRIAL")}</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 6 }}>
                  {trialDaysLeft === 1
                    ? t("upgrade_trial_days_left_one", "%d day remaining", { count: trialDaysLeft })
                    : t("upgrade_trial_days_left_other", "%d days remaining", { count: trialDaysLeft })}
                </Text>
                <Text style={{ fontSize: 13, color: "#4B5563", lineHeight: 18 }}>
                  {t("upgrade_trial_desc", "Every feature unlocked. After the trial, core features stay free forever. Upgrade to unlock maintenance billing & more.")}
                </Text>
              </>
            ) : plan === "free" ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#10B981", marginBottom: 4 }}>✓ {t("upgrade_free_plan_badge", "FREE PLAN")}</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 6 }}>
                  {t("upgrade_free_plan_title", "Core features, forever")}
                </Text>
                <Text style={{ fontSize: 13, color: "#4B5563", lineHeight: 18 }}>
                  {t("upgrade_free_plan_desc", "Notices, polls, contacts, and visitors are always free. Upgrade anytime to unlock billing & amenities.")}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#06B6D4", marginBottom: 4 }}>✓ {t("upgrade_premium_plan_badge", "PREMIUM PLAN")}</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 6 }}>
                  {plan === "basic" ? t("upgrade_plan_basic", "Basic Plan") : t("upgrade_plan_premium", "Premium Plan")}
                </Text>
                <Text style={{ fontSize: 13, color: "#4B5563", lineHeight: 18 }}>
                  {t("upgrade_premium_plan_desc", "You have access to all features. Contact support if you need to modify your plan.")}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Active Modules */}
        {enabledPaid.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>✅ {t("upgrade_section_active_paid", "Active Paid Modules")}</Text>
            {enabledPaid.map((key) => {
              const meta = MODULE_META[key];
    const label = t(meta.labelKey, meta.label);
              return (
                <View key={key} style={[styles.card, styles.cardEnabled]}>
                  <Text style={styles.cardIcon}>{meta.icon}</Text>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{t(meta.labelKey, meta.label)}</Text>
                    <Text style={styles.cardDesc}>{t(meta.descKey, meta.desc)}</Text>
                  </View>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{t("upgrade_badge_active", "Active")}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Locked Modules */}
        {lockedPaid.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🔒 {t("upgrade_section_available", "Available Upgrades")}</Text>
            {lockedPaid.map((key) => {
              const meta = MODULE_META[key];
    const label = t(meta.labelKey, meta.label);
              const isPending = modules[key]?.pendingRequest;
              const isRequesting = requesting[key];

              return (
                <View key={key} style={[styles.card, styles.cardLocked]}>
                  <Text style={[styles.cardIcon, styles.cardIconLocked]}>{meta.icon}</Text>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardName, styles.cardNameLocked]}>{t(meta.labelKey, meta.label)}</Text>
                    <Text style={styles.cardDesc}>{t(meta.descKey, meta.desc)}</Text>
                  </View>
                  {isPending ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{t("upgrade_badge_pending", "Pending")}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.requestBtn, isRequesting && styles.requestBtnDisabled]}
                      onPress={() => handleRequestUpgrade(key)}
                      disabled={isRequesting}
                    >
                      {isRequesting
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Text style={styles.requestBtnText}>{t("upgrade_btn_request", "Request")}</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Free Modules */}
        <Text style={styles.sectionTitle}>🆓 {t("upgrade_section_free", "Always Free")}</Text>
        {freeKeys.map((key) => {
          const meta = MODULE_META[key];
    const label = t(meta.labelKey, meta.label);
          return (
            <View key={key} style={[styles.card, styles.cardFree]}>
              <Text style={styles.cardIcon}>{meta.icon}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{t(meta.labelKey, meta.label)}</Text>
                <Text style={styles.cardDesc}>{t(meta.descKey, meta.desc)}</Text>
              </View>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>{t("upgrade_badge_free", "FREE")}</Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F8FAFC" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll:       { padding: 16 },

  pageTitle:    { fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 6 },
  pageSub:      { fontSize: 14, color: "#64748B", lineHeight: 20, marginBottom: 24 },

  planCard:     { borderRadius: 12, borderWidth: 1.5, padding: 14, marginBottom: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },

  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardEnabled:  { borderLeftWidth: 3, borderLeftColor: "#10B981" },
  cardLocked:   { borderLeftWidth: 3, borderLeftColor: "#E2E8F0", opacity: 0.9 },
  cardFree:     { borderLeftWidth: 3, borderLeftColor: "#3B82F6" },

  cardIcon:     { fontSize: 22, marginRight: 12 },
  cardIconLocked: { opacity: 0.5 },
  cardBody:     { flex: 1 },
  cardName:     { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  cardNameLocked: { color: "#94A3B8" },
  cardDesc:     { fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 16 },

  activeBadge:  { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { color: "#065F46", fontSize: 11, fontWeight: "700" },

  freeBadge:    { backgroundColor: "#DBEAFE", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  freeBadgeText: { color: "#1E40AF", fontSize: 11, fontWeight: "700" },

  pendingBadge: { backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { color: "#92400E", fontSize: 11, fontWeight: "700" },

  requestBtn:   { borderWidth: 1.5, borderColor: COLORS.primary || "#0F2040", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  requestBtnDisabled: { opacity: 0.5 },
  requestBtnText: { color: COLORS.primary || "#0F2040", fontSize: 12, fontWeight: "700" },
});

export default UpgradeScreen;