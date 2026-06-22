/**
 * screens/more/ProfileScreen.jsx
 *
 * Added vs previous version:
 *   • "My Societies" section — lists all societies the user belongs to
 *   • Switch button on every non-active membership (calls POST /auth/switch-society)
 *   • Pending badge on unapproved memberships
 *   • "Join Another Society" opens JoinSocietyModal
 *   • JoinSocietyModal — enter join code, flat, wing → POST /auth/join-society
 */
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { useAuth }       from "../../context/AuthContext";
import { useToast }      from "../../context/ToastContext";
import { useLanguage }   from "../../context/LanguageContext";
import { userApi }       from "../../api/resources.api";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import {
  Card, Btn, Input, Modal, Badge, Spinner, EmptyState,
} from "../../components/ui";
import { C } from "../../constants/theme";

// ─── Constants ────────────────────────────────────────────────────────────────
const RELATION_OPTIONS = ["Spouse", "Parent", "Child", "Sibling", "Other"];
const RELATION_LABEL_KEYS = {
  Spouse:  "profile_relation_spouse",
  Parent:  "profile_relation_parent",
  Child:   "profile_relation_child",
  Sibling: "profile_relation_sibling",
  Other:   "profile_relation_other",
};

// Role display map
const ROLE_LABEL_KEYS = {
  admin:     "profile_role_admin_full",
  committee: "profile_role_committee",
  security:  "profile_role_security",
  resident:  "profile_role_resident_full",
  vendor:    "profile_role_vendor",
};
const ROLE_FALLBACK = {
  admin:     "👑 Admin",
  committee: "🏛️ Committee",
  security:  "🛡️ Security",
  resident:  "🏠 Resident",
  vendor:    "🔧 Vendor",
};
const roleLabel = (t, role) => t(ROLE_LABEL_KEYS[role] || role, ROLE_FALLBACK[role] || role || "Resident");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const InitialsAvatar = ({ name = "?", size = 64, color = C.teal }) => {
  const initials = name
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <View style={[
      styles.initialsWrap,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "25" },
    ]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.34, color }]}>{initials}</Text>
    </View>
  );
};

const FieldRow = ({ label, value, last }) => (
  <View style={[styles.fieldRow, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {typeof value === "string" || value == null ? (
      <Text style={[styles.fieldValue, !value && { color: C.gray300 }]}>
        {value || "—"}
      </Text>
    ) : (
      value
    )}
  </View>
);

// ─── Avatar Section ───────────────────────────────────────────────────────────
const AvatarSection = ({ profile, onAvatarUpdate }) => {
  const toast       = useToast();
  const { t }       = useLanguage();
  const [busy, setBusy] = useState(false);

  const handlePickAndUpload = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("profile_permission_needed_title", "Permission needed"),
          t("profile_permission_needed_body", "Please allow photo access in settings.")
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const ext   = asset.uri.split(".").pop() || "jpg";
    const type  = `image/${ext === "jpg" ? "jpeg" : ext}`;
    const formData = new FormData();
    formData.append("avatar", { uri: asset.uri, name: `avatar.${ext}`, type });
    setBusy(true);
    try {
      const res = await userApi.uploadAvatar(formData);
      onAvatarUpdate(res.data);
      toast.success(t("profile_avatar_ok"));
    } catch (e) {
      toast.error(e?.response?.data?.message || t("error_generic"));
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.avatarSection}>
      <TouchableOpacity onPress={handlePickAndUpload} disabled={busy} activeOpacity={0.85} style={styles.avatarWrap}>
        {profile?.avatar
          ? <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
          : <InitialsAvatar name={profile?.name} size={80} />
        }
        <View style={styles.cameraBadge}>
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontSize: 11 }}>✏️</Text>
          }
        </View>
      </TouchableOpacity>
      <Text style={styles.avatarName}>{profile?.name}</Text>
      <Text style={styles.avatarRole}>
        {profile?.role === "admin" ? `👑 ${t("profile_role_admin", "Admin")}` : t("profile_role_resident", "Resident")}
        {profile?.society?.name ? `  ·  ${profile.society.name}` : ""}
      </Text>
    </View>
  );
};

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
const EditProfileModal = ({ open, onClose, profile, onSaved }) => {
  const toast   = useToast();
  const { t }   = useLanguage();
  const [form,   setForm]   = useState({ name: "", phone: "", flat: "", wing: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setForm({
        name:  profile.name  || "",
        phone: profile.phone || "",
        flat:  profile.flat  || "",
        wing:  profile.wing  || profile.block || "",
      });
    }
  }, [open, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await userApi.updateProfile(form);
      onSaved(res.data.user);
      toast.success(t("profile_saved"));
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("profile_save_failed"));
    } finally { setSaving(false); }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={t("profile_edit")}>
      <Input label={t("profile_full_name")} value={form.name}  onChangeText={set("name")}  placeholder="Rajesh Mehta" />
      <Input label={t("profile_phone")}     value={form.phone} onChangeText={set("phone")} placeholder="9876543210" keyboardType="phone-pad" />
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input label={t("profile_flat")} value={form.flat} onChangeText={set("flat")} placeholder="e.g. 204" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t("profile_wing")} value={form.wing} onChangeText={set("wing")} placeholder="e.g. A" />
        </View>
      </View>
      <Btn onPress={handleSave} loading={saving} style={{ marginTop: 4 }}>{t("profile_save")}</Btn>
    </Modal>
  );
};

