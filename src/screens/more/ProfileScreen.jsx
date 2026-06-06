/**
 * screens/more/ProfileScreen.jsx
 *
 * Full implementation — React Native port of web ProfileScreen.
 *
 * Features:
 *  • Avatar display + upload via expo-image-picker (Cloudinary on backend)
 *  • View personal details (email, phone, flat, wing, society, status)
 *  • Edit profile modal (name, phone, flat, wing)
 *  • Family members — add / edit / remove
 *  • Society info card
 *  • Fully i18n via useT()
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets }  from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { useAuth }    from "../../context/AuthContext";
import { useToast }   from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { userApi }    from "../../api/resources.api";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import {
  Card, Btn, Input, Modal, Badge, Spinner, EmptyState,
} from "../../components/ui";
import { C } from "../../constants/theme";

// ─── Constants ────────────────────────────────────────────────────────────────
const RELATION_OPTIONS = ["Spouse", "Parent", "Child", "Sibling", "Other"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Initials avatar fallback */
const InitialsAvatar = ({ name = "?", size = 64 }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={[
      styles.initialsWrap,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: C.teal + "25" },
    ]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.34, color: C.teal }]}>
        {initials}
      </Text>
    </View>
  );
};

/** Single labelled row inside a details card */
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
  const toast     = useToast();
  const { t }         = useLanguage();
  const [busy, setBusy] = useState(false);

  const handlePickAndUpload = async () => {
    // Ask permission on iOS
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access in settings.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
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
    } finally {
      setBusy(false);
    }
  };

  const avatarUri = profile?.avatar;

  return (
    <View style={styles.avatarSection}>
      <TouchableOpacity
        onPress={handlePickAndUpload}
        disabled={busy}
        activeOpacity={0.85}
        style={styles.avatarWrap}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatarImg}
          />
        ) : (
          <InitialsAvatar name={profile?.name} size={80} />
        )}

        {/* Camera badge */}
        <View style={styles.cameraBadge}>
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontSize: 11 }}>✏️</Text>
          }
        </View>
      </TouchableOpacity>

      <Text style={styles.avatarName}>{profile?.name}</Text>
      <Text style={styles.avatarRole}>
        {profile?.role === "admin" ? "👑 Admin" : "Resident"}
        {profile?.society?.name ? `  ·  ${profile.society.name}` : ""}
      </Text>
    </View>
  );
};

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
const EditProfileModal = ({ open, onClose, profile, onSaved }) => {
  const toast   = useToast();
  const { t }       = useLanguage();
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
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={t("profile_edit")}>
      <Input
        label={t("profile_full_name")}
        value={form.name}
        onChangeText={set("name")}
        placeholder="Rajesh Mehta"
      />
      <Input
        label={t("profile_phone")}
        value={form.phone}
        onChangeText={set("phone")}
        placeholder="9876543210"
        keyboardType="phone-pad"
      />
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input
            label={t("profile_flat")}
            value={form.flat}
            onChangeText={set("flat")}
            placeholder="e.g. 204"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t("profile_wing")}
            value={form.wing}
            onChangeText={set("wing")}
            placeholder="e.g. A"
          />
        </View>
      </View>
      <Btn onPress={handleSave} loading={saving} style={{ marginTop: 4 }}>
        {t("profile_save")}
      </Btn>
    </Modal>
  );
};

