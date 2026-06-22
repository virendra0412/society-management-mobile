/**
 * screens/more/NoticesScreen.jsx
 *
 * Converted from web ResourceScreens.jsx → React Native (Expo).
 * Features:
 *   • View pinned + all notices
 *   • Filter by tag (Urgent / Finance / Event)
 *   • Admin: create, edit, publish, pin, delete notices
 *
 * Gap fixed (TC-NOTICE-04):
 *   Added editTarget state — tapping "Edit" on a card pre-fills the modal
 *   and calls noticesApi.update(id, form) on save instead of create.
 */
import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { noticesApi } from "../../api/resources.api";
import { useAuth }    from "../../context/AuthContext";
import { useToast }   from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner,
} from "../../components/ui";
import {
  C, NOTICE_TAG_COLOR, NOTICE_TAG_ICON, NOTICE_TAGS,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── PillSelect ───────────────────────────────────────────────────────────────
const PillSelect = ({ label, value, options, onSelect, labelKeyPrefix }) => {
  const { t } = useLanguage();
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 }}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              borderWidth: 1.5,
              borderColor: value === opt ? C.teal : C.gray100,
              backgroundColor: value === opt ? C.teal : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: value === opt ? "#fff" : C.gray700 }}>
              {labelKeyPrefix ? t(`${labelKeyPrefix}${opt}`, opt) : opt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// ─── Notice Card ──────────────────────────────────────────────────────────────
const NoticeCard = ({ notice, canWrite, onTogglePin, onDelete, onEdit, pinBusy, delBusy }) => {
  const { t } = useLanguage();
  const tagColor = NOTICE_TAG_COLOR[notice.tag] || C.teal;
  const icon     = NOTICE_TAG_ICON[notice.tag]  || "📋";

  return (
    <Card style={s.card}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        {/* Icon with pin dot */}
        <View style={{ position: "relative" }}>
          <View style={[s.iconBox, { backgroundColor: tagColor + "15" }]}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>
          {notice.isPinned && (
            <View style={s.pinDot}>
              <Text style={{ fontSize: 8 }}>📌</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.text, flex: 1, lineHeight: 20 }}>
              {notice.isPinned && (
                <Text style={{ fontSize: 10, fontWeight: "700", color: C.amber }}>{t("notice_pinned_label","PINNED")} · </Text>
              )}
              {notice.title}
            </Text>
            <View style={[s.tag, { backgroundColor: tagColor + "18" }]}>
              <Text style={[s.tagText, { color: tagColor }]}>{t(`notice_tag_${notice.tag}`, notice.tag)}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: C.gray500, lineHeight: 18, marginBottom: 6 }}>{notice.body}</Text>
          <Text style={{ fontSize: 11, color: C.gray300, marginBottom: canWrite ? 10 : 0 }}>
            {t("notice_posted_by", "Posted by {name} - {timeAgo}").replace("{name}", notice.postedBy?.name || "Admin").replace("{timeAgo}", timeAgo(notice.createdAt))}
          </Text>

          {/* Admin actions */}
          {canWrite && (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {/* ── Pin / Unpin ── */}
              <TouchableOpacity
                onPress={() => !pinBusy && onTogglePin(notice)}
                disabled={!!pinBusy}
                style={[s.adminBtn, { backgroundColor: notice.isPinned ? C.amber + "20" : C.gray100,
                  borderColor: notice.isPinned ? C.amber + "50" : C.gray100 }]}
              >
                {pinBusy ? <Spinner size={10} /> : <Text style={{ fontSize: 10 }}>📌</Text>}
                <Text style={[s.adminBtnText, { color: notice.isPinned ? C.amber : C.gray700 }]}>
                  {notice.isPinned ? t("notice_unpin", "Unpin") : t("notice_pin", "Pin")}
                </Text>
              </TouchableOpacity>

              {/* ── Edit ── (TC-NOTICE-04) */}
              <TouchableOpacity
                onPress={() => onEdit(notice)}
                style={[s.adminBtn, { backgroundColor: C.teal + "12", borderColor: C.teal + "30" }]}
              >
                <Text style={{ fontSize: 10 }}>✏️</Text>
                <Text style={[s.adminBtnText, { color: C.teal }]}>{t("notice_btn_edit","Edit")}</Text>
              </TouchableOpacity>

              {/* ── Delete ── */}
              <TouchableOpacity
                onPress={() => !delBusy && onDelete(notice._id)}
                disabled={!!delBusy}
                style={[s.adminBtn, { backgroundColor: C.red + "10", borderColor: C.red + "25" }]}
              >
                {delBusy ? <Spinner size={10} /> : <Text style={{ fontSize: 10 }}>🗑</Text>}
                <Text style={[s.adminBtnText, { color: C.red }]}>{t("notice_btn_delete","Delete")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

// ─── Blank form ───────────────────────────────────────────────────────────────
const BLANK_FORM = { title: "", body: "", tag: "Notice" };

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const NoticesScreen = ({ navigation }) => {
  const { isAdmin, hasPermission, dataVersion } = useAuth();
  const { t } = useLanguage();
  const canWrite = isAdmin || hasPermission("notices", "write");
  const toast = useToast();

  const [notices,    setNotices]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Modal state — editTarget holds the notice being edited (null = create mode)
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);   // TC-NOTICE-04
  const [form,        setForm]        = useState(BLANK_FORM);
  const [submitting,  setSubmitting]  = useState(false);

  const [pinBusy,    setPinBusy]    = useState({}); // noticeId → bool
  const [delBusy,    setDelBusy]    = useState({}); // noticeId → bool

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await noticesApi.getAll({ limit: 30 });
      setNotices(res.data?.notices || []);
    } catch (e) {
      setError(e.response?.data?.message || t("notice_load_failed", "Failed to load notices."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      fetchNotices();
    }, [fetchNotices])
  );

  // ── Open modal helpers ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  };

  const openEdit = (notice) => {             // TC-NOTICE-04
    setEditTarget(notice);
    setForm({ title: notice.title, body: notice.body, tag: notice.tag || "Notice" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
    setForm(BLANK_FORM);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("nav_notices", "Notices"),
      headerRight: canWrite
        ? () => (
            <TouchableOpacity onPress={openCreate} style={s.headerBtn}>
              <Text style={s.headerBtnText}>+ {t("btn_post", "Post")}</Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, canWrite, openCreate, t]);

  // ── Save (create OR update) ───────────────────────────────────────────────
  const handleSave = async () => {            // TC-NOTICE-04 — unified save handler
    if (!form.title.trim() || !form.body.trim())
      return toast.error(t("notice_required_fields", "Title and message are required."));

    setSubmitting(true);
    try {
      if (editTarget) {
        // ── UPDATE existing notice ──
        const res = await noticesApi.update(editTarget._id, form);
        const updated = res.data?.notice;
        if (updated) {
          setNotices((list) =>
            list.map((n) => (n._id === updated._id ? updated : n))
          );
        }
        toast.success(t("notice_updated", "Notice updated."));
      } else {
        // ── CREATE new notice ──
        const res = await noticesApi.create(form);
        setNotices((p) => [res.data.notice, ...p]);
        toast.success(t("notice_posted_success", "Notice posted."));
      }
      closeModal();
    } catch (e) {
      toast.error(e.response?.data?.message || t("notice_save_failed", "Failed to save notice."));
    } finally { setSubmitting(false); }
  };

  // ── Pin toggle ────────────────────────────────────────────────────────────
  const handleTogglePin = async (notice) => {
    if (pinBusy[notice._id]) return;
    setPinBusy((p) => ({ ...p, [notice._id]: true }));
    try {
      const next = !notice.isPinned;
      await noticesApi.setPinned(notice._id, next);
      setNotices((list) => {
        const updated = list.map((n) => n._id === notice._id ? { ...n, isPinned: next } : n);
        return [...updated.filter((n) => n.isPinned), ...updated.filter((n) => !n.isPinned)];
      });
      toast.success(next ? t("notice_pinned", "Notice pinned.") : t("notice_unpinned", "Notice unpinned."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("notice_pin_failed", "Failed to update pin."));
    } finally { setPinBusy((p) => ({ ...p, [notice._id]: false })); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (noticeId) => {
    if (delBusy[noticeId]) return;
    setDelBusy((d) => ({ ...d, [noticeId]: true }));
    try {
      await noticesApi.remove(noticeId);
      setNotices((list) => list.filter((n) => n._id !== noticeId));
      toast.success(t("notice_deleted", "Notice deleted."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("notice_delete_failed", "Failed to delete notice."));
    } finally { setDelBusy((d) => ({ ...d, [noticeId]: false })); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      {loading ? (
        <View style={s.center}><Spinner size={32} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchNotices} />
      ) : notices.length === 0 ? (
        <EmptyState icon="📢" message={t("notice_no_posts", "No notices posted yet.")} />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(n) => n._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NoticeCard
              notice={item}
              canWrite={canWrite}
              pinBusy={pinBusy[item._id]}
              delBusy={delBusy[item._id]}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
              onEdit={openEdit}            // TC-NOTICE-04
            />
          )}
        />
      )}

      {/* Create / Edit modal — TC-NOTICE-04: title and save label switch on editTarget */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editTarget ? t("notice_edit_title", "Edit Notice") : t("notice_create_title", "Post a Notice")}
      >
        <Input
          label={t("notice_title_label", "Title *")}
          value={form.title}
          onChangeText={set("title")}
          placeholder={t("notice_title_ph", "e.g. Water shutdown on Thursday")}
        />
        <Input
          label={t("notice_body_label", "Message *")}
          value={form.body}
          onChangeText={set("body")}
          placeholder={t("notice_body_ph", "Full notice details…")}
          multiline
        />
        <PillSelect
          label={t("notice_tag_label", "Tag")}
          value={form.tag}
          options={NOTICE_TAGS}
          onSelect={set("tag")}
          labelKeyPrefix="notice_tag_"
        />
        <Btn onPress={handleSave} loading={submitting} style={{ width: "100%" }}>
          {editTarget ? t("notice_save_changes", "Save Changes") : t("notice_post_btn", "Post Notice")}
        </Btn>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  list:          { paddingHorizontal: 16, paddingBottom: 24 },
  card:          { marginBottom: 10 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  headerBtn:     { backgroundColor: C.teal + "15", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  headerBtnText: { fontSize: 12, fontWeight: "700", color: C.teal },
  iconBox:       { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pinDot:        { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: C.amber, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  tag:           { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  tagText:       { fontSize: 10, fontWeight: "700" },
  adminBtn:      { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, minHeight: 28 },
  adminBtnText:  { fontSize: 11, fontWeight: "700", lineHeight: 14 },
});