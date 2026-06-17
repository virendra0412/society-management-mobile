/**
 * screens/more/ContactsScreen.jsx
 *
 * Converted from web ResourceScreens.jsx → React Native (Expo).
 * Features:
 *   • Emergency contacts (tap to call)
 *   • Committee / Vendor / Other groups
 *   • Admin: add / edit / delete contacts
 */
import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Linking, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { contactsApi } from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Btn, Card, EmptyState, ErrorState,
  Modal, Input, Spinner,
} from "../../components/ui";
import { C, CONTACT_GROUPS } from "../../constants/theme";

const GROUP_COLORS = { Emergency: C.red, Committee: C.navy, Vendor: C.amber, Other: C.teal };

// ─── PillSelect ───────────────────────────────────────────────────────────────
const PillSelect = ({ label, value, options, onSelect }) => (
  <View style={{ marginBottom: 14 }}>
    {label && <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 }}>{label}</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onSelect(opt)}
          style={{
            paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
            borderColor: value === opt ? C.teal : C.gray100,
            backgroundColor: value === opt ? C.teal : "transparent",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: value === opt ? "#fff" : C.gray700 }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// ─── Contact Card ─────────────────────────────────────────────────────────────
const ContactCard = ({ contact, isAdmin, onEdit, onDelete, delBusy }) => {
  const color = GROUP_COLORS[contact.group] || C.teal;

  const handleCall = () => {
    Linking.openURL(`tel:${contact.phone}`).catch(() => {});
  };

  return (
    <Card style={{ padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: color + "15",
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>{contact.icon || "📞"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{contact.name}</Text>
          <Text style={{ fontSize: 12, color: C.gray500, marginTop: 1 }}>
            {contact.designation ? `${contact.designation} · ` : ""}📞 {contact.phone}
          </Text>
        </View>

        {isAdmin ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <TouchableOpacity onPress={() => onEdit(contact)}
              style={{ backgroundColor: C.teal + "15", borderRadius: 8, padding: 8 }}>
              <Text style={{ fontSize: 14 }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => !delBusy && onDelete(contact._id)}
              disabled={!!delBusy}
              style={{ backgroundColor: C.red + "12", borderRadius: 8, padding: 8 }}
            >
              {delBusy ? <Spinner size={14} /> : <Text style={{ fontSize: 14 }}>🗑</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCall}
              style={{ backgroundColor: C.teal, borderRadius: 10, width: 36, height: 36,
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16 }}>📞</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleCall}
            style={{ backgroundColor: C.teal, borderRadius: 10, width: 36, height: 36,
              alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16 }}>📞</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const ContactsScreen = ({ navigation }) => {
  const { isAdmin } = useAuth();
  const toast       = useToast();
  const { t }       = useLanguage();

  const [grouped,    setGrouped]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState({ name: "", phone: "", group: "Emergency", designation: "", icon: "📞" });
  const [submitting, setSubmitting] = useState(false);
  const [delBusy,    setDelBusy]    = useState({});
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const fetchContacts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await contactsApi.getAll();
      setGrouped(res.data?.contacts || {});
    } catch (e) {
      setError(e.response?.data?.message || t("contacts_load_failed", "Failed to load contacts."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  const openAdd = useCallback(() => {
    setEditTarget(null);
    setForm({ name: "", phone: "", group: "Emergency", designation: "", icon: "📞" });
    setShowModal(true);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("contacts_header_title", "Contacts"),
      headerRight: isAdmin
        ? () => (
            <TouchableOpacity
              onPress={openAdd}
              style={{ backgroundColor: C.teal + "15", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.teal }}>
                {t("contacts_add_btn", "+ Add")}
              </Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, isAdmin, openAdd, t]);

  const openEdit = (contact) => {
    setEditTarget(contact);
    setForm({
      name: contact.name || "", phone: contact.phone || "",
      group: contact.group || "Emergency",
      designation: contact.designation || "", icon: contact.icon || "📞",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim())
      return toast.error(t("contacts_name_phone_required", "Name and phone are required."));
    setSubmitting(true);
    try {
      if (editTarget) {
        const res = await contactsApi.update(editTarget._id, form);
        const updated = res.data?.contact;
        if (updated && updated.group === editTarget.group) {
          setGrouped((prev) => {
            const next = {};
            Object.entries(prev).forEach(([grp, items]) => {
              next[grp] = items.map((c) => c._id === updated._id ? updated : c);
            });
            return next;
          });
        } else { fetchContacts(); }
        toast.success(t("contacts_updated", "Contact updated."));
      } else {
        await contactsApi.create(form);
        toast.success(t("contacts_added", "Contact added."));
        fetchContacts();
      }
      setShowModal(false); setEditTarget(null);
    } catch (e) {
      toast.error(e.response?.data?.message || t("contacts_save_failed", "Failed to save contact."));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (contactId) => {
    if (delBusy[contactId]) return;
    setDelBusy((d) => ({ ...d, [contactId]: true }));
    try {
      await contactsApi.remove(contactId);
      setGrouped((prev) => {
        const next = {};
        Object.entries(prev).forEach(([grp, items]) => {
          const filtered = items.filter((c) => c._id !== contactId);
          if (filtered.length) next[grp] = filtered;
        });
        return next;
      });
      toast.success(t("contacts_deleted", "Contact deleted."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("contacts_delete_failed", "Failed to delete contact."));
    } finally { setDelBusy((d) => ({ ...d, [contactId]: false })); }
  };

  const groups = Object.entries(grouped);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Spinner size={32} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchContacts} />
      ) : groups.length === 0 ? (
        <EmptyState icon="📞" message={t("contacts_empty", "No contacts added yet.")} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={([group]) => group}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: [group, items] }) => (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.gray500,
                textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                {group}
              </Text>
              {items.map((c) => (
                <ContactCard
                  key={c._id}
                  contact={c}
                  isAdmin={isAdmin}
                  delBusy={delBusy[c._id]}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        title={editTarget
          ? t("contacts_modal_edit_title", "Edit Contact")
          : t("contacts_modal_add_title", "Add Contact")}
      >
        <Input
          label={t("contacts_name_label", "Name *")}
          value={form.name}
          onChangeText={set("name")}
          placeholder={t("contacts_name_ph", "Raju Electrician")}
        />
        <Input
          label={t("contacts_phone_label", "Phone *")}
          value={form.phone}
          onChangeText={set("phone")}
          placeholder={t("contacts_phone_ph", "9876543210")}
          keyboardType="phone-pad"
        />
        <Input
          label={t("contacts_designation_label", "Designation")}
          value={form.designation}
          onChangeText={set("designation")}
          placeholder={t("contacts_designation_ph", "Committee Treasurer")}
        />
        <Input
          label={t("contacts_icon_label", "Icon (emoji)")}
          value={form.icon}
          onChangeText={set("icon")}
          placeholder={t("contacts_icon_ph", "⚡")}
        />
        <PillSelect
          label={t("contacts_group_label", "Group")}
          value={form.group}
          options={CONTACT_GROUPS}
          onSelect={set("group")}
        />
        <Btn onPress={handleSave} loading={submitting} style={{ width: "100%" }}>
          {editTarget
            ? t("contacts_save_changes", "Save Changes")
            : t("contacts_add_contact_btn", "Add Contact")}
        </Btn>
      </Modal>
    </SafeAreaView>
  );
};