/**
 * src/screens/sa/SAModules.jsx
 * Super Admin — Module Management Screen
 *
 * Shows all modules for a given society with toggles, custom pricing,
 * bundle shortcuts, and pending upgrade requests.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saModulesApi } from "../../api/sa.api";
import { COLORS, SPACING, FONT } from "../../constants/theme";

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULE_META = {
  notices:     { icon: "📢", label: "Notices",          free: true  },
  polls:       { icon: "🗳️", label: "Polls",            free: true  },
  contacts:    { icon: "📞", label: "Contacts",         free: true  },
  issues:      { icon: "🔧", label: "Issues",           free: false },
  visitors:    { icon: "👁️", label: "Visitor Mgmt",     free: false },
  maintenance: { icon: "💰", label: "Maintenance",      free: false },
  amenities:   { icon: "🏊", label: "Amenity Booking",  free: false },
  events:      { icon: "🎉", label: "Events",           free: false },
  parking:     { icon: "🅿️", label: "Parking",         free: false },
  community:   { icon: "🤝", label: "Community Help",   free: false },
  analytics:   { icon: "📊", label: "Analytics",        free: false },
  multilang:   { icon: "🌍", label: "Multi-Language",   free: false },
};

const BUNDLE_COLORS = {
  starter:    "#3B82F6",
  operations: "#8B5CF6",
  fullstack:  "#10B981",
};

// ── Main Component ─────────────────────────────────────────────────────────────
const SAModules = ({ route }) => {
  const { societyId, societyName } = route?.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Pending edits (not yet saved)
  const [pendingToggles, setPendingToggles] = useState({});
  const [pendingCharges, setPendingCharges] = useState({});
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [chargeInput, setChargeInput] = useState("");

  const hasUnsavedChanges =
    Object.keys(pendingToggles).length > 0 || Object.keys(pendingCharges).length > 0;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchModules = useCallback(async () => {
    try {
      const res = await saModulesApi.getModules(societyId);
      setData(res.data);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to load modules");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [societyId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const getEffectiveEnabled = (key) => {
    if (pendingToggles.hasOwnProperty(key)) return pendingToggles[key];
    return data?.modules?.[key]?.enabled ?? false;
  };

  const getEffectiveCharge = (key) => {
    if (pendingCharges.hasOwnProperty(key)) return pendingCharges[key];
    return data?.modules?.[key]?.charge ?? 0;
  };

  const calculatedTotal = data
    ? Object.keys(MODULE_META)
        .filter((k) => !MODULE_META[k].free)
        .reduce((sum, k) => sum + (getEffectiveEnabled(k) ? getEffectiveCharge(k) : 0), 0)
    : 0;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleToggle = (key, value) => {
    // If toggling to same as server value, remove from pending
    const serverVal = data?.modules?.[key]?.enabled ?? false;
    setPendingToggles((prev) => {
      const next = { ...prev };
      if (value === serverVal) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const openChargeEditor = (key) => {
    setEditingModule(key);
    setChargeInput(String(getEffectiveCharge(key)));
    setShowChargeModal(true);
  };

  const confirmChargeEdit = () => {
    const val = parseInt(chargeInput, 10);
    if (isNaN(val) || val < 0 || val > 9999) {
      Alert.alert("Invalid", "Enter a charge between 0 and 9999");
      return;
    }
    const serverCharge = data?.modules?.[editingModule]?.charge ?? 0;
    setPendingCharges((prev) => {
      const next = { ...prev };
      if (val === serverCharge) delete next[editingModule];
      else next[editingModule] = val;
      return next;
    });
    setShowChargeModal(false);
    setEditingModule(null);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    try {
      const payload = {};
      if (Object.keys(pendingToggles).length) payload.modules = pendingToggles;
      if (Object.keys(pendingCharges).length) payload.charges = pendingCharges;
      await saModulesApi.updateModules(societyId, payload);
      setPendingToggles({});
      setPendingCharges({});
      Alert.alert("Saved", "Module configuration updated.");
      fetchModules();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyBundle = (bundle) => {
    const bundleDef = data?.bundles?.[bundle];
    if (!bundleDef) return;
    Alert.alert(
      `Apply ${bundleDef.label}`,
      `This will enable: ${bundleDef.modules.join(", ")}.\n\nOther modules will NOT be changed.\n\nContinue?`,
      [
        { text: "Cancel" },
        {
          text: "Apply",
          onPress: async () => {
            setSaving(true);
            try {
              await saModulesApi.applyBundle(societyId, { bundle, replaceAll: false });
              Alert.alert("Done", `${bundleDef.label} applied.`);
              fetchModules();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.message || "Failed to apply bundle");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const freeKeys  = Object.keys(MODULE_META).filter((k) => MODULE_META[k].free);
  const paidKeys  = Object.keys(MODULE_META).filter((k) => !MODULE_META[k].free);
  const pendingUpgradeCount = (data?.pendingRequests || []).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Module Manager</Text>
        <Text style={styles.headerSub}>{societyName || "Society"}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchModules(); }} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Monthly Total Banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Monthly Module Revenue</Text>
          <Text style={styles.totalAmount}>₹{calculatedTotal.toLocaleString("en-IN")}/mo</Text>
          {hasUnsavedChanges && <Text style={styles.unsavedHint}>● Unsaved changes</Text>}
        </View>

        {/* Upgrade Requests Badge */}
        {pendingUpgradeCount > 0 && (
          <View style={styles.requestBadge}>
            <Text style={styles.requestBadgeText}>
              🔔 {pendingUpgradeCount} pending upgrade request{pendingUpgradeCount > 1 ? "s" : ""} from this society
            </Text>
          </View>
        )}

        {/* Bundle Shortcuts */}
        <Text style={styles.sectionTitle}>Quick Bundles</Text>
        <View style={styles.bundleRow}>
          {Object.entries(data?.bundles || {}).map(([key, def]) => (
            <TouchableOpacity
              key={key}
              style={[styles.bundleBtn, { borderColor: BUNDLE_COLORS[key] }]}
              onPress={() => handleApplyBundle(key)}
              disabled={saving}
            >
              <Text style={[styles.bundleBtnLabel, { color: BUNDLE_COLORS[key] }]}>{def.label}</Text>
              <Text style={styles.bundleBtnPrice}>₹{def.price}/mo</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Free Modules */}
        <Text style={styles.sectionTitle}>Free Modules (Always On)</Text>
        {freeKeys.map((key) => {
          const meta = MODULE_META[key];
          return (
            <View key={key} style={[styles.moduleRow, styles.moduleRowFree]}>
              <Text style={styles.moduleIcon}>{meta.icon}</Text>
              <Text style={styles.moduleName}>{meta.label}</Text>
              <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>FREE</Text></View>
            </View>
          );
        })}

        {/* Paid Modules */}
        <Text style={styles.sectionTitle}>Paid Modules</Text>
        {paidKeys.map((key) => {
          const meta    = MODULE_META[key];
          const enabled = getEffectiveEnabled(key);
          const charge  = getEffectiveCharge(key);
          const changed = pendingToggles.hasOwnProperty(key) || pendingCharges.hasOwnProperty(key);
          const isPendingUpgrade = (data?.pendingRequests || []).some((r) => r.module === key);

          return (
            <View key={key} style={[styles.moduleRow, changed && styles.moduleRowChanged]}>
              <Text style={styles.moduleIcon}>{meta.icon}</Text>
              <View style={styles.moduleInfo}>
                <View style={styles.moduleNameRow}>
                  <Text style={styles.moduleName}>{meta.label}</Text>
                  {isPendingUpgrade && (
                    <View style={styles.reqPill}><Text style={styles.reqPillText}>Upgrade Requested</Text></View>
                  )}
                </View>
                <TouchableOpacity onPress={() => enabled && openChargeEditor(key)}>
                  <Text style={[styles.moduleCharge, !enabled && styles.moduleChargeDisabled]}>
                    ₹{charge}/mo {enabled && <Text style={styles.editHint}>(tap to edit)</Text>}
                  </Text>
                </TouchableOpacity>
              </View>
              <Switch
                value={enabled}
                onValueChange={(val) => handleToggle(key, val)}
                trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
                thumbColor={enabled ? COLORS.primary : "#ccc"}
              />
            </View>
          );
        })}

        {/* Save Button */}
        {hasUnsavedChanges && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Charge Edit Modal */}
      <Modal visible={showChargeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Set Charge — {editingModule ? MODULE_META[editingModule]?.label : ""}
            </Text>
            <View style={styles.chargeInputRow}>
              <Text style={styles.rupeeSym}>₹</Text>
              <TextInput
                style={styles.chargeInput}
                keyboardType="numeric"
                value={chargeInput}
                onChangeText={setChargeInput}
                autoFocus
                maxLength={4}
              />
              <Text style={styles.perMo}>/mo</Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowChargeModal(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmChargeEdit}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background || "#F8FAFC" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  header:       { backgroundColor: COLORS.primary || "#0F2040", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:  { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:    { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  scroll:       { padding: 16 },

  totalBanner:  { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  totalLabel:   { color: "#64748B", fontSize: 12, fontWeight: "500", letterSpacing: 0.5, textTransform: "uppercase" },
  totalAmount:  { color: COLORS.primary || "#0F2040", fontSize: 28, fontWeight: "800", marginTop: 4 },
  unsavedHint:  { color: "#F59E0B", fontSize: 12, marginTop: 4 },

  requestBadge: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 12, marginBottom: 12 },
  requestBadgeText: { color: "#92400E", fontSize: 13, fontWeight: "500" },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },

  bundleRow:    { flexDirection: "row", gap: 8, marginBottom: 4 },
  bundleBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: "center" },
  bundleBtnLabel: { fontSize: 11, fontWeight: "700" },
  bundleBtnPrice: { fontSize: 12, color: "#475569", marginTop: 2 },

  moduleRow:     { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  moduleRowFree: { opacity: 0.85 },
  moduleRowChanged: { borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
  moduleIcon:   { fontSize: 20, marginRight: 12 },
  moduleInfo:   { flex: 1 },
  moduleNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  moduleName:   { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  moduleCharge: { fontSize: 13, color: "#64748B", marginTop: 2 },
  moduleChargeDisabled: { opacity: 0.4 },
  editHint:     { color: COLORS.primary || "#0F2040", fontSize: 11 },

  freeBadge:    { backgroundColor: "#D1FAE5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: "auto" },
  freeBadgeText: { color: "#065F46", fontSize: 11, fontWeight: "700" },

  reqPill:      { backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  reqPillText:  { color: "#92400E", fontSize: 10, fontWeight: "600" },

  saveBtn:       { backgroundColor: COLORS.primary || "#0F2040", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:   { color: "#fff", fontSize: 16, fontWeight: "700" },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:    { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 20 },
  chargeInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  rupeeSym:      { fontSize: 24, fontWeight: "600", color: "#1E293B" },
  chargeInput:   { flex: 1, fontSize: 36, fontWeight: "700", color: "#1E293B", borderBottomWidth: 2, borderBottomColor: COLORS.primary || "#0F2040", paddingBottom: 4 },
  perMo:         { fontSize: 16, color: "#64748B" },
  modalBtns:     { flexDirection: "row", gap: 12 },
  modalCancel:   { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  modalConfirm:  { flex: 1, padding: 14, borderRadius: 10, backgroundColor: COLORS.primary || "#0F2040", alignItems: "center" },
});

export default SAModules;