/**
 * screens/issues/IssuesScreen.jsx
 * Full feature parity with web IssuesScreen.
 *
 * Features:
 *  - List with status filter chips
 *  - Create issue (title, desc, category, priority, anonymous toggle)
 *  - Detail sheet: comments thread, admin status controls, escalation badge
 */
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Switch, Image, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { issuesApi } from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner, ScreenHeader,
} from "../../components/ui";
import {
  C, STATUS_COLOR, PRIORITY_COLOR, CATEGORY_ICON,
  ISSUE_CATEGORIES, PRIORITIES,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

const FILTERS = [
  { key: "All", id: "issues_filter_all" },
  { key: "Open", id: "issues_filter_open" },
  { key: "In Progress", id: "issues_filter_in_progress" },
  { key: "Resolved", id: "issues_filter_resolved" },
];
const EMPTY_FORM = {
  title: "", description: "", category: "Water",
  priority: "Medium", isAnonymous: false,
};

// ─── Chip selector (category / priority) ─────────────────────────────────────
const ChipSelector = ({ label, options, value, onChange }) => {
  const { t } = useLanguage();
  return (
  <View style={{ marginBottom: 14 }}>
    <Text style={chipStyles.label}>{t(label, label)}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[chipStyles.chip, value === opt && chipStyles.chipActive]}
          >
            <Text style={[chipStyles.chipText, value === opt && chipStyles.chipTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  </View>
);}

const chipStyles = StyleSheet.create({
  label:         { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100 },
  chipActive:    { backgroundColor: C.navy, borderColor: C.navy },
  chipText:      { fontSize: 12, fontWeight: "600", color: C.gray700 },
  chipTextActive:{ color: "#fff" },
});

// ─── Toggle row ───────────────────────────────────────────────────────────────
const ToggleRow = ({ label, hint, value, onChange }) => (
  <View style={toggleStyles.row}>
    <View style={{ flex: 1 }}>
      <Text style={toggleStyles.label}>{label}</Text>
      {hint && <Text style={toggleStyles.hint}>{hint}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: C.gray300, true: C.teal }}
      thumbColor="#fff"
    />
  </View>
);

const toggleStyles = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.gray50, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.gray100 },
  label: { fontSize: 13, fontWeight: "600", color: C.text },
  hint:  { fontSize: 11, color: C.gray500, marginTop: 2 },
});

