/**
 * screens/parking/ParkingScreen.jsx
 * All parking sub-components consolidated into one file.
 *
 * Resident:  Overview (summary) · All Slots · My Requests
 * Admin:     + All Requests tab
 *
 * Covers all 11 API calls:
 *   getSummary, getSlots, submitRequest, getMyRequests, cancelRequest,
 *   getAllRequests, approveRequest, rejectRequest, createSlot,
 *   bulkCreateSlots, releaseSlot
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { parkingApi }  from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner,
} from "../../components/ui";
import {
  C,
  SLOT_TYPES, SLOT_TYPE_ICON, SLOT_TYPE_COLOR,
  SLOT_STATUS_COLOR, REQUEST_STATUS_COLOR,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";

// ─── helpers ──────────────────────────────────────────────────────────────────
const slotColor  = (type) => SLOT_TYPE_COLOR[type]  || C.teal;
const slotIcon   = (type) => SLOT_TYPE_ICON[type]   || "🅿️";
const reqSC      = (status) => REQUEST_STATUS_COLOR[status] || {};
const slotSC     = (status) => SLOT_STATUS_COLOR[status]    || {};

// ═══════════════════════════════════════════════════════
// OVERVIEW — slot summary chips
// ═══════════════════════════════════════════════════════
const SlotSummary = ({ items, loading, t }) => {
  if (loading) return (
    <View style={ss.row}>
      {[1, 2, 3].map(k => <View key={k} style={ss.skeleton} />)}
    </View>
  );
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
      <View style={ss.row}>
        {items.map((s) => {
          const color = slotColor(s._id);
          const pct   = s.total > 0 ? s.assigned / s.total : 0;
          const barC  = pct >= 1 ? C.red : pct > 0.7 ? C.amber : C.green;
          return (
            <View key={s._id} style={[ss.chip, { backgroundColor: color + "12", borderColor: color + "30" }]}>
              <Text style={{ fontSize: 22, marginBottom: 2 }}>{slotIcon(s._id)}</Text>
              <Text style={[ss.chipType, { color }]}>{s._id}</Text>
              <Text style={[ss.chipVal,  { color }]}>{s.available}</Text>
              <Text style={ss.chipSub}>
                {t("parking_of_total_free", "of {total} free").replace("{total}", s.total)}
              </Text>
              <View style={ss.fillTrack}>
                <View style={[ss.fillBar, { width: `${Math.round(pct * 100)}%`, backgroundColor: barC }]} />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
const ss = StyleSheet.create({
  row:      { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  skeleton: { width: 94, height: 86, borderRadius: 14, backgroundColor: C.gray100 },
  chip:     { width: 100, borderRadius: 14, borderWidth: 1.5, padding: 10, alignItems: "center" },
  chipType: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  chipVal:  { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  chipSub:  { fontSize: 10, color: C.gray500, marginTop: 1 },
  fillTrack:{ height: 4, borderRadius: 2, backgroundColor: C.gray100, width: "100%", overflow: "hidden", marginTop: 6 },
  fillBar:  { height: 4, borderRadius: 2 },
});

// ═══════════════════════════════════════════════════════
// ALL SLOTS LIST
// ═══════════════════════════════════════════════════════
const SlotCard = ({ slot, isAdmin, onReleased }) => {
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const { t }  = useLanguage();
  const color = slotColor(slot.type);
  const sc    = slotSC(slot.status);

  const doRelease = async () => {
    setBusy(true);
    try {
      await parkingApi.releaseSlot(slot._id);
      toast.success(
        t("parking_released", "Slot {slot} released.").replace("{slot}", slot.slotNumber)
      );
      onReleased?.(slot._id);
    } catch (e) {
      toast.error(e.response?.data?.message || t("parking_release_failed", "Release failed."));
    } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <Card style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={[sc2.iconBox, { backgroundColor: color + "15" }]}>
          <Text style={{ fontSize: 18 }}>{slotIcon(slot.type)}</Text>
          <Text style={{ fontSize: 9, fontWeight: "800", color }}>{slot.slotNumber}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>
              {t("parking_slot_label", "Slot")} {slot.slotNumber}
            </Text>
            <Badge label={slot.type} bg={color + "15"} text={color} />
          </View>
          {slot.zone        && <Text style={sc2.meta}>{t("parking_zone_label", "Zone")} {slot.zone}</Text>}
          {slot.assignedFlat && (
            <Text style={sc2.meta}>
              {t("parking_flat_label", "Flat")} {slot.assignedFlat} · {slot.vehicleNumber}
            </Text>
          )}
          {slot.note        && <Text style={sc2.meta}>{slot.note}</Text>}
        </View>
        <Badge label={slot.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
      </View>

      {/* Admin release strip */}
      {isAdmin && slot.status === "assigned" && (
        <View style={[sc2.releaseStrip, confirm && { backgroundColor: C.red + "08" }]}>
          {confirm ? (
            <>
              <Text style={{ fontSize: 11, color: C.red, fontWeight: "600", flex: 1 }}>
                {t("parking_release_confirm_msg", "Release and unassign?")}
              </Text>
              <TouchableOpacity onPress={() => setConfirm(false)} style={sc2.releaseGhost}>
                <Text style={{ fontSize: 11, color: C.gray500, fontWeight: "600" }}>
                  {t("parking_release_cancel", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doRelease}
                style={[sc2.releaseGhost, { borderColor: C.red + "40", backgroundColor: C.red + "10" }]}
              >
                {busy
                  ? <Spinner size={11} />
                  : <Text style={{ fontSize: 11, color: C.red, fontWeight: "700" }}>
                      {t("parking_release_confirm_btn", "Confirm")}
                    </Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={sc2.meta}>
                {t("parking_assigned_to_flat", "Assigned to Flat")} {slot.assignedFlat}
              </Text>
              <TouchableOpacity onPress={() => setConfirm(true)} style={sc2.releaseGhost}>
                <Text style={{ fontSize: 11, color: C.gray500, fontWeight: "700" }}>
                  {t("parking_release_btn", "↩ Release")}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Card>
  );
};
const sc2 = StyleSheet.create({
  iconBox:     { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  meta:        { fontSize: 11, color: C.gray500, marginTop: 1 },
  releaseStrip:{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: C.gray100, marginTop: 8, paddingTop: 8, gap: 6 },
  releaseGhost:{ borderWidth: 1, borderColor: C.gray200, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
});

const SlotsTab = ({ isAdmin }) => {
  const { t }  = useLanguage();
  const [slots,      setSlots]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getSlots();
      setSlots(res.data?.slots || []);
    } catch {
      setError(t("parking_load_slots_failed", "Failed to load slots."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = typeFilter === "All" ? slots : slots.filter(s => s.type === typeFilter);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ps.filterScroller}
        contentContainerStyle={ps.filterContent}
      >
        {["All", ...SLOT_TYPES].map(tp => (
          <FilterPill key={tp} label={tp} active={typeFilter === tp} onPress={() => setTypeFilter(tp)} />
        ))}
      </ScrollView>
      {loading
        ? <View style={util.center}><Spinner size={28} /></View>
        : error
        ? <View style={util.center}><ErrorState message={error} onRetry={load} /></View>
        : visible.length === 0
        ? <View style={util.center}><EmptyState icon="🅿️" message={t("parking_no_slots", "No slots found.")} /></View>
        : <FlatList
            data={visible}
            keyExtractor={s => s._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            onReleased={load}
            renderItem={({ item }) => (
              <SlotCard
                slot={item}
                isAdmin={isAdmin}
                onReleased={(id) => {
                  setSlots(p => p.map(s => s._id === id ? { ...s, status: "available", assignedFlat: null, vehicleNumber: null } : s));
                }}
              />
            )}
          />
      }
    </View>
  );
};

// ═══════════════════════════════════════════════════════
// MY REQUESTS (resident)
// ═══════════════════════════════════════════════════════
const RequestCard = ({ req, onCancelled }) => {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t }  = useLanguage();
  const color = slotColor(req.slotType);
  const sc    = reqSC(req.status);

  const cancel = async () => {
    setBusy(true);
    try {
      await parkingApi.cancelRequest(req._id);
      toast.success(t("parking_request_cancelled", "Request cancelled."));
      onCancelled?.(req._id);
    } catch (e) {
      toast.error(e.response?.data?.message || t("parking_cancel_failed", "Cancel failed."));
    } finally { setBusy(false); }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={[rc.iconBox, { backgroundColor: color + "15" }]}>
          <Text style={{ fontSize: 20 }}>{slotIcon(req.slotType)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>
              {t("parking_slot_type_label", "{type} Slot").replace("{type}", req.slotType)}
            </Text>
            <Badge label={req.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
          </View>
          <Text style={rc.meta}>{req.vehicleNumber}</Text>
          {req.vehicleDescription && <Text style={rc.meta}>{req.vehicleDescription}</Text>}
          {req.adminNote && <Text style={[rc.meta, { color: C.red }]}>📋 {req.adminNote}</Text>}
          <Text style={rc.time}>{timeAgo(req.createdAt)}</Text>
        </View>
      </View>
      {req.status === "pending" && (
        <Btn variant="danger" small loading={busy} onPress={cancel} style={{ marginTop: 10 }}>
          {t("parking_cancel_request_btn", "Cancel Request")}
        </Btn>
      )}
    </Card>
  );
};
const rc = StyleSheet.create({
  iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  meta:    { fontSize: 12, color: C.gray500, marginTop: 2 },
  time:    { fontSize: 11, color: C.gray300, marginTop: 4 },
});

const MyRequestsTab = () => {
  const { t }  = useLanguage();
  const [reqs,    setReqs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getMyRequests();
      setReqs(res.data?.requests || []);
    } catch {
      setError(t("parking_load_requests_failed", "Failed to load requests."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={util.flex1}><View style={util.center}><Spinner size={28} /></View></View>;
  if (error)   return <View style={util.flex1}><View style={util.center}><ErrorState message={error} onRetry={load} /></View></View>;
  if (!reqs.length) return (
    <View style={util.flex1}>
      <View style={util.center}>
        <EmptyState icon="🚗" message={t("parking_no_requests", "No parking requests yet.")} />
      </View>
    </View>
  );

  return (
    <View style={util.flex1}>
      <FlatList
        data={reqs}
        keyExtractor={r => r._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RequestCard req={item} onCancelled={(id) => setReqs(p => p.filter(r => r._id !== id))} />
        )}
      />
    </View>
  );
};

// ═══════════════════════════════════════════════════════
// SUBMIT REQUEST MODAL
// ═══════════════════════════════════════════════════════
const RequestModal = ({ open, onClose, onSubmitted, summary }) => {
  const toast  = useToast();
  const { t }  = useLanguage();
  const [form, setForm] = useState({ slotType: "4W", vehicleNumber: "", vehicleDescription: "", note: "" });
  const [busy, setBusy] = useState(false);

  const avail = summary.find(s => s._id === form.slotType)?.available ?? null;

  const submit = async () => {
    if (!form.vehicleNumber.trim()) {
      return toast.error(t("parking_vehicle_required", "Vehicle number is required."));
    }
    setBusy(true);
    try {
      const res = await parkingApi.submitRequest(form);
      toast.success(t("parking_request_submitted", "Request submitted!"));
      onSubmitted(res.data?.request);
      onClose();
      setForm({ slotType: "4W", vehicleNumber: "", vehicleDescription: "", note: "" });
    } catch (e) {
      toast.error(e.response?.data?.message || t("parking_submit_failed", "Submission failed."));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("parking_request_modal_title", "Request a Parking Slot")}>
      <Text style={rm.label}>{t("parking_slot_type_picker", "Slot Type *")}</Text>
      <View style={rm.typeRow}>
        {SLOT_TYPES.filter(tp => !["Visitor", "Reserved"].includes(tp)).map(tp => {
          const color = slotColor(tp);
          const on    = form.slotType === tp;
          return (
            <TouchableOpacity
              key={tp}
              onPress={() => setForm(p => ({ ...p, slotType: tp }))}
              style={[rm.typeBtn, { backgroundColor: on ? color : color + "15", borderColor: on ? color : color + "30" }]}
            >
              <Text style={{ fontSize: 18 }}>{slotIcon(tp)}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: on ? "#fff" : color }}>{tp}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {avail !== null && (
        <View style={[rm.availBadge, { backgroundColor: avail === 0 ? C.red + "12" : C.green + "12" }]}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: avail === 0 ? C.red : C.green }}>
            {avail === 0
              ? t("parking_no_slots_queued", "⚠️ No slots available — request will be queued")
              : t("parking_slots_available", "✅ {count} slot(s) available").replace("{count}", avail)
            }
          </Text>
        </View>
      )}

      <Input
        label={t("parking_vehicle_number_label", "Vehicle Number *")}
        value={form.vehicleNumber}
        onChangeText={v => setForm(p => ({ ...p, vehicleNumber: v }))}
        placeholder={t("parking_vehicle_number_ph", "e.g. GJ01AB1234")}
      />
      <Input
        label={t("parking_vehicle_desc_label", "Vehicle Description")}
        value={form.vehicleDescription}
        onChangeText={v => setForm(p => ({ ...p, vehicleDescription: v }))}
        placeholder={t("parking_vehicle_desc_ph", "e.g. White Hyundai Creta")}
      />
      <Input
        label={t("parking_note_label", "Note (optional)")}
        value={form.note}
        onChangeText={v => setForm(p => ({ ...p, note: v }))}
        placeholder={t("parking_note_ph", "Any special requirements…")}
        multiline
      />
      <Btn onPress={submit} loading={busy} style={{ width: "100%" }}>
        {t("parking_submit_btn", "Submit Request")}
      </Btn>
    </Modal>
  );
};
const rm = StyleSheet.create({
  label:           { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 },
  typeRow:         { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeBtn:         { flex: 1, borderRadius: 10, borderWidth: 1.5, alignItems: "center", padding: 10, gap: 4 },
  availBadge:      { borderRadius: 8, padding: 10, marginBottom: 14 },
  // mode toggle for CreateSlotModal
  modeToggle:      { flexDirection: "row", backgroundColor: C.gray50, borderRadius: 10, padding: 3, marginBottom: 18 },
  modeBtn:         { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeBtnActive:   { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  modeBtnText:     { fontSize: 12, fontWeight: "700", color: C.gray500 },
  modeBtnTextActive:{ color: C.navy },
});

// ═══════════════════════════════════════════════════════
// ADMIN — ALL REQUESTS
// ═══════════════════════════════════════════════════════
const AdminRequestsTab = ({ slots }) => {
  const toast  = useToast();
  const { t }  = useLanguage();
  const [reqs,         setReqs]         = useState([]);
  const [filter,       setFilter]       = useState("all");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [rejectNote,   setRejectNote]   = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy,         setBusy]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getAllRequests();
      setReqs(res.data?.requests || []);
    } catch {
      setError(t("parking_load_all_failed", "Failed to load requests."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending        = reqs.filter(r => r.status === "pending").length;
  const visible        = filter === "all" ? reqs : reqs.filter(r => r.status === filter);
  const availableSlots = slots.filter(s => s.status === "available");

  const doAction = async () => {
    if (!actionTarget) return;
    setBusy(true);
    try {
      if (actionTarget.mode === "approve") {
        await parkingApi.approveRequest(actionTarget.req._id, selectedSlot || undefined);
        toast.success(t("parking_approved", "Request approved."));
      } else {
        await parkingApi.rejectRequest(actionTarget.req._id, rejectNote.trim() || undefined);
        toast.success(t("parking_rejected", "Request rejected."));
      }
      setReqs(p => p.map(r =>
        r._id === actionTarget.req._id
          ? { ...r, status: actionTarget.mode === "approve" ? "approved" : "rejected" }
          : r
      ));
      setActionTarget(null); setRejectNote(""); setSelectedSlot("");
    } catch (e) {
      toast.error(e.response?.data?.message || t("parking_action_failed", "Action failed."));
    } finally { setBusy(false); }
  };

  const FILTERS = ["all", "pending", "approved", "rejected", "cancelled"];
  const FILTER_LABELS = {
    all:       t("parking_filter_all",       "All"),
    pending:   t("parking_filter_pending",   "Pending"),
    approved:  t("parking_filter_approved",  "Approved"),
    rejected:  t("parking_filter_rejected",  "Rejected"),
    cancelled: t("parking_filter_cancelled", "Cancelled"),
  };

  return (
    <View style={{ flex: 1 }}>
      {pending > 0 && (
        <View style={ar.pendingBanner}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}>
            {t("parking_pending_banner", "⏳ {count} pending request{plural} awaiting review")
              .replace("{count}", pending)
              .replace("{plural}", pending > 1 ? "s" : "")}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ps.filterScroller}
        contentContainerStyle={ps.filterContentCompact}
      >
        {FILTERS.map(f => (
          <FilterPill
            key={f}
            label={FILTER_LABELS[f]}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      {loading
        ? <View style={util.center}><Spinner size={28} /></View>
        : error
        ? <View style={util.center}><ErrorState message={error} onRetry={load} /></View>
        : visible.length === 0
        ? <View style={util.center}>
            <EmptyState
              icon="📋"
              message={t("parking_no_requests_filtered", "No {filter} requests.")
                .replace("{filter}", filter !== "all" ? filter : "")}
            />
          </View>
        : <FlatList
            data={visible}
            keyExtractor={r => r._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: req }) => {
              const color = slotColor(req.slotType);
              const sc    = reqSC(req.status);
              return (
                <Card style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <View style={[ar.iconBox, { backgroundColor: color + "15" }]}>
                      <Text style={{ fontSize: 20 }}>{slotIcon(req.slotType)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>
                          {t("parking_slot_type_label", "{type} Slot").replace("{type}", req.slotType)}
                        </Text>
                        <Badge label={req.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
                      </View>
                      <Text style={ar.meta}>{req.flat || req.requestedBy?.flat || "—"}</Text>
                      <Text style={ar.meta}>{req.vehicleNumber}</Text>
                      {req.vehicleDescription && <Text style={ar.meta}>{req.vehicleDescription}</Text>}
                      {req.adminNote && <Text style={[ar.meta, { color: C.red }]}>📋 {req.adminNote}</Text>}
                      <Text style={[ar.meta, { marginTop: 4, color: C.gray300 }]}>{timeAgo(req.createdAt)}</Text>
                    </View>
                  </View>

                  {req.status === "pending" && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <Btn variant="outline" small
                        onPress={() => { setActionTarget({ req, mode: "approve" }); setSelectedSlot(""); }}
                        style={{ flex: 1 }}>
                        {t("parking_approve_btn", "✓ Approve")}
                      </Btn>
                      <Btn variant="danger" small
                        onPress={() => { setActionTarget({ req, mode: "reject" }); setRejectNote(""); }}
                        style={{ flex: 1 }}>
                        {t("parking_reject_btn", "✕ Reject")}
                      </Btn>
                    </View>
                  )}
                </Card>
              );
            }}
          />
      }

      {/* Approve / Reject modal */}
      <Modal
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.mode === "approve"
          ? t("parking_approve_modal_title", "Approve Request")
          : t("parking_reject_modal_title",  "Reject Request")}
      >
        {actionTarget?.mode === "approve" ? (
          <>
            <Text style={{ fontSize: 13, color: C.gray500, marginBottom: 14 }}>
              {t("parking_approve_modal_hint", "Optionally assign an available slot now.")}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 }}>
              {t("parking_assign_slot_label", "Assign Slot (optional)")}
            </Text>
            <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: C.gray100, borderRadius: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setSelectedSlot("")}
                style={[ar.slotOpt, { backgroundColor: !selectedSlot ? C.teal + "12" : "transparent" }]}
              >
                <Text style={{ fontSize: 13, color: C.gray500 }}>
                  {t("parking_approve_no_assign", "— Approve without assigning")}
                </Text>
              </TouchableOpacity>
              {availableSlots.map(s => (
                <TouchableOpacity
                  key={s._id}
                  onPress={() => setSelectedSlot(s._id)}
                  style={[ar.slotOpt, { backgroundColor: selectedSlot === s._id ? slotColor(s.type) + "12" : "transparent" }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>{s.slotNumber}</Text>
                  <Text style={{ fontSize: 11, color: C.gray500 }}>
                    {s.type}{s.zone ? ` · ${t("parking_zone_label", "Zone")} ${s.zone}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <Input
            label={t("parking_reject_note_label", "Rejection Note (optional)")}
            value={rejectNote}
            onChangeText={setRejectNote}
            placeholder={t("parking_reject_note_ph", "e.g. No slots available in this zone.")}
            multiline
          />
        )}
        <Btn onPress={doAction} loading={busy} style={{ width: "100%" }}>
          {actionTarget?.mode === "approve"
            ? t("parking_approve_btn",        "✓ Approve")
            : t("parking_confirm_reject_btn", "✕ Confirm Reject")}
        </Btn>
      </Modal>
    </View>
  );
};
const ar = StyleSheet.create({
  pendingBanner: { backgroundColor: "#FEF3C7", margin: 16, marginBottom: 0, borderRadius: 10, padding: 12 },
  iconBox:       { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  meta:          { fontSize: 11, color: C.gray500, marginTop: 2 },
  slotOpt:       { padding: 12, borderBottomWidth: 1, borderBottomColor: C.gray100 },
});

// ═══════════════════════════════════════════════════════
// CREATE SLOT MODAL (admin) — single + bulk modes
// ═══════════════════════════════════════════════════════

// helper: left-pad a number with zeros
const pad = (n, digits) => String(n).padStart(digits, "0");

// build the slots array from bulk form values
const buildBulkSlots = ({ prefix, from, to, padDigits, zone, type }) => {
  const f = parseInt(from, 10);
  const t = parseInt(to,   10);
  if (isNaN(f) || isNaN(t) || f > t) return [];
  const out = [];
  for (let i = f; i <= t; i++) {
    out.push({ slotNumber: `${prefix}${pad(i, padDigits)}`, zone: zone.trim() || undefined, type });
  }
  return out;
};

const TypePickerRow = ({ value, onChange, t }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={rm.label}>{t("parking_slot_type_picker", "Slot Type *")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SLOT_TYPES.map((tp) => {
          const color = slotColor(tp);
          const on    = value === tp;
          return (
            <TouchableOpacity
              key={tp}
              onPress={() => onChange(tp)}
              style={[rm.typeBtn, { backgroundColor: on ? color : color + "15", borderColor: on ? color : color + "30" }]}
            >
              <Text style={{ fontSize: 16 }}>{slotIcon(tp)}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: on ? "#fff" : color }}>{tp}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </View>
);

const CreateSlotModal = ({ open, onClose, onCreated }) => {
  const toast  = useToast();
  const { t }  = useLanguage();
  const [mode,       setMode]       = useState("single");
  const [modalError, setModalError] = useState("");
  const [single,     setSingle]     = useState({ slotNumber: "", zone: "", type: "4W" });
  const [bulk,       setBulk]       = useState({ type: "4W", prefix: "", from: "1", to: "10", padDigits: "2", zone: "" });
  const [busy,       setBusy]       = useState(false);

  const handleClose = () => {
    setSingle({ slotNumber: "", zone: "", type: "4W" });
    setBulk({ type: "4W", prefix: "", from: "1", to: "10", padDigits: "2", zone: "" });
    setMode("single");
    setModalError("");
    onClose();
  };

  // Single submit
  const submitSingle = async () => {
    if (!single.slotNumber.trim()) {
      return toast.error(t("parking_slot_required", "Slot number is required."));
    }
    setBusy(true);
    try {
      const res = await parkingApi.createSlot({
        slotNumber: single.slotNumber.trim().toUpperCase(),
        zone:       single.zone.trim() || undefined,
        type:       single.type,
      });
      toast.success(
        t("parking_single_created", "Slot {slot} created.").replace("{slot}", single.slotNumber.toUpperCase())
      );
      onCreated([res.data?.slot]);
      handleClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("parking_single_create_failed", "Create failed."));
    } finally { setBusy(false); }
  };

  // Bulk submit
  const previewSlots = buildBulkSlots({ ...bulk, padDigits: parseInt(bulk.padDigits, 10) || 2 });

  const submitBulk = async () => {
    setModalError("");
    if (!previewSlots.length) {
      setModalError(t("parking_bulk_range_error", "Enter a valid range. Set From and To numbers."));
      return;
    }
    if (previewSlots.length > 200) {
      setModalError(t("parking_bulk_max_error", "Maximum 200 slots per bulk operation. Reduce the range."));
      return;
    }
    setBusy(true);
    try {
      const res     = await parkingApi.bulkCreateSlots({ slots: previewSlots });
      const created = res.data?.slots   || [];
      const skipped = res.data?.skipped || 0;
      toast.success(
        skipped > 0
          ? t("parking_bulk_created_skipped", "{count} slot(s) created, {skipped} skipped (already exist).")
              .replace("{count}", created.length).replace("{skipped}", skipped)
          : t("parking_bulk_created", "{count} slot(s) created successfully.")
              .replace("{count}", created.length)
      );
      onCreated(created);
      handleClose();
    } catch (e) {
      setModalError(e?.response?.data?.message || t("parking_bulk_create_failed", "Bulk create failed. Please try again."));
    } finally { setBusy(false); }
  };

  const SHOW_MAX   = 40;
  const previewClr = slotColor(bulk.type);

  return (
    <Modal open={open} onClose={handleClose} title={t("parking_create_modal_title", "Create Parking Slot")}>
      {/* Mode toggle */}
      <View style={rm.modeToggle}>
        {["single", "bulk"].map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[rm.modeBtn, mode === m && rm.modeBtnActive]}
          >
            <Text style={[rm.modeBtnText, mode === m && rm.modeBtnTextActive]}>
              {m === "single"
                ? t("parking_mode_single", "Single Slot")
                : t("parking_mode_bulk",   "Bulk Create")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "single" ? (
        <>
          <TypePickerRow value={single.type} onChange={(tp) => setSingle(p => ({ ...p, type: tp }))} t={t} />
          <Input
            label={t("parking_slot_number_label", "Slot Number *")}
            value={single.slotNumber}
            onChangeText={(v) => setSingle(p => ({ ...p, slotNumber: v }))}
            placeholder={t("parking_slot_number_ph", "e.g. A-01, B-12, EV-03")}
          />
          <Input
            label={t("parking_zone_optional_label", "Zone (optional)")}
            value={single.zone}
            onChangeText={(v) => setSingle(p => ({ ...p, zone: v }))}
            placeholder={t("parking_zone_ph", "e.g. A, Basement-1")}
          />
          <Btn onPress={submitSingle} loading={busy} style={{ width: "100%" }}>
            {t("parking_create_single_btn", "Create Slot")}
          </Btn>
        </>
      ) : (
        <>
          <TypePickerRow value={bulk.type} onChange={(tp) => setBulk(p => ({ ...p, type: tp }))} t={t} />

          {/* Prefix + range row */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t("parking_bulk_prefix_label", "Prefix")}
                value={bulk.prefix}
                onChangeText={(v) => setBulk(p => ({ ...p, prefix: v }))}
                placeholder={t("parking_bulk_prefix_ph", "A-, EV-")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t("parking_bulk_from_label", "From *")}
                value={bulk.from}
                onChangeText={(v) => setBulk(p => ({ ...p, from: v }))}
                placeholder={t("parking_bulk_from_ph", "1")}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t("parking_bulk_to_label", "To *")}
                value={bulk.to}
                onChangeText={(v) => setBulk(p => ({ ...p, to: v }))}
                placeholder={t("parking_bulk_to_ph", "10")}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ width: 56 }}>
              <Input
                label={t("parking_bulk_pad_label", "Pad")}
                value={bulk.padDigits}
                onChangeText={(v) => setBulk(p => ({ ...p, padDigits: v }))}
                placeholder="2"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Input
            label={t("parking_zone_optional_label", "Zone (optional)")}
            value={bulk.zone}
            onChangeText={(v) => setBulk(p => ({ ...p, zone: v }))}
            placeholder={t("parking_zone_ph", "e.g. A, Basement-1")}
          />

          {/* Live preview */}
          {previewSlots.length > 0 ? (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700 }}>
                  {t("parking_preview_label", "Preview — {count} slot{plural}")
                    .replace("{count}", previewSlots.length)
                    .replace("{plural}", previewSlots.length !== 1 ? "s" : "")}
                </Text>
                {previewSlots.length > SHOW_MAX && (
                  <Text style={{ fontSize: 11, color: C.gray500 }}>
                    {t("parking_preview_showing", "showing first {max}…").replace("{max}", SHOW_MAX)}
                  </Text>
                )}
              </View>
              <View style={{
                backgroundColor: C.gray50, borderRadius: 10, padding: 10,
                flexDirection: "row", flexWrap: "wrap", gap: 6, maxHeight: 140,
              }}>
                {previewSlots.slice(0, SHOW_MAX).map((s) => (
                  <View key={s.slotNumber} style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    backgroundColor: previewClr + "15", borderRadius: 6,
                    borderWidth: 1, borderColor: previewClr + "30",
                    paddingVertical: 3, paddingHorizontal: 8,
                  }}>
                    <Text style={{ fontSize: 11 }}>{slotIcon(bulk.type)}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: previewClr }}>{s.slotNumber}</Text>
                  </View>
                ))}
                {previewSlots.length > SHOW_MAX && (
                  <Text style={{ fontSize: 11, color: C.gray400, fontStyle: "italic", paddingVertical: 3 }}>
                    {t("parking_preview_more", "+{count} more").replace("{count}", previewSlots.length - SHOW_MAX)}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{
              backgroundColor: C.gray50, borderRadius: 10, padding: 12,
              alignItems: "center", marginBottom: 14,
            }}>
              <Text style={{ fontSize: 12, color: C.gray300 }}>
                {t("parking_preview_empty", "Set a valid range to preview slots")}
              </Text>
            </View>
          )}

          {!!modalError && (
            <View style={{ backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FCA5A5" }}>
              <Text style={{ fontSize: 13, color: "#B91C1C", fontWeight: "600" }}>⚠️ {modalError}</Text>
            </View>
          )}
          <Btn
            onPress={submitBulk}
            loading={busy}
            disabled={previewSlots.length === 0}
            style={{ width: "100%" }}
          >
            {previewSlots.length > 0
              ? t("parking_bulk_create_btn", "Create {count} Slot{plural}")
                  .replace("{count}", previewSlots.length)
                  .replace("{plural}", previewSlots.length !== 1 ? "s" : "")
              : t("parking_bulk_create_btn_empty", "Create Slots")}
          </Btn>
        </>
      )}
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════
const TABS_RES   = [{ id: "overview", label: "Overview" }, { id: "slots", label: "All Slots" }, { id: "requests", label: "My Requests" }];
const TABS_ADMIN = [{ id: "overview", label: "Overview" }, { id: "slots", label: "All Slots" }, { id: "requests", label: "All Requests" }];

export const ParkingScreen = () => {
  const { isAdmin, dataVersion } = useAuth();
  const { t }   = useLanguage();
  const [tab, setTab] = useState("overview");

  const [summary,    setSummary]    = useState([]);
  const [sumLoading, setSumLoading] = useState(true);
  const [slots,      setSlots]      = useState([]);
  const [showRequest, setShowRequest] = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const TABS_RES   = [
    { id: "overview",  label: t("parking_tab_overview",    "Overview")    },
    { id: "slots",     label: t("parking_tab_slots",       "All Slots")   },
    { id: "requests",  label: t("parking_tab_my_requests", "My Requests") },
  ];
  const TABS_ADMIN = [
    { id: "overview",  label: t("parking_tab_overview",     "Overview")     },
    { id: "slots",     label: t("parking_tab_slots",        "All Slots")    },
    { id: "requests",  label: t("parking_tab_all_requests", "All Requests") },
  ];

  const loadSummary = useCallback(async () => {
    setSumLoading(true);
    try {
      const [sumRes, slotRes] = await Promise.all([
        parkingApi.getSummary(),
        parkingApi.getSlots(),
      ]);
      setSummary(sumRes.data?.summary || []);
      setSlots(slotRes.data?.slots   || []);
    } catch {}
    finally { setSumLoading(false); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary, dataVersion]);

  const TABS = isAdmin ? TABS_ADMIN : TABS_RES;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["bottom"]}>
      {/* Header */}
      <View style={ps.header}>
        <View>
          <Text style={ps.headerSub}>{t("parking_header_sub", "SOCIETY")}</Text>
          <Text style={ps.headerTitle}>{t("parking_header_title", "🚗 Parking")}</Text>
        </View>
        {isAdmin
          ? <TouchableOpacity onPress={() => setShowCreate(true)} style={ps.headerBtn}>
              <Text style={ps.headerBtnText}>{t("parking_create_slot_btn", "＋ Create Slot")}</Text>
            </TouchableOpacity>
          : <TouchableOpacity onPress={() => setShowRequest(true)} style={ps.headerBtn}>
              <Text style={ps.headerBtnText}>{t("parking_request_slot_btn", "+ Request Slot")}</Text>
            </TouchableOpacity>
        }
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ps.tabBar}
        contentContainerStyle={ps.tabBarContent}
      >
        {TABS.map(tp => (
          <TouchableOpacity
            key={tp.id}
            onPress={() => setTab(tp.id)}
            style={[ps.tabBtn, tab === tp.id && ps.tabActive]}
          >
            <Text
              style={[ps.tabText, tab === tp.id && ps.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tp.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {tab === "overview" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={sumLoading} onRefresh={loadSummary} tintColor={C.teal} />}
        >
          <SlotSummary items={summary} loading={sumLoading} t={t} />
          {/* CTA card */}
          <View style={[ps.ctaCard, { marginHorizontal: 16 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>
              {isAdmin
                ? t("parking_cta_admin_icon",    "🏗️")
                : t("parking_cta_resident_icon",  "🅿️")}
            </Text>
            <Text style={ps.ctaTitle}>
              {isAdmin
                ? t("parking_cta_admin_title",    "Manage Parking Slots")
                : t("parking_cta_resident_title", "Need a parking slot?")}
            </Text>
            <Text style={ps.ctaSub}>
              {isAdmin
                ? t("parking_cta_admin_sub",    "Add slots or review pending resident requests.")
                : t("parking_cta_resident_sub", "Submit a request and admin will assign a slot.")}
            </Text>
            <Btn
              small
              onPress={() => isAdmin ? setTab("requests") : setShowRequest(true)}
              style={{ marginTop: 10, alignSelf: "flex-start" }}
            >
              {isAdmin
                ? t("parking_cta_admin_btn",    "View Requests")
                : t("parking_cta_resident_btn", "Request a Slot")}
            </Btn>
          </View>
        </ScrollView>
      )}

      {tab === "slots"    && <SlotsTab isAdmin={isAdmin} key={refreshKey} />}
      {tab === "requests" && (
        !isAdmin
          ? <MyRequestsTab key={refreshKey} />
          : <AdminRequestsTab slots={slots} key={refreshKey} />
      )}

      {/* Modals */}
      <RequestModal
        open={showRequest}
        onClose={() => setShowRequest(false)}
        summary={summary}
        onSubmitted={() => {
          setShowRequest(false);
          setTab("requests");
          setRefreshKey(k => k + 1);
        }}
      />
      <CreateSlotModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(newSlots) => {
          if (newSlots?.length) setSlots(p => [...newSlots, ...p]);
          loadSummary();
          setShowCreate(false);
        }}
      />
    </SafeAreaView>
  );
};
const ps = StyleSheet.create({
  header:        { backgroundColor: C.navy, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSub:     { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: 1 },
  headerTitle:   { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },
  headerBtn:     { backgroundColor: C.teal, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  headerBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  tabBar:        { flexGrow: 0, flexShrink: 0, height: 46, backgroundColor: C.navy, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  tabBarContent: { flexGrow: 0, flexDirection: "row", alignItems: "stretch", paddingHorizontal: 12 },
  tabBtn:        { width: 116, height: 45, alignItems: "center", justifyContent: "center", borderBottomWidth: 2.5, borderBottomColor: "transparent", paddingHorizontal: 8 },
  tabActive:     { borderBottomColor: C.teal },
  tabText:       { width: "100%", textAlign: "center", fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.4)" },
  tabTextActive: { color: "#fff" },
  filterScroller:{ flexGrow: 0, flexShrink: 0, height: 56, backgroundColor: C.bg },
  filterContent: { flexGrow: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 6 },
  filterContentCompact:{ flexGrow: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 6 },
  ctaCard:       { backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.gray100, marginTop: 4 },
  ctaTitle:      { fontSize: 16, fontWeight: "700", color: C.navy, marginBottom: 4 },
  ctaSub:        { fontSize: 13, color: C.gray500, lineHeight: 20 },
});

const util = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  flex1:  { flex: 1 },
});