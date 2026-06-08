/**
 * screens/parking/ParkingScreen.jsx
 * All parking sub-components consolidated into one file (minimum effort port).
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
  TouchableOpacity, TextInput, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { parkingApi }  from "../../api/resources.api";
import { useAuth }     from "../../context/AuthContext";
import { useToast }    from "../../context/ToastContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  FilterPill, Modal, Input, Spinner, ScreenHeader,
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
const SlotSummary = ({ items, loading }) => {
  if (loading) return (
    <View style={ss.row}>
      {[1,2,3].map(k => <View key={k} style={ss.skeleton} />)}
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
              <Text style={ss.chipSub}>of {s.total} free</Text>
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
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const color = slotColor(slot.type);
  const sc    = slotSC(slot.status);

  const doRelease = async () => {
    setBusy(true);
    try {
      await parkingApi.releaseSlot(slot._id);
      toast.success(`Slot ${slot.slotNumber} released.`);
      onReleased?.(slot._id);
    } catch (e) {
      toast.error(e.response?.data?.message || "Release failed.");
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
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>Slot {slot.slotNumber}</Text>
            <Badge label={slot.type} bg={color + "15"} text={color} />
          </View>
          {slot.zone       && <Text style={sc2.meta}>Zone {slot.zone}</Text>}
          {slot.assignedFlat && <Text style={sc2.meta}>Flat {slot.assignedFlat} · {slot.vehicleNumber}</Text>}
          {slot.note       && <Text style={sc2.meta}>{slot.note}</Text>}
        </View>
        <Badge label={slot.status} bg={sc.bg} text={sc.text} dot={sc.dot} />
      </View>

      {/* Admin release strip */}
      {isAdmin && slot.status === "assigned" && (
        <View style={[sc2.releaseStrip, confirm && { backgroundColor: C.red + "08" }]}>
          {confirm ? (
            <>
              <Text style={{ fontSize: 11, color: C.red, fontWeight: "600", flex: 1 }}>
                Release and unassign?
              </Text>
              <TouchableOpacity onPress={() => setConfirm(false)} style={sc2.releaseGhost}>
                <Text style={{ fontSize: 11, color: C.gray500, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doRelease} style={[sc2.releaseGhost, { borderColor: C.red + "40", backgroundColor: C.red + "10" }]}>
                {busy ? <Spinner size={11} /> : <Text style={{ fontSize: 11, color: C.red, fontWeight: "700" }}>Confirm</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={sc2.meta}>Assigned to Flat {slot.assignedFlat}</Text>
              <TouchableOpacity onPress={() => setConfirm(true)} style={sc2.releaseGhost}>
                <Text style={{ fontSize: 11, color: C.gray500, fontWeight: "700" }}>↩ Release</Text>
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
  const [slots,   setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getSlots();
      setSlots(res.data?.slots || []);
    } catch { setError("Failed to load slots."); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = typeFilter === "All" ? slots : slots.filter(s => s.type === typeFilter);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={ps.filterScroller}
        contentContainerStyle={ps.filterContent}>
        {["All", ...SLOT_TYPES].map(t => (
          <FilterPill key={t} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />
        ))}
      </ScrollView>
      {loading ? <View style={util.center}><Spinner size={28} /></View>
        : error  ? <View style={util.center}><ErrorState message={error} onRetry={load} /></View>
        : visible.length === 0 ? <View style={util.center}><EmptyState icon="🅿️" message="No slots found." /></View>
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
  const color = slotColor(req.slotType);
  const sc    = reqSC(req.status);

  const cancel = async () => {
    setBusy(true);
    try {
      await parkingApi.cancelRequest(req._id);
      toast.success("Request cancelled.");
      onCancelled?.(req._id);
    } catch (e) {
      toast.error(e.response?.data?.message || "Cancel failed.");
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
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>{req.slotType} Slot</Text>
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
          Cancel Request
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
  const [reqs,    setReqs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getMyRequests();
      setReqs(res.data?.requests || []);
    } catch { setError("Failed to load requests."); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={util.flex1}><View style={util.center}><Spinner size={28} /></View></View>;
  if (error)   return <View style={util.flex1}><View style={util.center}><ErrorState message={error} onRetry={load} /></View></View>;
  if (!reqs.length) return <View style={util.flex1}><View style={util.center}><EmptyState icon="🚗" message="No parking requests yet." /></View></View>;

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
  const toast = useToast();
  const [form, setForm]     = useState({ slotType: "4W", vehicleNumber: "", vehicleDescription: "", note: "" });
  const [busy, setBusy]     = useState(false);

  const avail = summary.find(s => s._id === form.slotType)?.available ?? null;

  const submit = async () => {
    if (!form.vehicleNumber.trim()) return toast.error("Vehicle number is required.");
    setBusy(true);
    try {
      const res = await parkingApi.submitRequest(form);
      toast.success("Request submitted!");
      onSubmitted(res.data?.request);
      onClose();
      setForm({ slotType: "4W", vehicleNumber: "", vehicleDescription: "", note: "" });
    } catch (e) {
      toast.error(e.response?.data?.message || "Submission failed.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request a Parking Slot">
      <Text style={rm.label}>Slot Type *</Text>
      <View style={rm.typeRow}>
        {SLOT_TYPES.filter(t => !["Visitor","Reserved"].includes(t)).map(t => {
          const color = slotColor(t);
          const on    = form.slotType === t;
          return (
            <TouchableOpacity key={t} onPress={() => setForm(p => ({ ...p, slotType: t }))}
              style={[rm.typeBtn, { backgroundColor: on ? color : color + "15", borderColor: on ? color : color + "30" }]}>
              <Text style={{ fontSize: 18 }}>{slotIcon(t)}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: on ? "#fff" : color }}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {avail !== null && (
        <View style={[rm.availBadge, { backgroundColor: avail === 0 ? C.red + "12" : C.green + "12" }]}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: avail === 0 ? C.red : C.green }}>
            {avail === 0 ? "⚠️ No slots available — request will be queued" : `✅ ${avail} slot(s) available`}
          </Text>
        </View>
      )}

      <Input label="Vehicle Number *" value={form.vehicleNumber}
        onChangeText={v => setForm(p => ({ ...p, vehicleNumber: v }))}
        placeholder="e.g. GJ01AB1234" />
      <Input label="Vehicle Description" value={form.vehicleDescription}
        onChangeText={v => setForm(p => ({ ...p, vehicleDescription: v }))}
        placeholder="e.g. White Hyundai Creta" />
      <Input label="Note (optional)" value={form.note}
        onChangeText={v => setForm(p => ({ ...p, note: v }))}
        placeholder="Any special requirements…" multiline />

      <Btn onPress={submit} loading={busy} style={{ width: "100%" }}>Submit Request</Btn>
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
  const toast = useToast();
  const [reqs,    setReqs]    = useState([]);
  const [filter,  setFilter]  = useState("all");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [actionTarget, setActionTarget] = useState(null); // { req, mode: "approve"|"reject" }
  const [rejectNote,   setRejectNote]   = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await parkingApi.getAllRequests();
      setReqs(res.data?.requests || []);
    } catch { setError("Failed to load requests."); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = reqs.filter(r => r.status === "pending").length;
  const visible = filter === "all" ? reqs : reqs.filter(r => r.status === filter);
  const availableSlots = slots.filter(s => s.status === "available");

  const doAction = async () => {
    if (!actionTarget) return;
    setBusy(true);
    try {
      if (actionTarget.mode === "approve") {
        await parkingApi.approveRequest(actionTarget.req._id, selectedSlot || undefined);
        toast.success("Request approved.");
      } else {
        await parkingApi.rejectRequest(actionTarget.req._id, rejectNote.trim() || undefined);
        toast.success("Request rejected.");
      }
      setReqs(p => p.map(r => r._id === actionTarget.req._id
        ? { ...r, status: actionTarget.mode === "approve" ? "approved" : "rejected" }
        : r
      ));
      setActionTarget(null); setRejectNote(""); setSelectedSlot("");
    } catch (e) {
      toast.error(e.response?.data?.message || "Action failed.");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      {pending > 0 && (
        <View style={ar.pendingBanner}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}>
            ⏳ {pending} pending request{pending > 1 ? "s" : ""} awaiting review
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={ps.filterScroller}
        contentContainerStyle={ps.filterContentCompact}>
        {["all","pending","approved","rejected","cancelled"].map(f => (
          <FilterPill key={f} label={f.charAt(0).toUpperCase()+f.slice(1)}
            active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {loading ? <View style={util.center}><Spinner size={28} /></View>
        : error ? <View style={util.center}><ErrorState message={error} onRetry={load} /></View>
        : visible.length === 0 ? <View style={util.center}><EmptyState icon="📋" message={`No ${filter !== "all" ? filter : ""} requests.`} /></View>
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
                        <Text style={{ fontSize: 14, fontWeight: "700", color: C.navy }}>{req.slotType} Slot</Text>
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
                        style={{ flex: 1 }}>✓ Approve</Btn>
                      <Btn variant="danger" small
                        onPress={() => { setActionTarget({ req, mode: "reject" }); setRejectNote(""); }}
                        style={{ flex: 1 }}>✕ Reject</Btn>
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
        title={actionTarget?.mode === "approve" ? "Approve Request" : "Reject Request"}
      >
        {actionTarget?.mode === "approve" ? (
          <>
            <Text style={{ fontSize: 13, color: C.gray500, marginBottom: 14 }}>
              Optionally assign an available slot now.
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 8 }}>
              Assign Slot (optional)
            </Text>
            <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: C.gray100, borderRadius: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setSelectedSlot("")}
                style={[ar.slotOpt, { backgroundColor: !selectedSlot ? C.teal + "12" : "transparent" }]}>
                <Text style={{ fontSize: 13, color: C.gray500 }}>— Approve without assigning</Text>
              </TouchableOpacity>
              {availableSlots.map(s => (
                <TouchableOpacity key={s._id}
                  onPress={() => setSelectedSlot(s._id)}
                  style={[ar.slotOpt, { backgroundColor: selectedSlot === s._id ? slotColor(s.type) + "12" : "transparent" }]}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>{s.slotNumber}</Text>
                  <Text style={{ fontSize: 11, color: C.gray500 }}>{s.type}{s.zone ? ` · Zone ${s.zone}` : ""}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <Input
            label="Rejection Note (optional)"
            value={rejectNote}
            onChangeText={setRejectNote}
            placeholder="e.g. No slots available in this zone."
            multiline
          />
        )}
        <Btn onPress={doAction} loading={busy} style={{ width: "100%" }}>
          {actionTarget?.mode === "approve" ? "✓ Approve" : "✕ Confirm Reject"}
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

// Type picker row (shared by single + bulk)
const TypePickerRow = ({ value, onChange }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={rm.label}>Slot Type *</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SLOT_TYPES.map((t) => {
          const color = slotColor(t);
          const on    = value === t;
          return (
            <TouchableOpacity
              key={t} onPress={() => onChange(t)}
              style={[rm.typeBtn, { backgroundColor: on ? color : color + "15", borderColor: on ? color : color + "30" }]}
            >
              <Text style={{ fontSize: 16 }}>{slotIcon(t)}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: on ? "#fff" : color }}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </View>
);

const CreateSlotModal = ({ open, onClose, onCreated }) => {
  const toast   = useToast();
  const [mode, setMode] = useState("single");
  const [modalError, setModalError] = useState("");

  // Single mode state
  const [single, setSingle] = useState({ slotNumber: "", zone: "", type: "4W" });

  // Bulk mode state
  const [bulk, setBulk] = useState({
    type: "4W", prefix: "", from: "1", to: "10", padDigits: "2", zone: "",
  });

  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    setSingle({ slotNumber: "", zone: "", type: "4W" });
    setBulk({ type: "4W", prefix: "", from: "1", to: "10", padDigits: "2", zone: "" });
    setMode("single");
    setModalError("");
    onClose();
  };

  // ── Single submit ──────────────────────────────────────────────────────────
  const submitSingle = async () => {
    if (!single.slotNumber.trim()) return toast.error("Slot number is required.");
    setBusy(true);
    try {
      const res = await parkingApi.createSlot({
        slotNumber: single.slotNumber.trim().toUpperCase(),
        zone:       single.zone.trim() || undefined,
        type:       single.type,
      });
      toast.success(`Slot ${single.slotNumber.toUpperCase()} created.`);
      onCreated([res.data?.slot]);
      handleClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Create failed.");
    } finally { setBusy(false); }
  };

  // ── Bulk submit ────────────────────────────────────────────────────────────
  const previewSlots = buildBulkSlots({ ...bulk, padDigits: parseInt(bulk.padDigits, 10) || 2 });

  const submitBulk = async () => {
    setModalError("");
    if (!previewSlots.length) { setModalError("Enter a valid range. Set From and To numbers."); return; }
    if (previewSlots.length > 200) { setModalError("Maximum 200 slots per bulk operation. Reduce the range."); return; }
    setBusy(true);
    try {
      const res     = await parkingApi.bulkCreateSlots({ slots: previewSlots });
      const created = res.data?.slots  || [];
      const skipped = res.data?.skipped || 0;
      toast.success(
        skipped > 0
          ? `${created.length} slot(s) created, ${skipped} skipped (already exist).`
          : `${created.length} slot(s) created successfully.`
      );
      onCreated(created);
      handleClose();
    } catch (e) {
      setModalError(e?.response?.data?.message || "Bulk create failed. Please try again.");
    } finally { setBusy(false); }
  };

  const SHOW_MAX   = 40;
  const previewClr = slotColor(bulk.type);

  return (
    <Modal open={open} onClose={handleClose} title="Create Parking Slot">
      {/* Mode toggle */}
      <View style={rm.modeToggle}>
        {["single", "bulk"].map((m) => (
          <TouchableOpacity
            key={m} onPress={() => setMode(m)}
            style={[rm.modeBtn, mode === m && rm.modeBtnActive]}
          >
            <Text style={[rm.modeBtnText, mode === m && rm.modeBtnTextActive]}>
              {m === "single" ? "Single Slot" : "Bulk Create"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "single" ? (
        <>
          <TypePickerRow value={single.type} onChange={(t) => setSingle((p) => ({ ...p, type: t }))} />
          <Input
            label="Slot Number *"
            value={single.slotNumber}
            onChangeText={(v) => setSingle((p) => ({ ...p, slotNumber: v }))}
            placeholder="e.g. A-01, B-12, EV-03"
          />
          <Input
            label="Zone (optional)"
            value={single.zone}
            onChangeText={(v) => setSingle((p) => ({ ...p, zone: v }))}
            placeholder="e.g. A, Basement-1"
          />
          <Btn onPress={submitSingle} loading={busy} style={{ width: "100%" }}>Create Slot</Btn>
        </>
      ) : (
        <>
          <TypePickerRow value={bulk.type} onChange={(t) => setBulk((p) => ({ ...p, type: t }))} />

          {/* Prefix + range row */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Prefix"
                value={bulk.prefix}
                onChangeText={(v) => setBulk((p) => ({ ...p, prefix: v }))}
                placeholder="A-, EV-"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="From *"
                value={bulk.from}
                onChangeText={(v) => setBulk((p) => ({ ...p, from: v }))}
                placeholder="1"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="To *"
                value={bulk.to}
                onChangeText={(v) => setBulk((p) => ({ ...p, to: v }))}
                placeholder="10"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ width: 56 }}>
              <Input
                label="Pad"
                value={bulk.padDigits}
                onChangeText={(v) => setBulk((p) => ({ ...p, padDigits: v }))}
                placeholder="2"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Input
            label="Zone (optional)"
            value={bulk.zone}
            onChangeText={(v) => setBulk((p) => ({ ...p, zone: v }))}
            placeholder="e.g. A, Basement-1"
          />

          {/* Live preview */}
          {previewSlots.length > 0 ? (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700 }}>
                  Preview — {previewSlots.length} slot{previewSlots.length !== 1 ? "s" : ""}
                </Text>
                {previewSlots.length > SHOW_MAX && (
                  <Text style={{ fontSize: 11, color: C.gray500 }}>showing first {SHOW_MAX}…</Text>
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
                    +{previewSlots.length - SHOW_MAX} more
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{
              backgroundColor: C.gray50, borderRadius: 10, padding: 12,
              alignItems: "center", marginBottom: 14,
            }}>
              <Text style={{ fontSize: 12, color: C.gray300 }}>Set a valid range to preview slots</Text>
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
              ? `Create ${previewSlots.length} Slot${previewSlots.length !== 1 ? "s" : ""}`
              : "Create Slots"}
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
  const { isAdmin }  = useAuth();
  const toast        = useToast();
  const [tab, setTab] = useState("overview");

  const [summary,     setSummary]     = useState([]);
  const [sumLoading,  setSumLoading]  = useState(true);
  const [slots,       setSlots]       = useState([]);  // for approve slot picker
  const [showRequest, setShowRequest] = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

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

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const TABS = isAdmin ? TABS_ADMIN : TABS_RES;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={ps.header}>
        <View>
          <Text style={ps.headerSub}>SOCIETY</Text>
          <Text style={ps.headerTitle}>🚗 Parking</Text>
        </View>
        {isAdmin
          ? <TouchableOpacity onPress={() => setShowCreate(true)} style={ps.headerBtn}>
              <Text style={ps.headerBtnText}>＋ Create Slot</Text>
            </TouchableOpacity>
          : <TouchableOpacity onPress={() => setShowRequest(true)} style={ps.headerBtn}>
              <Text style={ps.headerBtnText}>+ Request Slot</Text>
            </TouchableOpacity>
        }
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ps.tabBar} contentContainerStyle={ps.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[ps.tabBtn, tab === t.id && ps.tabActive]}>
            <Text
              style={[ps.tabText, tab === t.id && ps.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {tab === "overview" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={sumLoading} onRefresh={loadSummary} tintColor={C.teal} />}>
          <SlotSummary items={summary} loading={sumLoading} />
          {/* CTA card */}
          <View style={[ps.ctaCard, { marginHorizontal: 16 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>{isAdmin ? "🏗️" : "🅿️"}</Text>
            <Text style={ps.ctaTitle}>{isAdmin ? "Manage Parking Slots" : "Need a parking slot?"}</Text>
            <Text style={ps.ctaSub}>{isAdmin ? "Add slots or review pending resident requests." : "Submit a request and admin will assign a slot."}</Text>
            <Btn small onPress={() => setTab(isAdmin ? "requests" : undefined)}
              style={{ marginTop: 10, alignSelf: "flex-start" }}>
              {isAdmin ? "View Requests" : "Request a Slot"}
            </Btn>
          </View>
        </ScrollView>
      )}

      {tab === "slots"    && <SlotsTab isAdmin={isAdmin} key={refreshKey} />}
      {tab === "requests" && (!isAdmin ? <MyRequestsTab key={refreshKey} /> : <AdminRequestsTab slots={slots} key={refreshKey} />)}

      {/* Modals */}
      <RequestModal
        open={showRequest}
        onClose={() => setShowRequest(false)}
        summary={summary}
        onSubmitted={() => { setShowRequest(false); setTab("requests"); setRefreshKey(k => k + 1); }}
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