// ─── Family Member Modal ──────────────────────────────────────────────────────
const FamilyModal = ({ open, onClose, member, onDone }) => {
  const toast  = useToast();
  const { t }  = useLanguage();
  const isEdit = !!member;
  const [form,   setForm]   = useState({ name: "", relation: "Spouse", age: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(member
        ? { name: member.name, relation: member.relation, age: String(member.age || "") }
        : { name: "", relation: "Spouse", age: "" }
      );
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error(t("profile_name_req"));
    setSaving(true);
    try {
      const payload = { ...form, age: form.age ? Number(form.age) : undefined };
      const res = isEdit
        ? await userApi.updateFamilyMember(member._id, payload)
        : await userApi.addFamilyMember(payload);
      onDone(res.data.familyMembers);
      toast.success(isEdit ? t("profile_member_ok") : t("profile_member_add"));
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("profile_member_err"));
    } finally { setSaving(false); }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("profile_edit_member") : t("profile_add_member")}>
      <Input label={t("profile_name")} value={form.name} onChangeText={set("name")} placeholder="Full name" />
      <Text style={styles.pillLabel}>{t("profile_relation")}</Text>
      <View style={styles.pillRow}>
        {RELATION_OPTIONS.map((r) => {
          const active = form.relation === r;
          return (
            <TouchableOpacity key={r} onPress={() => setForm((p) => ({ ...p, relation: r }))} activeOpacity={0.75}
              style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t(RELATION_LABEL_KEYS[r] || r, r)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Input label={`${t("profile_age")}`} value={form.age} onChangeText={set("age")}
        placeholder={t("profile_age_ph")} keyboardType="number-pad" />
      <Btn onPress={handleSave} loading={saving} style={{ marginTop: 4 }}>
        {isEdit ? t("profile_update_btn") : t("profile_add_btn")}
      </Btn>
    </Modal>
  );
};

// ─── Family Member Row ────────────────────────────────────────────────────────
const FamilyMemberRow = ({ member, onEdit, onRemove }) => {
  const { t }    = useLanguage();
  const initials = (member.name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <View style={styles.familyRow}>
      <View style={styles.familyAvatar}>
        <Text style={styles.familyInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.familyName}>{member.name}</Text>
        <Text style={styles.familyMeta}>
          {t(RELATION_LABEL_KEYS[member.relation] || member.relation, member.relation)}
          {member.age ? `  ·  ${t("profile_age_label", "Age")} ${member.age}` : ""}
        </Text>
      </View>
      <View style={styles.familyActions}>
        <TouchableOpacity onPress={() => onEdit(member)} style={styles.familyBtn} activeOpacity={0.75}>
          <Text style={styles.familyBtnText}>{t("btn_edit")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert(
            t("profile_remove_member_title", "Remove member"),
            t("profile_remove_member_body", "Remove %s?", { name: member.name }),
            [
              { text: t("btn_cancel", "Cancel"), style: "cancel" },
              { text: t("btn_delete", "Remove"), style: "destructive", onPress: () => onRemove(member._id) },
            ]
          )}
          style={[styles.familyBtn, styles.familyBtnDanger]} activeOpacity={0.75}>
          <Text style={[styles.familyBtnText, { color: C.red }]}>{t("btn_delete")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({ title, action, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
    {children}
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-SOCIETY COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Single society membership card ──────────────────────────────────────────
const SocietyMembershipCard = ({ membership, isActive, onSwitch, switchingId }) => {
  const { t } = useLanguage();
  // membership.society is a populated object { _id, name, joinCode, logo }
  const society  = membership.society || {};
  const sid      = society?._id?.toString() || membership.society?.toString();
  const isBusy   = switchingId === sid;

  const initials = (society?.name || "??")
    .split(" ").map((w) => w[0] || "").join("").toUpperCase().slice(0, 2);

  const flatWing = [
    membership.flat && `${t("profile_flat_short", "Flat")} ${membership.flat}`,
    membership.wing && `${t("profile_wing_short", "Wing")} ${membership.wing}`,
  ].filter(Boolean).join(" · ");

  const roleText = roleLabel(t, membership.role);

  return (
    <View style={[smStyles.card, isActive && smStyles.cardActive]}>
      {/* Left: avatar + info */}
      <View style={smStyles.left}>
        <View style={[smStyles.avatar, { backgroundColor: isActive ? C.teal + "20" : C.gray100 }]}>
          <Text style={[smStyles.avatarText, { color: isActive ? C.teal : C.gray500 }]}>
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={smStyles.name} numberOfLines={1}>
            {society?.name || t("profile_unknown_society", "Unknown Society")}
          </Text>
          <Text style={smStyles.meta} numberOfLines={1}>
            {[flatWing, roleText].filter(Boolean).join("  ·  ")}
          </Text>
          {!membership.isApproved && (
            <View style={smStyles.pendingPill}>
              <Text style={smStyles.pendingPillText}>⏳ {t("profile_pending_approval", "Pending Approval")}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: active badge or switch button */}
      <View style={smStyles.right}>
        {isActive ? (
          <View style={smStyles.activeBadge}>
            <Text style={smStyles.activeBadgeText}>✓ {t("profile_active", "Active")}</Text>
          </View>
        ) : membership.isApproved ? (
          <TouchableOpacity
            onPress={() => onSwitch(sid)}
            disabled={!!switchingId}
            activeOpacity={0.75}
            style={smStyles.switchBtn}
          >
            {isBusy
              ? <ActivityIndicator size="small" color={C.teal} />
              : <Text style={smStyles.switchBtnText}>{t("profile_switch", "Switch")}</Text>
            }
          </TouchableOpacity>
        ) : (
          // Pending and not active — no switch button, show nothing (pending pill covers it)
          null
        )}
      </View>
    </View>
  );
};

// ─── Join Society Modal ───────────────────────────────────────────────────────
const JoinSocietyModal = ({ open, onClose, onJoined }) => {
  const toast        = useToast();
  const { t }         = useLanguage();
  const { joinSociety } = useAuth();
  const INIT = { societyJoinCode: "", flat: "", wing: "" };
  const [form,   setForm]   = useState(INIT);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const code = form.societyJoinCode.trim().toUpperCase();
    if (code.length !== 8) return toast.error(t("profile_join_code_length_err", "Join code must be 8 characters."));
    setSaving(true);
    try {
      const result = await joinSociety({
        societyJoinCode: code,
        flat:  form.flat.trim()  || undefined,
        wing:  form.wing.trim()  || undefined,
      });
      const societyName = result.society?.name || t("profile_the_society", "the society");
      toast.success(
        result.pendingApproval
          ? t("profile_join_pending_msg", "Request sent to %s. Waiting for admin approval.", { name: societyName })
          : t("profile_join_success_msg", "You've joined %s!", { name: societyName })
      );
      onJoined();
      setForm(INIT);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("profile_join_failed_err", "Failed to join society. Check the join code."));
    } finally { setSaving(false); }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={() => { onClose(); setForm(INIT); }} title={t("profile_join_society_title", "Join Another Society")}>

      {/* Instructional hint */}
      <View style={jsStyles.hint}>
        <Text style={jsStyles.hintText}>
          {t("profile_join_society_hint", "Get the 8-character join code from your society admin or scan the QR code in the lobby.")}
        </Text>
      </View>

      <Input
        label={t("profile_join_code_label", "Society Join Code *")}
        value={form.societyJoinCode}
        onChangeText={(v) => set("societyJoinCode")(v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        placeholder="e.g. SUNRISE1"
        autoCapitalize="characters"
        maxLength={8}
      />

      {/* Character counter */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: -10, marginBottom: 14 }}>
        <Text style={{ fontSize: 11, color: form.societyJoinCode.length === 8 ? C.green : C.gray300 }}>
          {form.societyJoinCode.length}/8
        </Text>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input
            label={t("profile_flat_unit_label", "Flat / Unit No.")}
            value={form.flat}
            onChangeText={set("flat")}
            placeholder="e.g. 204"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t("profile_wing_optional_label", "Wing (optional)")}
            value={form.wing}
            onChangeText={set("wing")}
            placeholder="e.g. A"
          />
        </View>
      </View>

      <Btn
        onPress={handleSubmit}
        loading={saving}
        style={{ marginTop: 4, backgroundColor: C.navy }}
      >
        🏘️ {t("profile_join_society_btn", "Join Society")}
      </Btn>
    </Modal>
  );
};

// ─── My Societies Section content ─────────────────────────────────────────────
const MySocietiesSection = ({
  memberships,
  activeSocietyId,
  onSwitch,
  onJoin,
  switchingId,
}) => {
  const { t } = useLanguage();
  if (!memberships || memberships.length === 0) {
    return (
      <View style={smStyles.empty}>
        <Text style={smStyles.emptyText}>
          {t("profile_no_society_joined", "You have not joined any society yet.")}
        </Text>
        <TouchableOpacity onPress={onJoin} style={smStyles.joinEmptyBtn} activeOpacity={0.8}>
          <Text style={smStyles.joinEmptyBtnText}>+ {t("profile_join_a_society", "Join a Society")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {memberships
        .filter((m) => m.isActive !== false)
        .map((m) => {
          const sid = m.society?._id?.toString() || m.society?.toString();
          const isActive = sid === activeSocietyId;
          return (
            <SocietyMembershipCard
              key={m._id || sid}
              membership={m}
              isActive={isActive}
              onSwitch={onSwitch}
              switchingId={switchingId}
            />
          );
        })
      }

      {/* Join another society button */}
      <TouchableOpacity onPress={onJoin} activeOpacity={0.75} style={smStyles.joinMoreBtn}>
        <Text style={smStyles.joinMoreBtnText}>+ {t("profile_join_another_society", "Join Another Society")}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PROFILE SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export const ProfileScreen = ({ navigation }) => {
  const { user, refreshUser, logout, switchSociety, activeSocietyId, memberships } = useAuth();
  const toast  = useToast();
  const { t }  = useLanguage();
  const insets = useSafeAreaInsets();

  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [editOpen,       setEditOpen]       = useState(false);
  const [familyOpen,     setFamilyOpen]     = useState(false);
  const [editingMember,  setEditingMember]  = useState(null);
  const [joinOpen,       setJoinOpen]       = useState(false);
  const [switchingId,    setSwitchingId]    = useState(null); // societyId being switched to

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.getProfile();
      setProfile(res.data.user);
    } catch {
      toast.error(t("error_generic"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleProfileSaved = async (updated) => {
    setProfile(updated);
    await refreshUser();
  };

  const handleAvatarUpdate = async (data) => {
    setProfile((p) => ({ ...p, avatar: data.avatar }));
    await refreshUser();
  };

  const handleFamilyDone      = (familyMembers) => setProfile((p) => ({ ...p, familyMembers }));
  const handleRemoveMember    = async (memberId) => {
    try {
      const res = await userApi.removeFamilyMember(memberId);
      setProfile((p) => ({ ...p, familyMembers: res.data.familyMembers }));
      toast.success(t("profile_member_removed", "Member removed"));
    } catch { toast.error(t("error_generic")); }
  };

  const handleLogout = () =>
    Alert.alert(
      t("profile_signout_title", "Sign Out"),
      t("profile_signout_body", "Are you sure you want to sign out?"),
      [
        { text: t("btn_cancel", "Cancel"), style: "cancel" },
        { text: t("btn_sign_out", "Sign Out"), style: "destructive", onPress: async () => {
          try { await logout(); } catch (e) { console.warn(e?.message); }
        }},
      ]
    );

  const handleEditMember = (member) => { setEditingMember(member); setFamilyOpen(true); };

  // ── Switch active society ────────────────────────────────────────────────────
  const handleSwitchSociety = async (societyId) => {
    if (switchingId) return; // already switching
    setSwitchingId(societyId);
    try {
      const updated  = await switchSociety(societyId);
      const society  = updated?.memberships?.find(
        (m) => m.society?._id?.toString() === societyId || m.society?.toString() === societyId
      )?.society;
      const name     = society?.name || t("profile_new_society", "new society");
      toast.success(t("profile_switched_to", "Switched to %s", { name }));
      // Reload profile so the societies section reflects the new activeSocietyId
      await loadProfile();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("profile_switch_failed", "Failed to switch society."));
    } finally { setSwitchingId(null); }
  };

  // ── After joining a new society ──────────────────────────────────────────────
  const handleJoined = async () => {
    await loadProfile();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}><Spinner size={32} /></View>
      </SafeAreaView>
    );
  }

  const p = profile || user;

  // Resolve memberships: prefer from profile (populated), fall back to AuthContext
  const displayMemberships = (p?.memberships?.length ? p.memberships : memberships) || [];
  const displayActiveSocietyId =
    p?.activeSocietyId?._id?.toString() ||
    p?.activeSocietyId?.toString() ||
    activeSocietyId;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header banner ─────────────────────────────────────────────────── */}
        <View style={[styles.headerBanner, { paddingTop: Math.max(20, insets.top + 12) }]}>
          <Text style={styles.headerLabel}>{t("profile_header_label", "MY PROFILE")}</Text>
        </View>

        {/* ── Avatar + name ──────────────────────────────────────────────────── */}
        <View style={styles.avatarCard}>
          <AvatarSection profile={p} onAvatarUpdate={handleAvatarUpdate} />
        </View>

        {/* ── Personal Details ───────────────────────────────────────────────── */}
        <SectionCard
          title={t("profile_personal_details", "Personal Details")}
          action={
            <TouchableOpacity onPress={() => setEditOpen(true)} style={styles.editBtn} activeOpacity={0.75}>
              <Text style={styles.editBtnText}>✏️ {t("btn_edit")}</Text>
            </TouchableOpacity>
          }
        >
          <FieldRow label={t("profile_email_label", "Email")} value={p?.email} />
          <FieldRow label={t("profile_phone")} value={p?.phone} />
          <FieldRow label={t("profile_flat")}  value={p?.flat} />
          <FieldRow label={t("profile_wing")}  value={p?.wing || p?.block} />
          <FieldRow label={t("profile_society_label", "Society")} value={p?.society?.name} />
          <FieldRow
            label={t("profile_account_status_label", "Account Status")}
            last
            value={
              <Badge
                label={p?.isApproved ? t("profile_status_approved", "Approved") : t("profile_status_pending", "Pending")}
                bg={p?.isApproved   ? "#D1FAE5"   : "#FEF3C7"}
                text={p?.isApproved ? "#065F46"   : "#92400E"}
                dot={p?.isApproved  ? "#10B981"   : "#F59E0B"}
              />
            }
          />
        </SectionCard>

        {/* ── Family Members ────────────────────────────────────────────────── */}
        <SectionCard
          title={`${t("profile_family")}${p?.familyMembers?.length ? `  (${p.familyMembers.length})` : ""}`}
          action={
            <TouchableOpacity
              onPress={() => { setEditingMember(null); setFamilyOpen(true); }}
              style={[styles.editBtn, { backgroundColor: C.amber + "22" }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.editBtnText, { color: C.amber }]}>+ {t("profile_add_member")}</Text>
            </TouchableOpacity>
          }
        >
          {!p?.familyMembers?.length ? (
            <View style={styles.emptyFamily}>
              <Text style={styles.emptyFamilyIcon}>👨‍👩‍👧</Text>
              <Text style={styles.emptyFamilyText}>{t("profile_no_family_members", "No family members added yet")}</Text>
            </View>
          ) : (
            p.familyMembers.map((m) => (
              <FamilyMemberRow key={m._id} member={m} onEdit={handleEditMember} onRemove={handleRemoveMember} />
            ))
          )}
        </SectionCard>

        {/* ══ MY SOCIETIES ══════════════════════════════════════════════════════
             Shows all societies the user belongs to.
             Active society has a green check. Others show a "Switch" button.
             "Join Another Society" button at the bottom opens JoinSocietyModal.
        ══════════════════════════════════════════════════════════════════════ */}
        <SectionCard
          title={`${t("profile_my_societies", "My Societies")}${displayMemberships.length > 1 ? `  (${displayMemberships.length})` : ""}`}
          action={
            displayMemberships.length > 0 ? (
              <TouchableOpacity
                onPress={() => setJoinOpen(true)}
                style={[styles.editBtn, { backgroundColor: C.navy + "12" }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.editBtnText, { color: C.navy }]}>+ {t("profile_join_short", "Join")}</Text>
              </TouchableOpacity>
            ) : null
          }
        >
          <MySocietiesSection
            memberships={displayMemberships}
            activeSocietyId={displayActiveSocietyId}
            onSwitch={handleSwitchSociety}
            onJoin={() => setJoinOpen(true)}
            switchingId={switchingId}
          />
        </SectionCard>

        {/* ── Society Info (active society details) ──────────────────────────── */}
        {p?.society && (
          <SectionCard title={t("profile_active_society_info", "Active Society Info")}>
            <FieldRow label={t("profile_society_name_label", "Society Name")} value={p.society.name} />
            <FieldRow label={t("profile_join_code_field_label", "Join Code")}    value={p.society.joinCode} />
            <FieldRow label={t("profile_city_label", "City")}         value={p.society.city} />
            <FieldRow label={t("profile_state_label", "State")}        value={p.society.state} last />
          </SectionCard>
        )}

        {/* ── Language Preference ────────────────────────────────────────────── */}
        <SectionCard title={t("profile_language_section", "Language")}>
          <View style={styles.langRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.langLabel}>{t("profile_app_language", "App Language")}</Text>
              <Text style={styles.langHint}>EN · हि · ગુ</Text>
            </View>
            <LanguageSwitcher compact={false} />
          </View>
        </SectionCard>
      </ScrollView>

      {/* ── Sign Out ────────────────────────────────────────────────────────── */}
      <TouchableOpacity onPress={handleLogout} activeOpacity={0.75} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>🚪 {t("btn_sign_out", "Sign Out")}</Text>
      </TouchableOpacity>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={p}
        onSaved={handleProfileSaved}
      />
      <FamilyModal
        open={familyOpen}
        onClose={() => { setFamilyOpen(false); setEditingMember(null); }}
        member={editingMember}
        onDone={handleFamilyDone}
      />
      <JoinSocietyModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={handleJoined}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  center:            { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:            { paddingBottom: 40 },
  headerBanner:      { backgroundColor: C.navy, paddingHorizontal: 20, paddingBottom: 32 },
  headerLabel:       { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 1.2 },
  avatarCard:        {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: -20,
    borderRadius: 16, paddingTop: 20, paddingBottom: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.gray100,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatarSection:     { alignItems: "center" },
  avatarWrap:        { position: "relative", marginBottom: 12 },
  avatarImg:         { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: C.teal + "30" },
  initialsWrap:      { alignItems: "center", justifyContent: "center" },
  initialsText:      { fontWeight: "800" },
  cameraBadge:       {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.navy, borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  avatarName:        { fontSize: 20, fontWeight: "800", color: C.navy },
  avatarRole:        { fontSize: 12, color: C.gray500, marginTop: 3 },
  sectionCard:       {
    backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.gray100,
  },
  sectionHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle:      { fontSize: 13, fontWeight: "700", color: C.gray700 },
  editBtn:           { backgroundColor: C.teal + "15", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  editBtnText:       { fontSize: 12, fontWeight: "700", color: C.teal },
  fieldRow:          {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.gray100,
  },
  fieldLabel:        { fontSize: 12, color: C.gray500, fontWeight: "600" },
  fieldValue:        { fontSize: 14, color: C.text, fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  familyRow:         {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.gray100,
  },
  familyAvatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple + "20", alignItems: "center", justifyContent: "center" },
  familyInitials:    { fontSize: 13, fontWeight: "800", color: C.purple },
  familyName:        { fontSize: 13, fontWeight: "700", color: C.text },
  familyMeta:        { fontSize: 11, color: C.gray500, marginTop: 2 },
  familyActions:     { flexDirection: "row", gap: 6 },
  familyBtn:         { borderWidth: 1, borderColor: C.gray100, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  familyBtnDanger:   { borderColor: C.red + "40" },
  familyBtnText:     { fontSize: 11, fontWeight: "700", color: C.gray700 },
  emptyFamily:       { alignItems: "center", paddingVertical: 16 },
  emptyFamilyIcon:   { fontSize: 28, marginBottom: 6 },
  emptyFamilyText:   { fontSize: 13, color: C.gray300 },
  pillLabel:         { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 },
  pillRow:           { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  pill:              { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100 },
  pillActive:        { borderColor: C.teal, backgroundColor: C.teal + "15" },
  pillText:          { fontSize: 13, fontWeight: "600", color: C.gray700 },
  pillTextActive:    { color: C.teal },
  row:               { flexDirection: "row" },
  langRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  langLabel:         { fontSize: 13, fontWeight: "600", color: C.text },
  langHint:          { fontSize: 11, color: C.gray500, marginTop: 2 },
  signOutBtn:        {
    marginHorizontal: 16, marginTop: 8, marginBottom: 32,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#FEE2E2", alignItems: "center",
    borderWidth: 1, borderColor: "#FECACA",
  },
  signOutText:       { fontSize: 14, fontWeight: "700", color: "#DC2626", letterSpacing: 0.2 },
});

// ─── Societies styles ─────────────────────────────────────────────────────────
const smStyles = StyleSheet.create({
  // Individual membership card
  card: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.gray100,
  },
  cardActive: {
    // No extra background — the activeBadge makes it clear
  },
  left: {
    flexDirection: "row", alignItems: "center", gap: 12, flex: 1,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15, fontWeight: "800",
  },
  name: {
    fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 2,
  },
  meta: {
    fontSize: 11, color: C.gray500,
  },
  pendingPill: {
    marginTop: 4, alignSelf: "flex-start",
    backgroundColor: "#FEF3C7", borderRadius: 20,
    paddingVertical: 2, paddingHorizontal: 8,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  pendingPillText: {
    fontSize: 10, fontWeight: "700", color: "#92400E",
  },
  right: {
    alignItems: "flex-end", marginLeft: 8, flexShrink: 0,
  },
  activeBadge: {
    backgroundColor: "#D1FAE5", borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: "#6EE7B7",
  },
  activeBadgeText: {
    fontSize: 11, fontWeight: "700", color: "#065F46",
  },
  switchBtn: {
    backgroundColor: C.teal + "15", borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: C.teal + "40",
    minWidth: 70, alignItems: "center",
  },
  switchBtnText: {
    fontSize: 12, fontWeight: "700", color: C.teal,
  },

  // Empty state
  empty: {
    alignItems: "center", paddingVertical: 20, gap: 12,
  },
  emptyText: {
    fontSize: 13, color: C.gray300, textAlign: "center",
  },
  joinEmptyBtn: {
    backgroundColor: C.navy + "12", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 20,
    borderWidth: 1, borderColor: C.navy + "25",
  },
  joinEmptyBtnText: {
    fontSize: 13, fontWeight: "700", color: C.navy,
  },

  // "Join another society" bottom row
  joinMoreBtn: {
    marginTop: 12, alignItems: "center",
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderStyle: "dashed",
    borderColor: C.gray300,
  },
  joinMoreBtnText: {
    fontSize: 13, fontWeight: "600", color: C.gray500,
  },
});

// ─── Join Society Modal styles ────────────────────────────────────────────────
const jsStyles = StyleSheet.create({
  hint: {
    backgroundColor: C.teal + "12",
    borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: C.teal + "25",
  },
  hintText: {
    fontSize: 12, color: C.teal, lineHeight: 18,
  },
});