// ─── Family Member Modal ──────────────────────────────────────────────────────
const FamilyModal = ({ open, onClose, member, onDone }) => {
  const toast  = useToast();
  const { t }      = useLanguage();
  const isEdit = !!member;
  const [form,   setForm]   = useState({ name: "", relation: "Spouse", age: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        member
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
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t("profile_edit_member") : t("profile_add_member")}
    >
      <Input
        label={t("profile_name")}
        value={form.name}
        onChangeText={set("name")}
        placeholder="Full name"
      />

      {/* Relation pill picker */}
      <Text style={styles.pillLabel}>{t("profile_relation")}</Text>
      <View style={styles.pillRow}>
        {RELATION_OPTIONS.map((r) => {
          const active = form.relation === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setForm((p) => ({ ...p, relation: r }))}
              activeOpacity={0.75}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label={`${t("profile_age")}`}
        value={form.age}
        onChangeText={set("age")}
        placeholder={t("profile_age_ph")}
        keyboardType="number-pad"
      />
      <Btn onPress={handleSave} loading={saving} style={{ marginTop: 4 }}>
        {isEdit ? t("profile_update_btn") : t("profile_add_btn")}
      </Btn>
    </Modal>
  );
};

// ─── Family Member Row ────────────────────────────────────────────────────────
const FamilyMemberRow = ({ member, onEdit, onRemove }) => {
  const { t } = useLanguage();
  const initials = (member.name || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View style={styles.familyRow}>
      <View style={styles.familyAvatar}>
        <Text style={styles.familyInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.familyName}>{member.name}</Text>
        <Text style={styles.familyMeta}>
          {member.relation}{member.age ? `  ·  Age ${member.age}` : ""}
        </Text>
      </View>
      <View style={styles.familyActions}>
        <TouchableOpacity onPress={() => onEdit(member)} style={styles.familyBtn} activeOpacity={0.75}>
          <Text style={styles.familyBtnText}>{t("btn_edit")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Remove member", `Remove ${member.name}?`, [
              { text: "Cancel",  style: "cancel" },
              { text: "Remove",  style: "destructive", onPress: () => onRemove(member._id) },
            ]);
          }}
          style={[styles.familyBtn, styles.familyBtnDanger]}
          activeOpacity={0.75}
        >
          <Text style={[styles.familyBtnText, { color: C.red }]}>{t("btn_delete")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Section Card ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, action, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
    {children}
  </View>
);

// ─── Main ProfileScreen ────────────────────────────────────────────────────────
export const ProfileScreen = ({ navigation }) => {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const { t }     = useLanguage();
  const insets = useSafeAreaInsets();

  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [editOpen,      setEditOpen]      = useState(false);
  const [familyOpen,    setFamilyOpen]    = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.getProfile();
      setProfile(res.data.user);
    } catch {
      toast.error(t("error_generic"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleProfileSaved = async (updated) => {
    setProfile(updated);
    await refreshUser();
  };

  const handleAvatarUpdate = async (data) => {
    setProfile((p) => ({ ...p, avatar: data.avatar }));
    await refreshUser();
  };

  const handleFamilyDone = (familyMembers) => {
    setProfile((p) => ({ ...p, familyMembers }));
  };

  const handleRemoveMember = async (memberId) => {
    try {
      const res = await userApi.removeFamilyMember(memberId);
      setProfile((p) => ({ ...p, familyMembers: res.data.familyMembers }));
      toast.success("Member removed");
    } catch {
      toast.error(t("error_generic"));
    }
  };
  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try { await logout(); } catch (e) { console.warn(e?.message); }
          },
        },
      ]
    );
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setFamilyOpen(true);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Spinner size={32} />
        </View>
      </SafeAreaView>
    );
  }

  const p = profile || user;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header banner — inside ScrollView so avatarCard marginTop:-20
             overlaps without being clipped by the ScrollView top edge ── */}
        <View style={[styles.headerBanner, { paddingTop: Math.max(20, insets.top + 12) }]}>
          <Text style={styles.headerLabel}>MY PROFILE</Text>
        </View>
        {/* ── Avatar + name ────────────────────────────────────────────────── */}
        <View style={styles.avatarCard}>
          <AvatarSection profile={p} onAvatarUpdate={handleAvatarUpdate} />
        </View>

        {/* ── Personal Details ─────────────────────────────────────────────── */}
        <SectionCard
          title="Personal Details"
          action={
            <TouchableOpacity
              onPress={() => setEditOpen(true)}
              style={styles.editBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.editBtnText}>✏️ {t("btn_edit")}</Text>
            </TouchableOpacity>
          }
        >
          <FieldRow label="Email"                   value={p?.email} />
          <FieldRow label={t("profile_phone")}      value={p?.phone} />
          <FieldRow label={t("profile_flat")}       value={p?.flat} />
          <FieldRow label={t("profile_wing")}       value={p?.wing || p?.block} />
          <FieldRow label="Society"                 value={p?.society?.name} />
          <FieldRow
            label="Account Status"
            last
            value={
              <Badge
                label={p?.isApproved ? "Approved" : "Pending"}
                bg={p?.isApproved   ? "#D1FAE5"  : "#FEF3C7"}
                text={p?.isApproved ? "#065F46"  : "#92400E"}
                dot={p?.isApproved  ? "#10B981"  : "#F59E0B"}
              />
            }
          />
        </SectionCard>

        {/* ── Family Members ───────────────────────────────────────────────── */}
        <SectionCard
          title={`${t("profile_family")}${p?.familyMembers?.length ? `  (${p.familyMembers.length})` : ""}`}
          action={
            <TouchableOpacity
              onPress={() => { setEditingMember(null); setFamilyOpen(true); }}
              style={[styles.editBtn, { backgroundColor: C.amber + "22" }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.editBtnText, { color: C.amber }]}>
                + {t("profile_add_member")}
              </Text>
            </TouchableOpacity>
          }
        >
          {!p?.familyMembers?.length ? (
            <View style={styles.emptyFamily}>
              <Text style={styles.emptyFamilyIcon}>👨‍👩‍👧</Text>
              <Text style={styles.emptyFamilyText}>No family members added yet</Text>
            </View>
          ) : (
            p.familyMembers.map((m) => (
              <FamilyMemberRow
                key={m._id}
                member={m}
                onEdit={handleEditMember}
                onRemove={handleRemoveMember}
              />
            ))
          )}
        </SectionCard>

        {/* ── Society Info ─────────────────────────────────────────────────── */}
        {p?.society && (
          <SectionCard title="Society Info">
            <FieldRow label="Society Name" value={p.society.name} />
            <FieldRow label="Join Code"    value={p.society.joinCode} />
            <FieldRow label="City"         value={p.society.city} />
            <FieldRow label="State"        value={p.society.state} last />
          </SectionCard>
        )}

        {/* ── Language Preference ──────────────────────────────────────────── */}
        <SectionCard title="Language">
          <View style={styles.langRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.langLabel}>App Language</Text>
              <Text style={styles.langHint}>EN · हि · ગુ</Text>
            </View>
            <LanguageSwitcher compact={false} />
          </View>
        </SectionCard>
      </ScrollView>
      {/* ── Sign Out ─────────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleLogout}
        activeOpacity={0.75}
        style={styles.signOutBtn}
      >
        <Text style={styles.signOutText}>🚪 {t("btn_sign_out", "Sign Out")}</Text>
      </TouchableOpacity>
      {/* ── Modals ─────────────────────────────────────────────────────────── */}
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
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  center:            { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:            { paddingBottom: 40 },

  // Header
  headerBanner:      {
    backgroundColor: C.navy,
    paddingHorizontal: 20, paddingBottom: 32,
  },
  headerLabel:       {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.5)",
    letterSpacing: 1.2,
  },

  // Avatar card
  avatarCard:        {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    paddingTop: 20, paddingBottom: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: C.gray100,
    shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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

  // Section card
  sectionCard:       {
    backgroundColor: "#fff",
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.gray100,
  },
  sectionHeader:     {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  sectionTitle:      { fontSize: 13, fontWeight: "700", color: C.gray700 },

  // Edit button
  editBtn:           {
    backgroundColor: C.teal + "15",
    borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12,
  },
  editBtnText:       { fontSize: 12, fontWeight: "700", color: C.teal },

  // Field rows
  fieldRow:          {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.gray100,
  },
  fieldLabel:        { fontSize: 12, color: C.gray500, fontWeight: "600" },
  fieldValue:        { fontSize: 14, color: C.text, fontWeight: "500", maxWidth: "60%", textAlign: "right" },

  // Family
  familyRow:         {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.gray100,
  },
  familyAvatar:      {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.purple + "20",
    alignItems: "center", justifyContent: "center",
  },
  familyInitials:    { fontSize: 13, fontWeight: "800", color: C.purple },
  familyName:        { fontSize: 13, fontWeight: "700", color: C.text },
  familyMeta:        { fontSize: 11, color: C.gray500, marginTop: 2 },
  familyActions:     { flexDirection: "row", gap: 6 },
  familyBtn:         {
    borderWidth: 1, borderColor: C.gray100, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  familyBtnDanger:   { borderColor: C.red + "40" },
  familyBtnText:     { fontSize: 11, fontWeight: "700", color: C.gray700 },

  emptyFamily:       { alignItems: "center", paddingVertical: 16 },
  emptyFamilyIcon:   { fontSize: 28, marginBottom: 6 },
  emptyFamilyText:   { fontSize: 13, color: C.gray300 },

  // Relation pills
  pillLabel:         { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 },
  pillRow:           { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  pill:              {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100,
  },
  pillActive:        { borderColor: C.teal, backgroundColor: C.teal + "15" },
  pillText:          { fontSize: 13, fontWeight: "600", color: C.gray700 },
  pillTextActive:    { color: C.teal },

  // Layout helpers
  row:               { flexDirection: "row" },

  // Language section
  langRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  langLabel:         { fontSize: 13, fontWeight: "600", color: C.text },
  langHint:          { fontSize: 11, color: C.gray500, marginTop: 2 },
  
  signOutBtn: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 32,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#FEE2E2", alignItems: "center",
    borderWidth: 1, borderColor: "#FECACA",
  },
  signOutText: {
    fontSize: 14, fontWeight: "700", color: "#DC2626", letterSpacing: 0.2,
  },

});
