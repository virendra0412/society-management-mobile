import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Modal, TextInput, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { userApi }  from "../../api/resources.api";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, Spinner,
} from "../../components/ui";
import { C } from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULES = ["visitors", "maintenance", "issues", "notices", "parking", "amenities", "residents"];
const MODULE_ICON = {
  visitors:    "🚶", maintenance: "💰", issues: "🔧",
  notices:     "📢", parking:     "🅿️", amenities: "🏊", residents: "👥",
};
const MODULE_LABEL_KEY = {
  visitors:    "admin_module_visitors",    maintenance: "admin_module_maintenance", issues:    "admin_module_issues",
  notices:     "admin_module_notices",     parking:     "admin_module_parking",     amenities: "admin_module_amenities",
  residents:   "admin_module_residents",
};
const PERM_LEVELS = ["none", "read", "write", "full"];
const PERM_COLOR  = { none: C.gray300, read: C.blue, write: C.amber, full: C.green };

// Labels for preset roles — resolved via t() at render time using these keys
const PRESET_ROLE_LABEL_KEY = {
  "Treasurer":        "admin_preset_treasurer",
  "Secretary":        "admin_preset_secretary",
  "Security Head":    "admin_preset_security_head",
  "Parking Head":     "admin_preset_parking_head",
  "Maintenance Head": "admin_preset_maintenance_head",
  "Custom":           "admin_preset_custom",
};