// ─── Photo Strip (issue detail) ───────────────────────────────────────────────
const PhotoStrip = ({ urls }) => {
  if (!urls?.length) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 6 }}>
        📷 Photos ({urls.length})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {urls.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={{ width: 80, height: 80, borderRadius: 10 }}
              resizeMode="cover"
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Photo Picker Row (new issue form) ────────────────────────────────────────
const PhotoPickerRow = ({ assets, onAdd, onRemove }) => {
  const handlePick = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { t } = useLanguage();
        Alert.alert(t("issues_permission_needed","Permission needed"), t("issues_permission_photos","Please allow photo access in settings."));
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 5 - assets.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      onAdd(result.assets);
    }
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 }}>
        {useLanguage().t("issues_photos_label","Photos (up to 5, optional)")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {assets.map((asset, i) => (
            <View key={i} style={{ position: "relative" }}>
              <Image
                source={{ uri: asset.uri }}
                style={{ width: 72, height: 72, borderRadius: 10 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => onRemove(i)}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: C.red, alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {assets.length < 5 && (
            <TouchableOpacity
              onPress={handlePick}
              style={{
                width: 72, height: 72, borderRadius: 10,
                borderWidth: 2, borderColor: C.gray100, borderStyle: "dashed",
                alignItems: "center", justifyContent: "center",
                backgroundColor: C.gray50,
              }}
            >
              <Text style={{ fontSize: 22, color: C.gray300 }}>📷</Text>
              <Text style={{ fontSize: 10, color: C.gray300, marginTop: 3 }}>{useLanguage().t("issues_photos_add","Add")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Issue card ───────────────────────────────────────────────────────────────
const IssueCard = ({ issue, onPress }) => (
  <Card onPress={() => onPress(issue)} style={{ marginBottom: 8 }}>
    <View style={styles.cardRow}>
      <Text style={styles.catIcon}>{CATEGORY_ICON[issue.category] || "📋"}</Text>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.issueTitle} numberOfLines={2}>{issue.title}</Text>
        <Text style={styles.issueMeta}>
          {issue.isAnonymous ? useLanguage().t("issues_anonymous","Anonymous") : (issue.flat || issue.reporter?.flat || "—")}
          {" · "}{timeAgo(issue.createdAt)}
        </Text>
        <View style={styles.badgeRow}>
          <Badge label={issue.status}   {...(STATUS_COLOR[issue.status]   || {})} />
          <Badge label={issue.priority} {...(PRIORITY_COLOR[issue.priority] || {})} />
          {issue.isEscalated && <Badge label={useLanguage().t("issues_escalated_badge","Escalated")} bg="#FEE2E2" text={C.red} />}
          {issue.isAnonymous && <Badge label={useLanguage().t("issues_anon_badge","Anon")}      bg={C.gray100} text={C.gray500} />}
          {(issue.photos?.length ?? 0) > 0 && (
            <Badge label={`📷 ${issue.photos.length}`} bg={C.gray100} text={C.gray700} />
          )}
        </View>
      </View>
      {(issue.commentCount ?? 0) > 0 && (
        <Text style={styles.commentCount}>💬 {issue.commentCount}</Text>
      )}
    </View>
  </Card>
);

// ─── Issue Detail Modal ───────────────────────────────────────────────────────
// ─── Vendor form blank state ───────────────────────────────────────────────────
const EMPTY_VENDOR = { name: "", phone: "", note: "" };

const IssueDetailModal = ({ issue, visible, onClose, isAdmin, onUpdated }) => {
  const toast = useToast();
  const [comments,       setComments]       = useState([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [commentBody,    setCommentBody]    = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [statusLoading,  setStatusLoading]  = useState(false);
  const [localIssue,     setLocalIssue]     = useState(issue);

  // Vendor assign state (admin only)
  const [showVendor,    setShowVendor]    = useState(false);
  const [vendorForm,    setVendorForm]    = useState(EMPTY_VENDOR);
  const [vendorLoading, setVendorLoading] = useState(false);

  useEffect(() => {
    setLocalIssue(issue);
    if (!issue) return;
    setLoadingDetail(true);
    issuesApi.getOne(issue._id)
      .then((res) => {
        setLocalIssue(res.data?.issue || issue);
        setComments(res.data?.issue?.comments || []);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [issue]);

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true);
    try {
      const res = await issuesApi.update(localIssue._id, { status: newStatus });
      setLocalIssue(res.data.issue);
      onUpdated?.(res.data.issue);
      toast.success(useLanguage().t("issues_status_changed","Status updated."));
    } catch (e) {
      toast.error(e?.response?.data?.message || useLanguage().t("issues_update_failed","Update failed"));
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setCommentLoading(true);
    try {
      const res = await issuesApi.addNote(localIssue._id, commentBody.trim());
      const updatedIssue = res.data?.issue;
      const nextComments = updatedIssue?.comments || res.data?.comments || [];
      setComments(nextComments);
      if (updatedIssue) {
        setLocalIssue(updatedIssue);
        onUpdated?.(updatedIssue);
      } else {
        const updated = {
          ...localIssue,
          commentCount: Math.max(localIssue.commentCount || 0, nextComments.length),
        };
        setLocalIssue(updated);
        onUpdated?.(updated);
      }
      setCommentBody("");
    } catch (e) {
      toast.error(e?.response?.data?.message || useLanguage().t("issues_generic_failed","Failed"));
    } finally {
      setCommentLoading(false);
    }
  };

  // ── Assign vendor (admin) ────────────────────────────────────────────────────
  const handleAssignVendor = async () => {
    if (!vendorForm.name.trim() || !vendorForm.phone.trim())
      return toast.error(useLanguage().t("issues_vendor_required","Vendor name and phone are required."));
    setVendorLoading(true);
    try {
      const res = await issuesApi.assignVendor(localIssue._id, vendorForm);
      const updated = res.data?.issue || { ...localIssue, assignedVendor: vendorForm };
      setLocalIssue(updated);
      onUpdated?.(updated);
      setShowVendor(false);
      setVendorForm(EMPTY_VENDOR);
      toast.success(useLanguage().t("issues_vendor_assigned","Vendor assigned."));
    } catch (e) {
      toast.error(e?.response?.data?.message || useLanguage().t("issues_vendor_assign_failed","Failed to assign vendor."));
    } finally {
      setVendorLoading(false);
    }
  };

  if (!localIssue) return null;
  const sc = STATUS_COLOR[localIssue.status] || {};

  return (
    <Modal open={visible} onClose={onClose} title={useLanguage().t("issues_detail_title","Issue Detail")}>
      {/* Title + meta */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <Text style={{ fontSize: 28 }}>{CATEGORY_ICON[localIssue.category] || "📋"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={detailStyles.title}>{localIssue.title}</Text>
          <Text style={detailStyles.meta}>
            {localIssue.isAnonymous ? useLanguage().t("issues_anonymous","Anonymous") : (localIssue.flat || localIssue.reporter?.flat || "—")}
            {" · "}{timeAgo(localIssue.createdAt)}
          </Text>
        </View>
      </View>

      {/* Badges */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <Badge label={localIssue.status}   {...(STATUS_COLOR[localIssue.status]     || {})} />
        <Badge label={localIssue.priority} {...(PRIORITY_COLOR[localIssue.priority] || {})} />
        <Badge label={localIssue.category} bg={C.gray100} text={C.gray700} />
        {localIssue.isAnonymous && <Badge label={useLanguage().t("issues_anonymous","Anonymous")} bg={C.gray100} text={C.gray500} />}
      </View>

      {/* Description */}
      {localIssue.description ? (
        <View style={detailStyles.descBox}>
          <Text style={detailStyles.descText}>{localIssue.description}</Text>
        </View>
      ) : null}

      {/* Photos */}
      <PhotoStrip urls={localIssue.photos} />

      {/* Admin status controls */}
      {isAdmin && (
        <View style={{ marginBottom: 16 }}>
            <Text style={detailStyles.sectionLabel}>{useLanguage().t("issues_update_status","Update Status")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["Open", "In Progress", "Resolved"].map((s) => {
              const ssc = STATUS_COLOR[s] || {};
              const isActive = localIssue.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => !statusLoading && handleStatusChange(s)}
                  style={[
                    detailStyles.statusBtn,
                    { backgroundColor: isActive ? ssc.bg : C.gray50, borderColor: isActive ? ssc.text + "50" : C.gray100 },
                  ]}
                >
                  {statusLoading && isActive
                    ? <Spinner size={12} color={ssc.text} />
                    : <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? ssc.text : C.gray500 }}>{s}</Text>
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Assigned vendor info */}
      {localIssue.assignedVendor?.name && (
        <View style={detailStyles.vendorBox}>
          <Text style={detailStyles.vendorLabel}>🔧 Assigned Vendor</Text>
          <Text style={detailStyles.vendorName}>{localIssue.assignedVendor.name}</Text>
          <Text style={detailStyles.vendorSub}>
            {localIssue.assignedVendor.phone}
            {localIssue.assignedVendor.note ? ` · ${localIssue.assignedVendor.note}` : ""}
          </Text>
        </View>
      )}

      {/* Assign vendor button (admin only) */}
      {isAdmin && (
            <TouchableOpacity
          onPress={() => {
            setVendorForm(localIssue.assignedVendor?.name
              ? { ...localIssue.assignedVendor }
              : EMPTY_VENDOR
            );
            setShowVendor(true);
          }}
          style={detailStyles.assignVendorBtn}
        >
          <Text style={detailStyles.assignVendorText}>
            🔧 {localIssue.assignedVendor?.name ? useLanguage().t("issues_change_vendor","Change Vendor") : useLanguage().t("issues_assign_vendor","Assign Vendor")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Comments */}
      <Text style={detailStyles.sectionLabel}>{useLanguage().t("issues_comments_label","Comments")} ({comments.length})</Text>
      {loadingDetail
        ? <Spinner size={20} />
        : comments.map((c) => (
          <View key={c._id} style={[detailStyles.commentBubble, c.isAdminReply && { borderLeftWidth: 3, borderLeftColor: C.teal }]}>
            <Text style={[detailStyles.commentAuthor, c.isAdminReply && { color: C.teal }]}>
              {c.author?.name || useLanguage().t("issues_unknown_user","User")}{c.isAdminReply ? useLanguage().t("issues_admin_reply"," · Admin") : ""} · {timeAgo(c.createdAt)}
            </Text>
            <Text style={detailStyles.commentBody}>{c.body || c.text}</Text>
          </View>
        ))
      }

      {/* Comment input */}
      <View style={detailStyles.commentInput}>
          <TextInput
          value={commentBody}
          onChangeText={setCommentBody}
          placeholder={useLanguage().t("issues_add_comment_ph","Add a comment…")}
          placeholderTextColor={C.gray300}
          style={detailStyles.textInput}
          onSubmitEditing={handleAddComment}
          returnKeyType="send"
        />
        <Btn onPress={handleAddComment} loading={commentLoading} small>{useLanguage().t("issues_send_btn","Send")}</Btn>
      </View>

      {/* Assign Vendor Modal (admin only) */}
      <Modal
        open={showVendor}
        onClose={() => { setShowVendor(false); setVendorForm(EMPTY_VENDOR); }}
        title={useLanguage().t("issues_assign_vendor_title","Assign to Vendor")}
      >
        <Input
          label={useLanguage().t("issues_label_vendor_name","Vendor Name *")}
          value={vendorForm.name}
          onChangeText={(v) => setVendorForm((p) => ({ ...p, name: v }))}
          placeholder={useLanguage().t("issues_ph_vendor_name","e.g. SpeedLift Services")}
        />
        <Input
          label={useLanguage().t("issues_label_vendor_phone","Vendor Phone *")}
          value={vendorForm.phone}
          onChangeText={(v) => setVendorForm((p) => ({ ...p, phone: v }))}
          placeholder={useLanguage().t("issues_ph_vendor_phone","+91 99887 76655")}
          keyboardType="phone-pad"
        />
        <Input
          label={useLanguage().t("issues_label_vendor_note","Note (optional)")}
          value={vendorForm.note}
          onChangeText={(v) => setVendorForm((p) => ({ ...p, note: v }))}
          placeholder={useLanguage().t("issues_ph_vendor_note","Visit scheduled for Friday 10 AM")}
          multiline
        />
        <Btn onPress={handleAssignVendor} loading={vendorLoading} style={{ width: "100%" }}>
          {useLanguage().t("issues_assign_vendor_btn","Assign Vendor")}
        </Btn>
      </Modal>
    </Modal>
  );
};

const detailStyles = StyleSheet.create({
  title:           { fontSize: 16, fontWeight: "800", color: C.navy, lineHeight: 22 },
  meta:            { fontSize: 11, color: C.gray500, marginTop: 3 },
  descBox:         { backgroundColor: C.gray50, borderRadius: 10, padding: 12, marginBottom: 14 },
  descText:        { fontSize: 13, color: C.gray700, lineHeight: 20 },
  sectionLabel:    { fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 8 },
  statusBtn:       { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1.5, alignItems: "center" },
  commentBubble:   { backgroundColor: C.gray50, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentAuthor:   { fontSize: 11, fontWeight: "700", color: C.gray700, marginBottom: 4 },
  commentBody:     { fontSize: 13, color: C.text },
  commentInput:    { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  textInput:       { flex: 1, borderWidth: 1.5, borderColor: C.gray100, borderRadius: 10, padding: 10, fontSize: 13, color: C.text, backgroundColor: "#fff" },
  // Vendor
  vendorBox:       { backgroundColor: C.teal + "10", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.teal + "25" },
  vendorLabel:     { fontSize: 10, fontWeight: "700", color: C.teal, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  vendorName:      { fontSize: 14, fontWeight: "700", color: C.navy, marginBottom: 2 },
  vendorSub:       { fontSize: 12, color: C.gray500 },
  assignVendorBtn: { borderWidth: 1.5, borderColor: C.teal + "40", borderRadius: 10, padding: 10, alignItems: "center", marginBottom: 16 },
  assignVendorText:{ fontSize: 13, fontWeight: "700", color: C.teal },
});

// ─── Main IssuesScreen ────────────────────────────────────────────────────────
export const IssuesScreen = () => {
  const { isAdmin, dataVersion } = useAuth();
  const toast       = useToast();
  const { t }       = useLanguage();

  const [issues,    setIssues]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState("All");
  const [selected,  setSelected]  = useState(null);
  const [showNew,   setShowNew]   = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoAssets, setPhotoAssets] = useState([]); // expo-image-picker assets

  const fetchIssues = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { sort: "-createdAt", limit: 50 };
      if (filter !== "All") params.status = filter;
      const res = await issuesApi.getAll(params);
      setIssues(res.data?.issues || []);
    } catch (e) {
      setError(e?.response?.data?.message || t("issues_load_failed","Failed to load issues."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchIssues(); }, [fetchIssues, dataVersion]);

  // FIX (bug #7): refresh on tab focus — issues change status/comments from
  // other devices (admin/resident) and should be current without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchIssues();
    }, [fetchIssues])
  );

  const handleCreate = async () => {
    const title = form.title.trim();
    setFormError("");
    if (!title) { setFormError(t("issues_title_required","Title is required.")); return; }
    if (title.length < 5) { setFormError(t("issues_title_min_length","Please enter a clear issue title with at least 5 characters.")); return; }
    setSubmitting(true);
    try {
      const res = await issuesApi.create({ ...form, title });
      const created = res.data.issue;

      // Upload photos sequentially (non-fatal — continue if one fails)
      for (const asset of photoAssets) {
        try { await issuesApi.uploadPhoto(created._id, asset); }
        catch { /* non-fatal */ }
      }

      setIssues((p) => [created, ...p]);
      setForm(EMPTY_FORM);
      setPhotoAssets([]);
      setShowNew(false);
      toast.success(useLanguage().t("issues_report_success","Issue reported!"));
    } catch (e) {
      setFormError(e?.response?.data?.message || useLanguage().t("issues_create_failed","Failed to create issue."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueUpdated = (updated) => {
    setIssues((p) => p.map((i) => i._id === updated._id ? updated : i));
    setSelected(updated);
  };

  const setF = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <ScreenHeader
        title={t("nav_issues", "Issues")}
        action={
          <Btn small onPress={() => setShowNew(true)}>{t("issues_report_btn","+ Report")}</Btn>
        }
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map(({ key, id }) => (
          <FilterPill
            key={key}
            label={t(id, key)}
            active={filter === key}
            onPress={() => setFilter(key)}
          />
        ))}
      </ScrollView>

      {/* List */}
      {loading
        ? <View style={styles.loadingWrap}><Spinner size={32} /></View>
        : error
          ? <ErrorState message={error} onRetry={fetchIssues} />
          : (
              <FlatList
              data={issues}
              keyExtractor={(i) => i._id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<EmptyState icon="✅" message={t("issues_empty","No issues found.")} />}
              renderItem={({ item }) => (
                <IssueCard issue={item} onPress={setSelected} />
              )}
              showsVerticalScrollIndicator={false}
            />
          )
      }

      {/* Detail modal */}
      <IssueDetailModal
        issue={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        isAdmin={isAdmin}
        onUpdated={handleIssueUpdated}
      />

      {/* New issue modal */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setPhotoAssets([]); setFormError(""); }} title={useLanguage().t("issues_new_modal_title","Report an Issue")}>
        {!!formError && (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}
        <Input
          label={useLanguage().t("issues_label_title","Issue Title *")}
          value={form.title}
          onChangeText={setF("title")}
          placeholder={useLanguage().t("issues_ph_title","e.g. Lift not working in Block A")}
        />
        <Input
          label={useLanguage().t("issues_label_description","Description")}
          value={form.description}
          onChangeText={setF("description")}
          placeholder={useLanguage().t("issues_ph_description","Describe the issue in detail…")}
          multiline
        />
        <ChipSelector
          label={t("issues_label_category","Category")}
          options={ISSUE_CATEGORIES}
          value={form.category}
          onChange={setF("category")}
        />
        <ChipSelector
          label={t("issues_label_priority","Priority")}
          options={PRIORITIES}
          value={form.priority}
          onChange={setF("priority")}
        />
        <ToggleRow
          label={useLanguage().t("issues_label_report_anonymous","Report Anonymously")}
          hint={useLanguage().t("issues_hint_report_anonymous","Your name and flat number will be hidden")}
          value={form.isAnonymous}
          onChange={setF("isAnonymous")}
        />
        <PhotoPickerRow
          assets={photoAssets}
          onAdd={(newAssets) => setPhotoAssets((p) => [...p, ...newAssets].slice(0, 5))}
          onRemove={(i) => setPhotoAssets((p) => p.filter((_, j) => j !== i))}
        />
        <Btn onPress={handleCreate} loading={submitting} style={{ marginTop: 4 }}>
          {useLanguage().t("issues_submit_btn","Submit Issue")}
        </Btn>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  filterRow:   { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row" },
  list:        { paddingHorizontal: 16, paddingBottom: 32 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Card
  cardRow:      { flexDirection: "row", alignItems: "flex-start" },
  catIcon:      { fontSize: 24, marginTop: 2 },
  issueTitle:   { fontSize: 14, fontWeight: "700", color: C.text, lineHeight: 20 },
  issueMeta:    { fontSize: 11, color: C.gray500, marginTop: 2, marginBottom: 6 },
  badgeRow:     { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  commentCount: { fontSize: 11, color: C.gray500, marginLeft: 8, marginTop: 4 },
  formError:    { backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FCA5A5" },
  formErrorText:{ fontSize: 13, color: "#B91C1C", fontWeight: "600", lineHeight: 18 }
})