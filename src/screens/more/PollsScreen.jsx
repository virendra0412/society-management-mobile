/**
 * screens/more/PollsScreen.jsx
 *
 * Converted from web ResourceScreens.jsx → React Native (Expo).
 * Features:
 *   • Vote on active polls with animated bar
 *   • View results in real time
 *   • Admin: create / close polls
 *   • Anonymous voting support
 */
import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { pollsApi } from "../../api/resources.api";
import { useAuth }  from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Btn, Card, EmptyState, ErrorState,
  Modal, Input, Spinner,
} from "../../components/ui";
import { C } from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── Poll Card ────────────────────────────────────────────────────────────────
const PollCard = ({ poll, isAdmin, onVote, onClose, voting, closeBusy }) => {
  const { t } = useLanguage();
  const max      = Math.max(...poll.options.map((o) => o.votes), 0);
  const isVoting = !!voting;

  return (
    <Card style={{ marginBottom: 14 }}>
      {/* Question + status */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.navy, flex: 1, marginRight: 8, lineHeight: 22 }}>
          {poll.question}
        </Text>
        {poll.isClosed && (
          <View style={{ backgroundColor: C.gray100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.gray500 }}>{t("polls_closed_badge", "Closed")}</Text>
          </View>
        )}
        {poll.myVote && !poll.isClosed && (
          <View style={{ backgroundColor: C.teal + "15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.teal }}>{t("polls_voted_badge", "✓ Voted")}</Text>
          </View>
        )}
      </View>

      {/* Options */}
      <View style={{ gap: 8 }}>
        {poll.options.map((opt) => {
          const pct      = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
          const isWinner = opt.votes === max && poll.totalVotes > 0;
          const canVote  = !poll.isClosed && !isVoting;

          return (
            <TouchableOpacity
              key={opt._id}
              onPress={() => canVote && onVote(poll._id, opt._id)}
              activeOpacity={canVote ? 0.75 : 1}
              style={[
                pc.option,
                isWinner && poll.totalVotes > 0 ? pc.optionWinner : pc.optionNormal,
              ]}
            >
              {/* Vote bar background */}
              <View style={[pc.bar, { width: `${pct}%`, backgroundColor: isWinner ? C.teal + "18" : C.gray50 }]} />
              {/* Foreground */}
              <View style={pc.optionContent}>
                <Text style={[pc.optionLabel, isWinner && poll.totalVotes > 0 ? { color: C.teal, fontWeight: "700" } : {}]}>
                  {opt.label}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {poll.totalVotes > 0 && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isWinner ? C.teal : C.gray500 }}>{pct}%</Text>
                  )}
                  {isVoting && <Spinner size={12} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
        <Text style={{ fontSize: 11, color: C.gray500, flex: 1 }}>
          {poll.totalVotes} {poll.totalVotes !== 1 ? t("polls_vote_count_plural", "votes") : t("polls_vote_count_singular", "vote")} ·{" "}
          {poll.isClosed ? t("polls_status_closed", "Poll closed") : t("polls_status_tap_to_vote", "Tap an option to vote")}
          {poll.closesAt && !poll.isClosed ? ` · Closes ${timeAgo(poll.closesAt)}` : ""}
        </Text>
        {isAdmin && !poll.isClosed && (
            <TouchableOpacity
              onPress={() => !closeBusy && onClose(poll._id)}
              disabled={!!closeBusy}
              style={{ flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: C.gray100, borderRadius: 7,
                paddingHorizontal: 10, paddingVertical: 4 }}
            >
              {closeBusy ? <Spinner size={10} /> : <Text style={{ fontSize: 10 }}>🔒</Text>}
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.gray600 }}>{t("polls_close_poll_btn", "Close Poll")}</Text>
            </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const pc = StyleSheet.create({
  option:        { borderRadius: 10, overflow: "hidden", borderWidth: 1.5, borderColor: C.gray100, position: "relative" },
  optionWinner:  { borderColor: C.teal },
  optionNormal:  {},
  bar:           { position: "absolute", top: 0, left: 0, bottom: 0 },
  optionContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",paddingHorizontal: 14, paddingVertical: 10 },
  optionLabel:   { fontSize: 14, color: C.text, fontWeight: "500" },
});

// ─── Create Poll Modal ────────────────────────────────────────────────────────
const CreatePollModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [question,   setQuestion]   = useState("");
  const [options,    setOptions]    = useState([{ label: "" }, { label: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setQuestion(""); setOptions([{ label: "" }, { label: "" }]); };

  const addOption    = () => setOptions((o) => [...o, { label: "" }]);
  const setOption    = (i, val) => setOptions((o) => { const n = [...o]; n[i] = { label: val }; return n; });
  const removeOption = (i) => setOptions((o) => o.filter((_, j) => j !== i));

  const handleCreate = async () => {
    if (!question.trim()) return toast.error(t("polls_question_required", "Question is required."));
    const opts = options.filter((o) => o.label.trim());
    if (opts.length < 2) return toast.error(t("polls_options_required", "At least 2 options are required."));
    setSubmitting(true);
    try {
      const res = await pollsApi.create({ question, options: opts });
      onCreated(res.data.poll);
      reset(); onClose();
      toast.success(t("polls_create_success", "Poll created."));
    } catch (e) {
      toast.error(e.response?.data?.message || t("polls_create_failed", "Failed to create poll."));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title={t("polls_new_modal_title", "Create a Poll")}>
      <Input
        label={t("polls_question_label", "Question *")}
        value={question}
        onChangeText={setQuestion}
        placeholder={t("polls_question_ph", "e.g. Should we add CCTV in parking?")}
      />

      <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 }}>{t("polls_options_label", "Options (min 2)")}</Text>
      {options.map((opt, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <TextInput
            value={opt.label}
            onChangeText={(v) => setOption(i, v)}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor={C.gray300}
            style={{
              flex: 1, borderWidth: 1.5, borderColor: C.gray100, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
              color: C.text, backgroundColor: C.gray50,
            }}
          />
          {options.length > 2 && (
            <TouchableOpacity
              onPress={() => removeOption(i)}
              style={{ backgroundColor: C.red + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 }}
            >
              <Text style={{ color: C.red, fontSize: 16, fontWeight: "700" }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {options.length < 6 && (
        <TouchableOpacity
          onPress={addOption}
          style={{
            borderWidth: 1, borderStyle: "dashed", borderColor: C.teal,
            borderRadius: 8, paddingVertical: 8, alignItems: "center", marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.teal }}>{t("polls_add_option", "+ Add option")}</Text>
        </TouchableOpacity>
      )}

      <Btn onPress={handleCreate} loading={submitting} style={{ width: "100%" }}>{t("polls_create_btn_submit", "Create Poll")}</Btn>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const PollsScreen = ({ navigation }) => {
  const { isAdmin, dataVersion } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();

  const [polls,     setPolls]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showNew,   setShowNew]   = useState(false);
  const [voting,    setVoting]    = useState({});   // pollId → bool
  const [closeBusy, setCloseBusy] = useState({});   // pollId → bool

  const fetchPolls = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pollsApi.getAll();
      setPolls(res.data?.polls || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load polls.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      fetchPolls();
    }, [fetchPolls])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("polls_header_title", "Polls & Voting"),
      headerRight: isAdmin
        ? () => (
            <TouchableOpacity
              onPress={() => setShowNew(true)}
              style={{ backgroundColor: C.teal + "15", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.teal }}>
                {t("polls_create_btn", "+ Create")}
              </Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, isAdmin, setShowNew, t]);

  const handleVote = async (pollId, optionId) => {
    if (voting[pollId]) return;
    // Check if user already voted in this poll (client-side, avoids needless API call)
    const poll = polls.find((p) => p._id === pollId);
    if (poll?.myVote) {
      toast.info(t("polls_already_voted", "You have already voted in this poll."));
      return;
    }
    setVoting((v) => ({ ...v, [pollId]: true }));
    try {
      const res = await pollsApi.vote(pollId, { optionId });
      setPolls((p) => p.map((po) => po._id === pollId ? res.data.poll : po));
      toast.success(t("polls_vote_success", "Vote recorded!"));
    } catch (e) {
      const code = e.response?.data?.code;
      const message = e.response?.data?.message || "";
      if (code === "ALREADY_VOTED" || /already voted/i.test(message)) toast.info(t("polls_already_voted", "You have already voted in this poll."));
      else toast.error(message || t("polls_vote_failed", "Voting failed."));
    } finally { setVoting((v) => ({ ...v, [pollId]: false })); }
  };

  const handleClosePoll = async (pollId) => {
    if (closeBusy[pollId]) return;
    Alert.alert(
      t("polls_close_confirm_title", "Close Poll"),
      t("polls_close_confirm_msg", "Are you sure you want to close this poll? Residents will no longer be able to vote."),
      [
        { text: t("btn_cancel", "Cancel"), style: "cancel" },
        {
          text: t("polls_close_poll_btn", "Close Poll"), style: "destructive",
          onPress: async () => {
            setCloseBusy((b) => ({ ...b, [pollId]: true }));
            try {
              await pollsApi.close(pollId);
              setPolls((p) => p.map((poll) => poll._id === pollId ? { ...poll, isClosed: true } : poll));
              toast.success(t("polls_close_success", "Poll closed."));
            } catch (e) {
              toast.error(e.response?.data?.message || t("polls_close_failed", "Failed to close poll."));
            } finally { setCloseBusy((b) => ({ ...b, [pollId]: false })); }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Spinner size={32} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPolls} />
      ) : polls.length === 0 ? (
        <EmptyState icon="🗳️" message={t("polls_empty", "No polls yet.")} />
      ) : (
        <FlatList
          data={polls}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PollCard
              poll={item}
              isAdmin={isAdmin}
              voting={voting[item._id]}
              closeBusy={closeBusy[item._id]}
              onVote={handleVote}
              onClose={handleClosePoll}
            />
          )}
        />
      )}

      <CreatePollModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(poll) => setPolls((p) => [poll, ...p])}
      />
    </SafeAreaView>
  );
};