import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Linking, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { helpApi }     from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner,
} from "../../components/ui";
import { C, HELP_CAT_ICON, HELP_CATEGORIES } from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

const ALL_CATS = ["All", ...HELP_CATEGORIES];

// ─── Category icon strip ──────────────────────────────────────────────────────
const CatStrip = ({ active, onChange }) => {
  const { t } = useLanguage();
  return (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ flexGrow: 0, flexShrink: 0 }}
    contentContainerStyle={strip.row}
  >
    {ALL_CATS.map((c) => (
      <TouchableOpacity
        key={c}
        onPress={() => onChange(c)}
        activeOpacity={0.75}
        style={[strip.item, active === c && strip.itemActive]}
      >
        <Text style={strip.icon}>{c === "All" ? "🔍" : HELP_CAT_ICON[c]}</Text>
        <Text style={[strip.label, active === c && strip.labelActive]}>
          {c === "All" ? t("help_filter_all","All") : t(`help_cat_${c}`, c)}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);};

const strip = StyleSheet.create({
  row:        { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  item:       { width: 56, alignItems: "center", gap: 4 },
  itemActive: {},
  icon:       { fontSize: 24, width: 46, height: 46, textAlign: "center", lineHeight: 46,
                borderRadius: 12, backgroundColor: C.amber + "18", overflow: "hidden" },
  label:      { fontSize: 10, color: C.gray500, fontWeight: "600", textAlign: "center" },
  labelActive:{ color: C.amber },
});

// ─── Post card ────────────────────────────────────────────────────────────────
const PostCard = ({ item, onPress, t }) => (
  <Card onPress={() => onPress(item)} style={pc.card}>
    <View style={pc.row}>
      <View style={pc.iconBox}>
        <Text style={pc.catIcon}>{HELP_CAT_ICON[item.category] || "🤝"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={pc.titleRow}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          {item.isClosed && (
            <View style={pc.closedBadge}>
              <Text style={pc.closedText}>{t("help_closed_badge", "Closed")}</Text>
            </View>
          )}
        </View>
        {!!item.description && (
          <Text style={pc.desc} numberOfLines={1}>{item.description}</Text>
        )}
        <View style={pc.meta}>
          <Text style={pc.metaText}>
            {item.flat || item.author?.flat} · {timeAgo(item.createdAt)}
          </Text>
          <Text style={pc.replyCount}>
            💬 {item.replyCount ?? item.replies?.length ?? 0}
          </Text>
        </View>
      </View>
    </View>
  </Card>
);

const pc = StyleSheet.create({
  card:        { marginBottom: 10 },
  row:         { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  iconBox:     { width: 40, height: 40, borderRadius: 10, backgroundColor: C.amber + "18",
                 alignItems: "center", justifyContent: "center" },
  catIcon:     { fontSize: 20 },
  titleRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  title:       { flex: 1, fontSize: 14, fontWeight: "700", color: C.text, lineHeight: 20 },
  closedBadge: { backgroundColor: C.gray100, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  closedText:  { fontSize: 10, fontWeight: "700", color: C.gray500 },
  desc:        { fontSize: 12, color: C.gray500, marginBottom: 6 },
  meta:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaText:    { fontSize: 11, color: C.gray500 },
  replyCount:  { fontSize: 11, color: C.teal, fontWeight: "600" },
});

// ─── Reply row ────────────────────────────────────────────────────────────────
const ReplyRow = ({ r, userId, onUpvote, upvoting }) => {
  const count    = r.upvotes?.length ?? 0;
  const iVoted   = r.upvotes?.some((id) => (id?._id || id)?.toString() === userId?.toString());
  const isBusy   = !!upvoting[r._id];

  return (
    <View style={rr.wrap}>
      <View style={rr.header}>
        <View>
          <Text style={rr.name}>{r.author?.name || "User"}</Text>
          <Text style={rr.time}>{timeAgo(r.createdAt)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onUpvote(r._id)}
          disabled={isBusy}
          activeOpacity={0.75}
          style={[rr.upvoteBtn, iVoted && rr.upvoteBtnActive]}
        >
          {isBusy
            ? <Spinner size={12} color={iVoted ? C.teal : C.gray500} />
            : <Text style={[rr.upvoteText, iVoted && rr.upvoteTextActive]}>▲ {count}</Text>
          }
        </TouchableOpacity>
      </View>
      <Text style={rr.body}>{r.body}</Text>
      {r.isVendorContact && r.vendorPhone && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${r.vendorPhone}`)}
          style={rr.callBtn}
          activeOpacity={0.75}
        >
          <Text style={rr.callText}>📞 {r.vendorPhone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const rr = StyleSheet.create({
  wrap:          { backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 10 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  name:          { fontSize: 12, fontWeight: "700", color: C.gray700 },
  time:          { fontSize: 10, color: C.gray300, marginTop: 1 },
  upvoteBtn:     { flexDirection: "row", alignItems: "center", backgroundColor: C.gray100,
                   borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
                   borderWidth: 1.5, borderColor: C.gray100 },
  upvoteBtnActive:{ backgroundColor: C.teal + "15", borderColor: C.teal },
  upvoteText:    { fontSize: 12, fontWeight: "700", color: C.gray500 },
  upvoteTextActive:{ color: C.teal },
  body:          { fontSize: 13, color: C.text, lineHeight: 20 },
  callBtn:       { marginTop: 8, backgroundColor: C.green + "15", borderRadius: 8,
                   paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  callText:      { fontSize: 12, fontWeight: "700", color: C.green },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export const HelpScreen = ({ navigation }) => {
  const { user, isAdmin } = useAuth();
  const toast  = useToast();
  const { t }  = useLanguage();

  const [posts,            setPosts]            = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [catFilter,        setCatFilter]        = useState("All");
  const [detailPost,       setDetailPost]       = useState(null);
  const [detailLoad,       setDetailLoad]       = useState(false);
  const [replyBody,        setReplyBody]        = useState("");
  const [replyIsVendor,    setReplyIsVendor]    = useState(false);
  const [replyVendorPhone, setReplyVendorPhone] = useState("");
  const [replyLoading,     setReplyLoading]     = useState(false);
  const [upvoting,         setUpvoting]         = useState({});
  const [closing,          setClosing]          = useState(false);
  const [showNew,          setShowNew]          = useState(false);
  const [form,             setForm]             = useState({ title: "", description: "", category: "Plumber" });
  const [submitting,       setSubmitting]       = useState(false);
  const [selectedCat,      setSelectedCat]      = useState("Plumber");

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { sort: "-createdAt", limit: 50 };
      if (catFilter !== "All") params.category = catFilter;
      const res = await helpApi.getAll(params);
      setPosts(res.data?.posts || []);
    } catch (e) {
      setError(e.response?.data?.message || t("help_load_failed", "Failed to load help posts."));
    } finally {
      setLoading(false);
    }
  }, [catFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const openDetail = async (post) => {
    setDetailPost(post);
    setDetailLoad(true);
    setReplyBody(""); setReplyIsVendor(false); setReplyVendorPhone("");
    try {
      const res = await helpApi.getOne(post._id);
      setDetailPost(res.data?.post);
    } catch { /* use list version */ }
    finally { setDetailLoad(false); }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error(t("help_title_required", "Title is required."));
    setSubmitting(true);
    try {
      const res = await helpApi.create({ ...form, category: selectedCat });
      setPosts((p) => [res.data.post, ...p]);
      setForm({ title: "", description: "", category: "Plumber" });
      setSelectedCat("Plumber");
      setShowNew(false);
      toast.success(t("help_post_success", "Help request posted."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("help_post_failed", "Failed to post."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !detailPost) return;
    if (replyIsVendor && !replyVendorPhone.trim()) return toast.error(t("help_vendor_phone_required", "Enter vendor phone number."));
    setReplyLoading(true);
    try {
      const payload = { body: replyBody.trim() };
      if (replyIsVendor) { payload.isVendorContact = true; payload.vendorPhone = replyVendorPhone.trim(); }
      const res = await helpApi.addReply(detailPost._id, payload);
      setDetailPost((p) => ({ ...p, replies: res.data.replies }));
      setReplyBody(""); setReplyIsVendor(false); setReplyVendorPhone("");
      fetchPosts();
      toast.success(t("help_reply_success", "Reply posted."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("help_reply_failed", "Failed to reply."));
    } finally {
      setReplyLoading(false);
    }
  };

  const handleUpvote = async (replyId) => {
    if (!detailPost || upvoting[replyId]) return;
    setUpvoting((u) => ({ ...u, [replyId]: true }));
    try {
      const res = await helpApi.upvoteReply(detailPost._id, replyId);
      const updatedPost = res.data?.post;
      const updatedReplies = updatedPost?.replies || res.data?.replies;
      if (updatedReplies) {
        setDetailPost((prev) => ({ ...(updatedPost || prev), replies: updatedReplies }));
        if (updatedPost) setPosts((p) => p.map((h) => h._id === updatedPost._id ? updatedPost : h));
        return;
      }
      setDetailPost((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.map((r) => {
            if (r._id !== replyId) return r;
            const uid = user._id;
            const alreadyVoted = r.upvotes?.some((id) => (id?._id || id)?.toString() === uid?.toString());
            const newUpvotes = alreadyVoted
              ? r.upvotes.filter((id) => (id?._id || id)?.toString() !== uid?.toString())
              : [...(r.upvotes || []), uid];
            return { ...r, upvotes: newUpvotes };
          }),
        };
      });
    } catch (e) {
      toast.error(e.response?.data?.message || t("help_upvote_failed", "Failed."));
    } finally {
      setUpvoting((u) => ({ ...u, [replyId]: false }));
    }
  };

  const handleClose = async () => {
    if (!detailPost) return;
    setClosing(true);
    try {
      await helpApi.close(detailPost._id);
      setDetailPost((p) => ({ ...p, isClosed: true }));
      setPosts((p) => p.map((h) => h._id === detailPost._id ? { ...h, isClosed: true } : h));
      toast.success(t("help_close_success", "Help post closed."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("help_close_failed", "Failed."));
    } finally {
      setClosing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <View style={s.actionRow}>
        <Btn small onPress={() => setShowNew(true)} style={s.askBtn}>{t("help_ask_btn", "+ Ask")}</Btn>
      </View>

      <CatStrip active={catFilter} onChange={setCatFilter} />

      {/* List */}
      {loading ? (
        <View style={s.center}><Spinner size={32} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPosts} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(i) => i._id}
          renderItem={({ item }) => <PostCard item={item} onPress={openDetail} t={t} />}
          ListEmptyComponent={<EmptyState icon="🤝" message={t("help_empty", "No help posts yet. Be the first to ask!")} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Detail sheet ────────────────────────────────────────────────────── */}
      <Modal
        open={!!detailPost}
        onClose={() => { setDetailPost(null); setReplyBody(""); setReplyIsVendor(false); setReplyVendorPhone(""); }}
        title={t("help_detail_title", "Help Post")}
      >
        {detailPost && (
          <View>
            {/* Post header */}
            <View style={d.row}>
              <View style={d.iconBox}>
                <Text style={d.catIcon}>{HELP_CAT_ICON[detailPost.category] || "🤝"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={d.title}>{detailPost.title}</Text>
                <Text style={d.meta}>
                  {detailPost.flat || detailPost.author?.flat} · {timeAgo(detailPost.createdAt)}
                  {detailPost.isClosed ? `  [${t("help_closed_badge", "Closed")}]` : ""}
                </Text>
              </View>
            </View>

            {!!detailPost.description && (
              <View style={d.descBox}>
                <Text style={d.desc}>{detailPost.description}</Text>
              </View>
            )}

            {/* Close button — author or admin */}
            {!detailPost.isClosed && (detailPost.author?._id === user?._id || isAdmin) && (
              <Btn variant="ghost" loading={closing} onPress={handleClose} style={d.closeBtn}>
                ✓ {t("help_close_btn", "Mark as Resolved")}
              </Btn>
            )}

            {/* Replies */}
            <Text style={d.repliesLabel}>
              {detailLoad ? t("help_replies_loading", "Loading replies…") : `${t("help_replies_label", "Replies")} (${detailPost.replies?.length ?? 0})`}
            </Text>

            {detailLoad && <View style={{ alignItems: "center", paddingVertical: 16 }}><Spinner /></View>}

            {!detailLoad && (detailPost.replies || []).length === 0 && (
              <Text style={d.noReplies}>{t("help_no_replies", "No replies yet. Be the first!")}</Text>
            )}

            {!detailLoad && (detailPost.replies || []).map((r) => (
              <ReplyRow
                key={r._id}
                r={r}
                userId={user?._id}
                onUpvote={handleUpvote}
                upvoting={upvoting}
              />
            ))}

            {/* Reply input */}
            {!detailPost.isClosed && (
              <View style={d.replySection}>
                {/* Vendor contact toggle */}
                <TouchableOpacity
                  onPress={() => { setReplyIsVendor((v) => !v); setReplyVendorPhone(""); }}
                  activeOpacity={0.75}
                  style={[d.vendorToggle, replyIsVendor && d.vendorToggleOn]}
                >
                  <Text style={[d.vendorToggleText, replyIsVendor && d.vendorToggleTextOn]}>
                    📞 {replyIsVendor ? t("help_vendor_toggle_on", "Vendor contact (on)") : t("help_vendor_toggle_off", "Add vendor contact?")}
                  </Text>
                </TouchableOpacity>

                {replyIsVendor && (
                  <Input
                    value={replyVendorPhone}
                    onChangeText={setReplyVendorPhone}
                    placeholder={t("help_vendor_phone_ph", "Vendor phone number")}
                    keyboardType="phone-pad"
                    style={{ marginBottom: 8 }}
                  />
                )}

                <View style={d.replyRow}>
                  <Input
                    value={replyBody}
                    onChangeText={setReplyBody}
                    placeholder={replyIsVendor ? t("help_reply_ph_vendor", "Describe this vendor…") : t("help_reply_ph", "Write a reply...")}
                    style={{ flex: 1, marginBottom: 0, marginRight: 8 }}
                  />
                  <Btn small loading={replyLoading} onPress={handleReply}>{t("help_reply_btn", "Reply")}</Btn>
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* ── New post modal ──────────────────────────────────────────────────── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title={t("help_new_modal_title", "Ask for Help")}>
        <Input
          label={t("help_title_label", "What do you need? *")}
          value={form.title}
          onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          placeholder={t("help_title_ph", "e.g. Need a good plumber urgently")}
        />
        <Input
          label={t("help_desc_label", "More details")}
          value={form.description}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          placeholder={t("help_desc_ph", "Describe your requirement…")}
          multiline
        />
        {/* Category chips */}
        <Text style={s.chipLabel}>{t("help_category_label", "Category")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {HELP_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setSelectedCat(c)}
              activeOpacity={0.75}
              style={[s.chip, selectedCat === c && s.chipActive]}
            >
              <Text style={[s.chipText, selectedCat === c && s.chipTextActive]}>
                {HELP_CAT_ICON[c]} {t(`help_cat_${c}`, c)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Btn onPress={handleCreate} loading={submitting} style={{ width: "100%" }}>
          {t("help_post_btn", "Post Request")}
        </Btn>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Detail styles ────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  row:           { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  iconBox:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.amber + "18",
                   alignItems: "center", justifyContent: "center" },
  catIcon:       { fontSize: 22 },
  title:         { fontSize: 15, fontWeight: "800", color: C.navy, lineHeight: 22, marginBottom: 3 },
  meta:          { fontSize: 12, color: C.gray500 },
  descBox:       { backgroundColor: C.gray50, borderRadius: 10, padding: 12, marginBottom: 14 },
  desc:          { fontSize: 13, color: C.gray700, lineHeight: 20 },
  closeBtn:      { marginBottom: 14 },
  repliesLabel:  { fontSize: 13, fontWeight: "700", color: C.gray700, marginBottom: 10 },
  noReplies:     { fontSize: 13, color: C.gray500, textAlign: "center", paddingVertical: 12 },
  replySection:  { marginTop: 4 },
  vendorToggle:  { backgroundColor: C.gray100, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                   alignSelf: "flex-start", marginBottom: 8,
                   borderWidth: 1, borderColor: C.gray100 },
  vendorToggleOn:{ backgroundColor: C.green + "15", borderColor: C.green + "40" },
  vendorToggleText:  { fontSize: 11, fontWeight: "700", color: C.gray500 },
  vendorToggleTextOn:{ color: C.green },
  replyRow:      { flexDirection: "row", alignItems: "flex-end", gap: 8 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  headerRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back:        { marginRight: 10 },
  backTxt:     { fontSize: 20, color: C.teal, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: C.navy },
  actionRow:   { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, alignItems: "flex-end" },
  askBtn:      { backgroundColor: C.amber },
  list:        { paddingHorizontal: 16, paddingBottom: 24 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  chipLabel:   { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100, marginRight: 8, backgroundColor: "#fff" },
  chipActive:  { backgroundColor: C.teal, borderColor: C.teal },
  chipText:    { fontSize: 12, fontWeight: "600", color: C.gray700 },
  chipTextActive:{ color: "#fff" },
});