const PRESET_ROLES = [
  {
    label: "Treasurer",       icon: "💰", role: "committee", committeeTitle: "Treasurer",
    permissions: { maintenance: "full", residents: "read" },
  },
  {
    label: "Secretary",       icon: "📋", role: "committee", committeeTitle: "Secretary",
    permissions: { notices: "full", issues: "write", residents: "read" },
  },
  {
    label: "Security Head",   icon: "🛡️", role: "security",  committeeTitle: "Security In-charge",
    permissions: { visitors: "full", residents: "read" },
  },
  {
    label: "Parking Head",    icon: "🅿️", role: "committee", committeeTitle: "Parking In-charge",
    permissions: { parking: "full", residents: "read" },
  },
  {
    label: "Maintenance Head",icon: "🔧", role: "committee", committeeTitle: "Maintenance Head",
    permissions: { issues: "full", notices: "write" },
  },
  {
    label: "Custom",          icon: "⚙️", role: "committee", committeeTitle: "",
    permissions: {},
  },
];

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, count, color }) => (
  <View style={[s.statPill, { backgroundColor: color + "12", borderColor: color + "25" }]}>
    <Text style={[s.statCount, { color }]}>{count}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

// ─── Pending Member Card ──────────────────────────────────────────────────────
const PendingCard = ({ member, onApprove, onReject, busy }) => {
  const { t } = useLanguage();
  const mem = member.memberships?.[0] || {};
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <View style={s.avatarBox}>
          <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          <Text style={s.memberEmail}>{member.email}</Text>
          <Text style={s.memberMeta}>
            {[mem.flat && t("admin_flat_prefix", "Flat ") + mem.flat, mem.wing].filter(Boolean).join(" · ") || t("admin_no_flat_info", "No flat info")}
            {" · "}{timeAgo(member.createdAt)}
          </Text>
        </View>
        <Badge label={t("admin_badge_pending", "Pending")} bg="#FEF3C7" text="#92400E" dot="#F59E0B" />
      </View>
      {!!member.phone && (
        <View style={s.phoneBox}>
          <Text style={s.phoneText}>📞 {member.phone}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn small variant="primary" onPress={() => onApprove(member._id)}
          loading={busy === member._id + "_approve"} style={{ flex: 1 }}>
          {"✓ " + t("admin_btn_approve", "Approve")}
        </Btn>
        <Btn small variant="danger" onPress={() => onReject(member._id)}
          loading={busy === member._id + "_reject"} style={{ flex: 1 }}>
          {"✕ " + t("admin_btn_reject", "Reject")}
        </Btn>
      </View>
    </Card>
  );
};

// ─── Permission Level Picker ──────────────────────────────────────────────────
const PermLevelPicker = ({ module, value, onChange }) => {
  const { t } = useLanguage();
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={s.permModuleIcon}>{MODULE_ICON[module]}</Text>
        <Text style={s.permModuleLabel}>{t(MODULE_LABEL_KEY[module], module)}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {PERM_LEVELS.map((lvl) => {
          const active = value === lvl;
          return (
            <TouchableOpacity
              key={lvl}
              onPress={() => onChange(module, lvl)}
              style={[
                s.permChip,
                active && { backgroundColor: PERM_COLOR[lvl], borderColor: PERM_COLOR[lvl] },
              ]}
            >
              <Text style={[s.permChipText, active && { color: "#fff" }]}>{t("admin_perm_" + lvl, lvl)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── Assign Role Modal ────────────────────────────────────────────────────────
const AssignRoleModal = ({ visible, member, onClose, onSave, saving }) => {
  const { t } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [title,       setTitle]       = useState("");
  const [permissions, setPermissions] = useState({});

  const applyPreset = (preset) => {
    setSelectedPreset(preset.label);
    setTitle(preset.committeeTitle);
    const filled = {};
    MODULES.forEach((m) => { filled[m] = preset.permissions[m] || "none"; });
    setPermissions(filled);
  };

  const handlePermChange = (module, level) => {
    setPermissions((prev) => ({ ...prev, [module]: level }));
    setSelectedPreset("Custom");
  };

  const activePreset = PRESET_ROLES.find((p) => p.label === selectedPreset);
  const roleToSend   = activePreset?.role || "committee";

  const handleSave = () => {
    onSave(member._id, { role: roleToSend, committeeTitle: title, permissions });
  };

  useEffect(() => {
    if (visible) {
      setSelectedPreset(null);
      setTitle("");
      setPermissions({});
    }
  }, [visible]);

  if (!visible || !member) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.backdrop}>
        <View style={modal.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={modal.header}>
              <View style={s.avatarBox}>
                <Text style={s.avatarText}>{(member.name || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={modal.name}>{member.name}</Text>
                <Text style={modal.email}>{member.email}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
                <Text style={modal.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Preset chips */}
            <Text style={s.sectionLabel}>{t("admin_modal_presets_label", "Quick Presets")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 2 }}>
                {PRESET_ROLES.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => applyPreset(p)}
                    style={[
                      modal.preset,
                      selectedPreset === p.label && { backgroundColor: C.navy, borderColor: C.navy },
                    ]}
                  >
                    <Text style={modal.presetIcon}>{p.icon}</Text>
                    <Text style={[modal.presetLabel, selectedPreset === p.label && { color: "#fff" }]}>
                      {t(PRESET_ROLE_LABEL_KEY[p.label], p.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Title */}
            <Text style={s.sectionLabel}>{t("admin_modal_title_label", "Committee Title")}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("admin_modal_title_placeholder", 'e.g. "Treasurer" or "Joint Secretary"')}
              placeholderTextColor={C.gray300}
              style={modal.input}
            />

            {/* Permission matrix */}
            <Text style={s.sectionLabel}>{t("admin_modal_permissions_label", "Module Permissions")}</Text>
            <Card style={{ marginBottom: 12 }}>
              {MODULES.map((m) => (
                <PermLevelPicker
                  key={m}
                  module={m}
                  value={permissions[m] || "none"}
                  onChange={handlePermChange}
                />
              ))}
            </Card>

            {/* Save */}
            <Btn
              variant="primary"
              onPress={handleSave}
              loading={saving}
              disabled={!selectedPreset}
            >
              {t("admin_modal_assign_btn", "Assign Role")}
            </Btn>
            {!selectedPreset && (
              <Text style={s.helperHint}>
                {t("admin_modal_assign_hint", "Pick a preset above or adjust a module's permission to enable saving.")}
              </Text>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Committee Member Card ────────────────────────────────────────────────────
const CommitteeCard = ({ member, societyId, onRemove, onEdit, removing }) => {
  const { t } = useLanguage();
  const mem = member.memberships?.find(
    (m) => m.society?._id?.toString() === societyId || m.society?.toString() === societyId
  ) || {};
  const perms = mem.permissions || {};
  const grantedModules = MODULES.filter((m) => perms[m] && perms[m] !== "none");

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <View style={[s.avatarBox, { backgroundColor: C.purple + "20" }]}>
          <Text style={[s.avatarText, { color: C.purple }]}>{(member.name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          {mem.committeeTitle && (
            <Text style={[s.memberMeta, { color: C.navy, fontWeight: "700", marginTop: 2 }]}>
              {mem.committeeTitle}
            </Text>
          )}
          <Text style={s.memberEmail}>{member.email}</Text>
        </View>
        <Badge
          label={mem.role || t("admin_role_committee", "committee")}
          bg={mem.role === "security" ? C.green + "20" : C.purple + "20"}
          text={mem.role === "security" ? C.green : C.purple}
        />
      </View>

      {grantedModules.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {grantedModules.map((m) => (
            <View
              key={m}
              style={[s.permBadge, { backgroundColor: PERM_COLOR[perms[m]] + "18", borderColor: PERM_COLOR[perms[m]] + "40" }]}
            >
              <Text style={s.permBadgeIcon}>{MODULE_ICON[m]}</Text>
              <Text style={[s.permBadgeText, { color: PERM_COLOR[perms[m]] }]}>
                {t(MODULE_LABEL_KEY[m], m)}: {t("admin_perm_" + perms[m], perms[m])}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn small variant="outline" onPress={() => onEdit(member)} style={{ flex: 1 }}>
          {"✏️ " + t("admin_btn_edit", "Edit")}
        </Btn>
        <Btn
          small variant="danger"
          onPress={() => onRemove(member._id)}
          loading={removing === member._id}
          style={{ flex: 1 }}
        >
          {t("admin_btn_remove", "Remove")}
        </Btn>
      </View>
    </Card>
  );
};

// ─── Tab 1: Approvals ─────────────────────────────────────────────────────────
const ApprovalsTab = () => {
  const toast = useToast();
  const { t } = useLanguage();
  const [pending,       setPending]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [busy,          setBusy]          = useState(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.getPendingMembers();
      setPending(res.data.members || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_load_pending", "Failed to load pending members"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPending(); }, []);

  const handleApprove = async (userId) => {
    setBusy(userId + "_approve");
    try {
      await userApi.approveMember(userId);
      setPending((p) => p.filter((m) => m._id !== userId));
      setApprovedCount((c) => c + 1);
      toast.success(t("admin_success_approved", "Member approved!"));
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_approve", "Approval failed"));
    } finally { setBusy(null); }
  };

  const handleReject = async (userId) => {
    setBusy(userId + "_reject");
    try {
      await userApi.rejectMember(userId);
      setPending((p) => p.filter((m) => m._id !== userId));
      setRejectedCount((c) => c + 1);
      toast.success(t("admin_success_rejected", "Member rejected."));
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_reject", "Rejection failed"));
    } finally { setBusy(null); }
  };

  return (
    <FlatList
      data={pending}
      keyExtractor={(m) => m._id}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <View>
          {(approvedCount > 0 || rejectedCount > 0) && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={s.sectionLabel}>{t("admin_session_label", "This Session")}</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatPill label={t("admin_stat_approved", "Approved")} count={approvedCount} color={C.green} />
                <StatPill label={t("admin_stat_rejected", "Rejected")} count={rejectedCount} color={C.red} />
              </View>
            </Card>
          )}
          <View style={s.pendingHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.pendingHeaderText}>{t("admin_pending_title", "Pending Requests")}</Text>
              {pending.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{pending.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={loadPending} disabled={loading} style={s.refreshBtn}>
              {loading ? <Spinner size={12} /> : <Text style={s.refreshBtnText}>{t("admin_btn_refresh", "↻ Refresh")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={() =>
        loading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3].map((k) => <View key={k} style={s.skeleton} />)}
          </View>
        ) : (
          <Card><EmptyState icon="✅" message={t("admin_empty_pending", "No pending approvals. All caught up!")} /></Card>
        )
      }
      ListFooterComponent={() => (
        <View style={s.infoBanner}>
          <Text style={s.infoBannerText}>
            {t("admin_info_rejected", "ℹ️ Rejected members will have their accounts deactivated.")}
          </Text>
        </View>
      )}
      renderItem={({ item: member }) => (
        <PendingCard member={member} onApprove={handleApprove} onReject={handleReject} busy={busy} />
      )}
    />
  );
};

// ─── Tab 2: Committee ─────────────────────────────────────────────────────────
const CommitteeTab = ({ activeSocietyId }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [members,       setMembers]       = useState([]);
  const [allApproved,   setAllApproved]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [removing,      setRemoving]      = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [selectedMember,setSelectedMember]= useState(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [committeeRes, approvedRes] = await Promise.allSettled([
        userApi.getCommitteeMembers(),
        userApi.getApprovedMembers(),
      ]);
      if (committeeRes.status === "fulfilled") setMembers(committeeRes.value.data.members || []);
      if (approvedRes.status  === "fulfilled") setAllApproved(approvedRes.value.data.members || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_load_committee", "Failed to load committee"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, []);

  const handleEdit = (member) => {
    setSelectedMember(member);
    setModalVisible(true);
  };

  const handleSave = async (userId, payload) => {
    setSaving(true);
    try {
      await userApi.assignCommitteeRole(userId, payload);
      toast.success(t("admin_success_role_assigned", "Committee role assigned!"));
      setModalVisible(false);
      loadMembers();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_assign_role", "Failed to assign role"));
    } finally { setSaving(false); }
  };

  const handleRemove = async (userId) => {
    setRemoving(userId);
    try {
      await userApi.removeCommitteeRole(userId);
      toast.success(t("admin_success_role_removed", "Member demoted to resident."));
      setMembers((prev) => prev.filter((m) => m._id !== userId));
      loadMembers();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("admin_err_remove_role", "Failed to remove role"));
    } finally { setRemoving(null); }
  };

  const committeeIds   = new Set(members.map((m) => m._id));
  const pendingAssign  = allApproved.filter((m) => !committeeIds.has(m._id));

  if (loading) {
    return (
      <View style={[s.list, { gap: 10 }]}>
        {[1, 2, 3].map((k) => <View key={k} style={s.skeleton} />)}
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={members}
        keyExtractor={(m) => m._id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View>
            <Card style={{ marginBottom: 12, backgroundColor: C.navy }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 4 }}>
                {t("admin_rbac_title", "\ud83d\udee1\ufe0f Committee RBAC")}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 18 }}>
                {t("admin_rbac_desc", "Assign granular module permissions to committee members. Each role gets access only to what they need.")}
              </Text>
            </Card>

            {pendingAssign.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={s.pendingHeader}>
                  <Text style={s.pendingHeaderText}>
                    {t("admin_no_role_yet", "Approved \u2014 No Role Yet")} ({pendingAssign.length})
                  </Text>
                </View>
                {pendingAssign.map((member) => {
                  const mem = member.memberships?.[0] || {};
                  return (
                    <Card key={member._id} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[s.avatarBox, { backgroundColor: C.gray100 }]}>
                          <Text style={[s.avatarText, { color: C.gray500 }]}>{(member.name || "?")[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.memberName}>{member.name}</Text>
                          <Text style={s.memberEmail}>{member.email}</Text>
                          {mem.flat ? <Text style={s.memberMeta}>{t("admin_flat_prefix", "Flat ")}{mem.flat}{mem.wing ? ` \u00b7 ${mem.wing}` : ""}</Text> : null}
                        </View>
                        <Btn small variant="primary" onPress={() => handleEdit(member)} style={{ backgroundColor: C.teal }}>
                          {t("admin_btn_assign_role", "Assign Role")}
                        </Btn>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}

            <View style={s.pendingHeader}>
              <Text style={s.pendingHeaderText}>
                {t("admin_committee_members_title", "Committee Members")} ({members.length})
              </Text>
              <TouchableOpacity onPress={loadMembers} style={s.refreshBtn}>
                <Text style={s.refreshBtnText}>{t("admin_btn_refresh", "\u21bb Refresh")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <Card>
            <EmptyState
              icon="\ud83d\udc65"
              message={t("admin_empty_committee", "No committee members yet. Approve a member first, then assign them a committee role.")}
            />
          </Card>
        )}
        renderItem={({ item: member }) => (
          <CommitteeCard
            member={member}
            societyId={activeSocietyId}
            onEdit={handleEdit}
            onRemove={handleRemove}
            removing={removing}
          />
        )}
      />
      <AssignRoleModal
        visible={modalVisible}
        member={selectedMember}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
};

// ─── Invite Tab ───────────────────────────────────────────────────────────────
const InviteTab = ({ activeSocietyId }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [invite,  setInvite]  = useState(null);

  const generate = async () => {
    if (!activeSocietyId) { toast.error(t("admin_err_society_not_loaded", "Society not loaded yet.")); return; }
    setLoading(true);
    try {
      const res = await userApi.generateInviteLink(activeSocietyId);
      setInvite(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t("admin_err_invite_failed", "Failed to generate invite link."));
    } finally {
      setLoading(false);
    }
  };

  const expiryLabel = invite
    ? t("admin_invite_expires", "Expires") + " " + new Date(invite.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 13, color: C.gray500, marginBottom: 16, lineHeight: 20 }}>
        {t("admin_invite_desc", "Generate a QR code or shareable link. Anyone who scans it will land on the registration screen with your society pre-filled. Valid for 7 days.")}
      </Text>

      <Btn onPress={generate} loading={loading} variant="primary">
        {invite ? t("admin_invite_btn_regenerate", "🔄 Regenerate Invite Link") : t("admin_invite_btn_generate", "🔗 Generate Invite Link")}
      </Btn>

      {invite && (
        <Card style={{ marginTop: 20, alignItems: "center" }}>
          <View style={invStyles.qrPlaceholder}>
            <Text style={invStyles.qrIcon}>📷</Text>
            <Text style={invStyles.qrHint}>{t("admin_invite_qr_hint1", "Install react-native-qrcode-svg")}</Text>
            <Text style={invStyles.qrHint}>{t("admin_invite_qr_hint2", "to render QR code here")}</Text>
          </View>

          <Text style={invStyles.expiry}>{expiryLabel}</Text>

          <View style={invStyles.linkBox}>
            <Text style={invStyles.linkText} numberOfLines={2} selectable>
              {invite.inviteUrl}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: C.gray500, marginTop: 8, textAlign: "center" }}>
            {t("admin_invite_copy_hint", "Tap and hold the link above to copy it")}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
};

const invStyles = StyleSheet.create({
  qrPlaceholder: { width: 200, height: 200, borderWidth: 1.5, borderColor: C.gray300, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12, backgroundColor: C.gray50 },
  qrIcon:        { fontSize: 40, marginBottom: 8 },
  qrHint:        { fontSize: 11, color: C.gray500, textAlign: "center" },
  expiry:        { fontSize: 12, color: C.gray500, marginBottom: 12 },
  linkBox:       { backgroundColor: C.gray50, borderRadius: 10, borderWidth: 1, borderColor: C.gray100, padding: 12, width: "100%" },
  linkText:      { fontSize: 12, color: C.teal, fontFamily: "monospace" },
});


export const AdminScreen = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab]   = useState("approvals");
  // We need activeSocietyId for the committee tab — read from context via prop drilling
  const [activeSocietyId, setActiveSocietyId] = useState(null);

  // Get societyId from storage on mount (simpler than prop-drilling auth context here)
  useEffect(() => {
    const getSocietyId = async () => {
      try {
        const { tokenStorage } = await import("../../utils/storage");
        const user = await tokenStorage.getUser();
        const sid = user?.activeSocietyId?._id?.toString() || user?.activeSocietyId?.toString() || null;
        setActiveSocietyId(sid);
      } catch {}
    };
    getSocietyId();
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerSub}>{t("admin_panel_title", "Admin Panel")}</Text>
        <Text style={s.headerTitle}>👑 {t("admin_panel_subtitle", "Society Management")}</Text>
        <Text style={s.headerDesc}>{t("admin_panel_body", "Manage members and committee roles")}</Text>

        {/* Tab switcher */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === "approvals" && s.tabBtnActive]}
            onPress={() => setActiveTab("approvals")}
          >
            <Text style={[s.tabBtnText, activeTab === "approvals" && s.tabBtnTextActive]}>
              👤 {t("admin_tab_approvals", "Approvals")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === "committee" && s.tabBtnActive]}
            onPress={() => setActiveTab("committee")}
          >
            <Text style={[s.tabBtnText, activeTab === "committee" && s.tabBtnTextActive]}>
              🛡️ {t("admin_tab_committee", "Committee")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === "invite" && s.tabBtnActive]}
            onPress={() => setActiveTab("invite")}
          >
            <Text style={[s.tabBtnText, activeTab === "invite" && s.tabBtnTextActive]}>
              🔗 {t("admin_tab_invite", "Invite")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === "approvals"
        ? <ApprovalsTab />
        : activeTab === "invite"
          ? <InviteTab activeSocietyId={activeSocietyId} />
          : <CommitteeTab activeSocietyId={activeSocietyId} />
      }
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  header:            { backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  headerSub:         { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:       { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerDesc:        { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4, marginBottom: 14 },
  tabRow:            { flexDirection: "row", gap: 8 },
  tabBtn:            { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  tabBtnActive:      { backgroundColor: "#fff" },
  tabBtnText:        { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  tabBtnTextActive:  { color: C.navy },
  list:              { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  sectionLabel:      { fontSize: 11, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  helperHint:        { fontSize: 12, color: C.gray500, textAlign: "center", marginTop: 8 },
  statPill:          { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1 },
  statCount:         { fontSize: 22, fontWeight: "800" },
  statLabel:         { fontSize: 11, color: C.gray500, marginTop: 2 },
  pendingHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pendingHeaderText: { fontSize: 13, fontWeight: "700", color: C.gray700 },
  countBadge:        { backgroundColor: C.amber + "25", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:    { fontSize: 11, fontWeight: "700", color: C.amber },
  refreshBtn:        { borderWidth: 1, borderColor: C.gray100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refreshBtnText:    { fontSize: 11, color: C.gray700 },
  avatarBox:         { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal + "20", alignItems: "center", justifyContent: "center" },
  avatarText:        { fontSize: 18, fontWeight: "700", color: C.teal },
  memberName:        { fontSize: 14, fontWeight: "700", color: C.text },
  memberEmail:       { fontSize: 12, color: C.gray500 },
  memberMeta:        { fontSize: 11, color: C.gray500, marginTop: 2 },
  phoneBox:          { backgroundColor: C.gray50, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  phoneText:         { fontSize: 12, color: C.gray700 },
  skeleton:          { height: 130, borderRadius: 14, backgroundColor: C.gray100 },
  infoBanner:        { marginTop: 16, padding: 14, backgroundColor: C.blue + "10", borderRadius: 12, borderWidth: 1, borderColor: C.blue + "25" },
  infoBannerText:    { fontSize: 12, color: C.blue, lineHeight: 18 },
  // Permission chips
  permModuleIcon:    { fontSize: 14, marginRight: 6 },
  permModuleLabel:   { fontSize: 13, fontWeight: "600", color: C.gray700 },
  permChip:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray300 },
  permChipText:      { fontSize: 11, fontWeight: "700", color: C.gray500 },
  permBadge:         { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  permBadgeIcon:     { fontSize: 11, marginRight: 3 },
  permBadgeText:     { fontSize: 11, fontWeight: "600" },
});

const modal = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  header:       { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  name:         { fontSize: 16, fontWeight: "800", color: C.navy },
  email:        { fontSize: 12, color: C.gray500, marginTop: 2 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.gray100, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 14, color: C.gray700 },
  preset:       { borderWidth: 1.5, borderColor: C.gray300, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", minWidth: 80 },
  presetIcon:   { fontSize: 22, marginBottom: 4 },
  presetLabel:  { fontSize: 11, fontWeight: "700", color: C.gray700 },
  input:        { borderWidth: 1.5, borderColor: C.gray300, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, backgroundColor: "#fff", marginBottom: 16 },
});