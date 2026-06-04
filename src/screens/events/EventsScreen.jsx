/**
 * screens/events/EventsScreen.jsx
 * 
 * Resident: Browse events, RSVP (going/maybe/not_going), see attendees
 * Admin:    Create/edit/publish/cancel events, manage RSVPs, view full attendee list
 * 
 * Covers all API calls:
 *   getAll, getOne, create, update, publish, cancel, rsvp, removeRsvp, getAttendees
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { eventsApi } from "../../api/resources.api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  Badge, Btn, Card, EmptyState, ErrorState,
  Spinner, Input,
} from "../../components/ui";
import {
  C,
  EVENT_CATEGORIES, EVENT_CATEGORY_ICON, EVENT_CATEGORY_COLOR,
  RSVP_STATUS_COLOR, RSVP_LABEL,
} from "../../constants/theme";
import { timeAgo } from "../../utils/timeago";
import { AttendeeList } from "./AttendeeList";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const fmtDateShort = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const isUpcoming = (event) => new Date(event.eventDate) >= new Date();

const localDateStr = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const localTimeStr = (iso) => {
  if (!iso) return "10:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════
// CATEGORY FILTER PILLS
// ═══════════════════════════════════════════════════════
const CategoryFilter = ({ selected, onChange }) => {
  const categories = ["All", ...EVENT_CATEGORIES];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: C.gray50, paddingVertical: 10 }}
      contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
    >
      {categories.map((cat) => {
        const active = selected === cat;
        const color = cat === "All" ? C.teal : EVENT_CATEGORY_COLOR[cat] || C.teal;
        const icon = cat === "All" ? null : EVENT_CATEGORY_ICON[cat];

        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onChange(cat)}
            style={[
              styles.categoryPill,
              {
                backgroundColor: active ? color : color + "15",
                borderColor: active ? color : color + "30",
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {icon && <Text style={{ fontSize: 14 }}>{icon}</Text>}
              <Text
                style={[
                  { fontSize: 11, fontWeight: "700" },
                  { color: active ? "#fff" : color },
                ]}
              >
                {cat}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ═══════════════════════════════════════════════════════
// RSVP COUNTS DISPLAY
// ═══════════════════════════════════════════════════════
const RsvpCounts = ({ summary = {}, maxAttendees }) => {
  const going = summary.going || 0;
  const maybe = summary.maybe || 0;
  const notGoing = summary.not_going || 0;
  const pct = maxAttendees > 0 ? Math.min(100, Math.round((going / maxAttendees) * 100)) : null;

  return (
    <Card style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 10 }}>
        📊 RSVPs
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {[
          { icon: "🎉", label: "Going", count: going, color: C.green },
          { icon: "🤔", label: "Maybe", count: maybe, color: C.amber },
          { icon: "😕", label: "Not Going", count: notGoing, color: C.gray500 },
        ].map(({ icon, label, count, color }) => (
          <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 10, backgroundColor: C.gray50, borderRadius: 10 }}>
            <Text style={{ fontSize: 18, marginBottom: 4 }}>{icon}</Text>
            <Text style={[{ fontSize: 18, fontWeight: "800" }, { color }]}>
              {count}
            </Text>
            <Text style={{ fontSize: 10, color: C.gray500, fontWeight: "600", marginTop: 2 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {maxAttendees > 0 && (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: C.gray500 }}>Capacity</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: going >= maxAttendees ? C.red : C.gray700 }}>
              {going} / {maxAttendees}
            </Text>
          </View>
          <View style={{ height: 5, backgroundColor: C.gray100, borderRadius: 2.5, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                width: `${pct}%`,
                backgroundColor: pct >= 100 ? C.red : pct > 80 ? C.amber : C.green,
              }}
            />
          </View>
          {going >= maxAttendees && (
            <Text style={{ fontSize: 11, color: C.red, fontWeight: "600", marginTop: 6 }}>
              Event is at full capacity
            </Text>
          )}
        </View>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════════════════
// RSVP ACTION BUTTONS
// ═══════════════════════════════════════════════════════
const RsvpButtons = ({ event, onRsvp, onRemove, loading }) => {
  const [guestCount, setGuestCount] = useState(event.myRsvp?.guestCount || 1);
  const current = event.myRsvp?.status || null;
  const isFull = event.maxAttendees > 0 && (event.rsvpSummary?.going || 0) >= event.maxAttendees && current !== "going";

  const options = [
    { status: "going", icon: "🎉", label: "Going" },
    { status: "maybe", icon: "🤔", label: "Maybe" },
    { status: "not_going", icon: "😕", label: "Not Going" },
  ];

  return (
    <Card style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 10 }}>
        {current ? "Your RSVP" : "Will you attend?"}
      </Text>

      {/* Current RSVP banner */}
      {current && (() => {
        const sc = RSVP_STATUS_COLOR[current] || {};
        return (
          <View
            style={{
              backgroundColor: sc.bg,
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: sc.text }}>
              {RSVP_LABEL[current]}
              {current === "going" && event.myRsvp?.guestCount > 1 ? ` · ${event.myRsvp.guestCount} guests` : ""}
            </Text>
            <TouchableOpacity onPress={() => !loading && onRemove()} disabled={loading}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>
                {loading ? "..." : "Remove"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Status picker */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {options.map(({ status, icon, label }) => {
          const isActive = current === status;
          const disabled = isFull && status === "going";
          return (
            <TouchableOpacity
              key={status}
              onPress={() => !loading && !disabled && onRsvp({ status, guestCount })}
              disabled={loading || disabled}
              style={[
                styles.rsvpOption,
                {
                  backgroundColor: isActive ? C.teal : C.gray50,
                  borderColor: isActive ? C.teal : C.gray100,
                  opacity: disabled ? 0.45 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 18, marginBottom: 4 }}>{icon}</Text>
              <Text style={[{ fontSize: 11, fontWeight: "700" }, { color: isActive ? C.teal : C.gray500 }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Guest count stepper */}
      {(current === "going" || !current) && (
        <View style={{ marginBottom: isFull && current !== "going" ? 10 : 0 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: C.gray500, marginBottom: 8 }}>
            Number of guests (incl. you)
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setGuestCount((n) => Math.max(1, n - 1))}
              style={styles.guestBtn}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.gray700 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "800", color: C.navy, minWidth: 24, textAlign: "center" }}>
              {guestCount}
            </Text>
            <TouchableOpacity
              onPress={() => setGuestCount((n) => Math.min(20, n + 1))}
              style={styles.guestBtn}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.gray700 }}>+</Text>
            </TouchableOpacity>
            {!current && (
              <Btn
                small
                onPress={() => onRsvp({ status: "going", guestCount })}
                loading={loading}
                style={{ marginLeft: "auto" }}
              >
                🎉 RSVP
              </Btn>
            )}
          </View>
        </View>
      )}

      {isFull && current !== "going" && (
        <Text style={{ fontSize: 11, color: C.red, fontWeight: "600" }}>
          ⚠️ Event is full
        </Text>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════════════════
// EVENT LIST CARD
// ═══════════════════════════════════════════════════════
const EventCard = ({ event, onClick }) => {
  const upcoming = isUpcoming(event);
  const catColor = EVENT_CATEGORY_COLOR[event.category] || C.teal;
  const catIcon = EVENT_CATEGORY_ICON[event.category] || "📅";
  const sc = event.myRsvp ? RSVP_STATUS_COLOR[event.myRsvp.status] : null;

  return (
    <TouchableOpacity onPress={onClick} activeOpacity={0.7}>
      <Card style={{ opacity: event.isCancelled ? 0.6 : 1, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* Date box */}
          <View
            style={[
              styles.dateBox,
              {
                backgroundColor: event.isCancelled ? C.gray100 : catColor + "15",
              },
            ]}
          >
            <Text style={{ fontSize: 18 }}>{catIcon}</Text>
            <Text
              style={[
                styles.dateNum,
                {
                  color: event.isCancelled ? C.gray500 : catColor,
                },
              ]}
            >
              {new Date(event.eventDate).getDate()}
            </Text>
            <Text style={styles.dateMonth}>
              {new Date(event.eventDate).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            {/* Title + badges */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 6 }}>
              <Text
                style={[
                  styles.eventTitle,
                  { color: event.isCancelled ? C.gray500 : C.navy },
                ]}
                numberOfLines={2}
              >
                {event.title}
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {event.isCancelled && (
                  <Badge label="Cancelled" bg={C.red + "15"} text={C.red} />
                )}
                {!event.isPublished && !event.isCancelled && (
                  <Badge label="Draft" bg={C.amber + "20"} text={C.amber} />
                )}
                {sc && (
                  <Badge label={RSVP_LABEL[event.myRsvp.status]} bg={sc.bg} text={sc.text} />
                )}
              </View>
            </View>

            {/* Meta */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <Text style={styles.meta}>
                🕐 {event.isAllDay ? "All day" : fmtTime(event.eventDate)}
              </Text>
              {event.venue && (
                <Text style={styles.meta} numberOfLines={1}>
                  📍 {event.venue.slice(0, 30)}
                </Text>
              )}
            </View>

            {/* RSVP counts */}
            {(event.rsvpSummary?.going || 0) > 0 && (
              <View style={{ flexDirection: "row", gap: 8, fontSize: 11 }}>
                {(event.rsvpSummary?.going || 0) > 0 && (
                  <Text style={{ fontSize: 11, color: C.gray500 }}>
                    🎉 {event.rsvpSummary.going}
                  </Text>
                )}
                {(event.rsvpSummary?.maybe || 0) > 0 && (
                  <Text style={{ fontSize: 11, color: C.gray500 }}>
                    🤔 {event.rsvpSummary.maybe}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════
// EVENT DETAIL VIEW
// ═══════════════════════════════════════════════════════
const EventDetailView = ({ eventId, onBack, isAdmin }) => {
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventsApi.getOne(eventId);
      setEvent(res.data?.event);
    } catch (e) {
      toast.error("Failed to load event.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRsvp = async ({ status, guestCount }) => {
    setRsvpLoading(true);
    try {
      const res = await eventsApi.rsvp(event._id, {
        status,
        guestCount: status === "going" ? guestCount : undefined,
      });
      setEvent(res.data?.event);
      const msgs = {
        going: "You're going! 🎉",
        maybe: "Marked as maybe 🤔",
      };
      toast.success(msgs[status] || "RSVP updated.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "RSVP failed.");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleRemoveRsvp = async () => {
    setRsvpLoading(true);
    try {
      const res = await eventsApi.removeRsvp(event._id);
      setEvent(res.data?.event);
      toast.success("RSVP removed.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to remove RSVP.");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handlePublish = async () => {
    setActionBusy("publish");
    try {
      const res = await eventsApi.publish(event._id);
      setEvent(res.data?.event);
      toast.success("Event published!");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to publish.");
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancel = async () => {
    setActionBusy("cancel");
    try {
      const res = await eventsApi.cancel(event._id, cancelReason.trim());
      setEvent(res.data?.event);
      setShowCancelModal(false);
      setCancelReason("");
      toast.success("Event cancelled.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to cancel event.");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (!event) {
    return <ErrorState message="Event not found." onRetry={load} />;
  }

  const catColor = EVENT_CATEGORY_COLOR[event.category] || C.teal;
  const catIcon = EVENT_CATEGORY_ICON[event.category] || "📅";
  const upcoming = isUpcoming(event);
  const canRsvp = event.isPublished && !event.isCancelled && upcoming;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header banner */}
        <View
          style={{
            backgroundColor: event.isCancelled ? C.gray500 : catColor,
            paddingHorizontal: 16,
            paddingVertical: 24,
          }}
        >
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>← Back</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 44, marginBottom: 12 }}>{catIcon}</Text>

          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <Badge label={event.category} bg="rgba(255,255,255,0.2)" text="#fff" />
            {event.isCancelled && (
              <Badge label="Cancelled" bg={C.red + "80"} text="#fff" />
            )}
            {!event.isPublished && (
              <Badge label="Draft" bg={C.amber + "80"} text="#fff" />
            )}
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4, lineHeight: 26 }}>
            {event.title}
          </Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            By {event.createdBy?.name || "Admin"}
          </Text>
        </View>

        <View style={{ padding: 16, paddingBottom: 40 }}>
          {/* Event info card */}
          <Card style={{ marginBottom: 14 }}>
            {[
              ["📅", "Date", event.isAllDay ? fmtDate(event.eventDate) : `${fmtDate(event.eventDate)}, ${fmtTime(event.eventDate)}`],
              event.endDate && ["⏰", "Ends", event.isAllDay ? fmtDate(event.endDate) : `${fmtDateShort(event.endDate)}, ${fmtTime(event.endDate)}`],
              event.venue && ["📍", "Venue", event.venue],
              event.maxAttendees && ["👥", "Capacity", `${event.maxAttendees} people`],
            ]
              .filter(Boolean)
              .map(([icon, label, value]) => (
                <View key={label} style={{ paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.gray100 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: C.gray500, textTransform: "uppercase" }}>
                    {icon} {label}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, marginTop: 4 }}>
                    {value}
                  </Text>
                </View>
              ))}

            {/* Cancel reason */}
            {event.isCancelled && event.cancelReason && (
              <View style={{ backgroundColor: C.red + "10", borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 12, color: C.gray700 }}>
                  🚫 <Text style={{ fontWeight: "700" }}>Reason:</Text> {event.cancelReason}
                </Text>
              </View>
            )}
          </Card>

          {/* RSVP counts */}
          {event.isPublished && <RsvpCounts summary={event.rsvpSummary} maxAttendees={event.maxAttendees} />}

          {/* Attendee list (admin) */}
          {isAdmin && event.isPublished && (
            <Card style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 10 }}>
                👥 Attendees
              </Text>
              <AttendeeList eventId={event._id} />
            </Card>
          )}

          {/* RSVP buttons */}
          {canRsvp && (
            <RsvpButtons
              event={event}
              onRsvp={handleRsvp}
              onRemove={handleRemoveRsvp}
              loading={rsvpLoading}
            />
          )}

          {/* Past event notice */}
          {event.isPublished && !event.isCancelled && !upcoming && (
            <View style={{ backgroundColor: C.gray50, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 13, color: C.gray500, textAlign: "center" }}>
                This event has already taken place.
              </Text>
            </View>
          )}

          {/* Description */}
          {event.description && (
            <Card style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 8 }}>
                About
              </Text>
              <Text style={{ fontSize: 13, color: C.gray700, lineHeight: 20 }}>
                {event.description}
              </Text>
            </Card>
          )}

          {/* Rules */}
          {event.rules && (
            <View style={{ backgroundColor: C.amber + "10", borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.amber, marginBottom: 6 }}>
                📋 Rules
              </Text>
              <Text style={{ fontSize: 12, color: C.gray700, lineHeight: 18 }}>
                {event.rules}
              </Text>
            </View>
          )}

          {/* Admin actions */}
          {isAdmin && !event.isCancelled && (
            <Card style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.gray700, marginBottom: 10 }}>
                Admin Actions
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {!event.isPublished && (
                  <Btn
                    small
                    onPress={handlePublish}
                    loading={actionBusy === "publish"}
                    style={{ flex: 1 }}
                  >
                    📢 Publish
                  </Btn>
                )}
                <Btn
                  small
                  onPress={() => setShowCancelModal(true)}
                  loading={actionBusy === "cancel"}
                  style={{ flex: 1, backgroundColor: C.red + "20" }}
                >
                  <Text style={{ color: C.red, fontWeight: "700", fontSize: 11 }}>Cancel</Text>
                </Btn>
              </View>
            </Card>
          )}

          <Text style={{ fontSize: 11, color: C.gray400, textAlign: "center" }}>
            Posted {timeAgo(event.createdAt)}
          </Text>
        </View>
      </ScrollView>

      {/* Cancel modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Event</Text>

            <View style={{ backgroundColor: C.red + "10", borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ fontSize: 12, color: C.gray700 }}>
                ⚠️ All RSVPs will be notified.
              </Text>
            </View>

            <Input
              label="Reason (optional)"
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Venue unavailable..."
              multiline
              numberOfLines={3}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn
                onPress={() => setShowCancelModal(false)}
                style={{ flex: 1, backgroundColor: C.gray100 }}
              >
                <Text style={{ color: C.gray700, fontWeight: "700", fontSize: 11 }}>Keep</Text>
              </Btn>
              <Btn
                onPress={handleCancel}
                loading={actionBusy === "cancel"}
                style={{ flex: 1, backgroundColor: C.red }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Cancel Event</Text>
              </Btn>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// CREATE / EDIT EVENT MODAL
// ═══════════════════════════════════════════════════════
const EventFormModal = ({ open, editing, onClose, onSaved }) => {
  const toast = useToast();
  const blank = {
    title: "",
    category: "Festival",
    description: "",
    eventDate: new Date().toISOString().split("T")[0],
    eventTime: "10:00",
    endDate: "",
    endTime: "",
    venue: "",
    maxAttendees: "",
    rules: "",
    isAllDay: false,
  };
  const [form, setForm] = useState(blank);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title || "",
          category: editing.category || "Festival",
          description: editing.description || "",
          eventDate: localDateStr(editing.eventDate),
          eventTime: editing.isAllDay ? "10:00" : localTimeStr(editing.eventDate),
          endDate: editing.endDate ? localDateStr(editing.endDate) : "",
          endTime: editing.endDate ? localTimeStr(editing.endDate) : "",
          venue: editing.venue || "",
          maxAttendees: editing.maxAttendees ? String(editing.maxAttendees) : "",
          rules: editing.rules || "",
          isAllDay: editing.isAllDay || false,
        });
      } else {
        setForm(blank);
      }
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.eventDate) return toast.error("Date is required.");

    const dateStr = form.isAllDay ? form.eventDate : `${form.eventDate}T${form.eventTime}:00`;
    const endDateStr = form.endDate
      ? form.isAllDay
        ? form.endDate
        : `${form.endDate}T${form.endTime || "23:59"}:00`
      : undefined;

    const payload = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      eventDate: dateStr,
      endDate: endDateStr,
      venue: form.venue.trim() || undefined,
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : undefined,
      rules: form.rules.trim() || undefined,
      isAllDay: form.isAllDay,
    };

    setSubmitting(true);
    try {
      const res = editing
        ? await eventsApi.update(editing._id, payload)
        : await eventsApi.create(payload);
      toast.success(editing ? "Event updated." : "Event created as draft.");
      onSaved(res.data?.event);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.gray100, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.navy }}>
            {editing ? "Edit Event" : "Create Event"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 20, color: C.gray500 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
          <Input
            label="Title *"
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
            placeholder="Annual Diwali..."
          />

          <Text style={styles.label}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {EVENT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setForm((p) => ({ ...p, category: cat }))}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: form.category === cat ? C.teal : C.gray200,
                  backgroundColor: form.category === cat ? C.teal : "#fff",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: form.category === cat ? "#fff" : C.gray600 }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            placeholder="Tell residents what to expect..."
            multiline
            numberOfLines={3}
          />

          {/* All-day toggle */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700 }}>All Day Event</Text>
            <TouchableOpacity
              onPress={() => setForm((p) => ({ ...p, isAllDay: !p.isAllDay }))}
              style={{
                width: 40,
                height: 22,
                borderRadius: 11,
                backgroundColor: form.isAllDay ? C.teal : C.gray300,
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: "#fff",
                  marginLeft: form.isAllDay ? 20 : 2,
                }}
              />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Start Date *"
                value={form.eventDate}
                onChangeText={(v) => setForm((p) => ({ ...p, eventDate: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {!form.isAllDay && (
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Time"
                  value={form.eventTime}
                  onChangeText={(v) => setForm((p) => ({ ...p, eventTime: v }))}
                  placeholder="HH:MM"
                />
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="End Date"
                value={form.endDate}
                onChangeText={(v) => setForm((p) => ({ ...p, endDate: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {!form.isAllDay && (
              <View style={{ flex: 1 }}>
                <Input
                  label="End Time"
                  value={form.endTime}
                  onChangeText={(v) => setForm((p) => ({ ...p, endTime: v }))}
                  placeholder="HH:MM"
                />
              </View>
            )}
          </View>

          <Input
            label="Venue"
            value={form.venue}
            onChangeText={(v) => setForm((p) => ({ ...p, venue: v }))}
            placeholder="Clubhouse, Rooftop..."
          />

          <Input
            label="Max Attendees"
            value={form.maxAttendees}
            onChangeText={(v) => setForm((p) => ({ ...p, maxAttendees: v }))}
            placeholder="Leave blank for unlimited"
            keyboardType="number-pad"
          />

          <Input
            label="Rules / Notes"
            value={form.rules}
            onChangeText={(v) => setForm((p) => ({ ...p, rules: v }))}
            placeholder="Dress code, entry time..."
            multiline
            numberOfLines={3}
          />

          <Btn onPress={handleSave} loading={submitting} style={{ width: "100%", marginTop: 20 }}>
            {editing ? "Save Changes" : "Create Draft"}
          </Btn>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════
export const EventsScreen = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("upcoming");
  const [catFilter, setCatFilter] = useState("All");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { sort: tab === "upcoming" ? "eventDate" : "-eventDate", limit: 50 };
      if (catFilter !== "All") params.category = catFilter;
      const res = await eventsApi.getAll(params);
      const all = res.data?.events || [];
      const now = new Date();
      const filtered = all.filter((e) =>
        tab === "upcoming" ? new Date(e.eventDate) >= now : new Date(e.eventDate) < now
      );
      setEvents(filtered);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [tab, catFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleSaved = (event) => {
    setEvents((p) => {
      const idx = p.findIndex((e) => e._id === event._id);
      if (idx >= 0) {
        const n = [...p];
        n[idx] = event;
        return n;
      }
      return [event, ...p];
    });
  };

  // Detail view
  if (view.startsWith("detail:")) {
    return (
      <EventDetailView
        eventId={view.replace("detail:", "")}
        onBack={() => setView("list")}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>SOCIETY</Text>
          <Text style={styles.headerTitle}>🎉 Events</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            style={styles.createBtn}
          >
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {["upcoming", "past"].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category filter */}
      <CategoryFilter selected={catFilter} onChange={setCatFilter} />

      {/* Event list */}
      <FlatList
        data={events}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <EventCard event={item} onClick={() => setView(`detail:${item._id}`)} />
        )}
        ListHeaderComponent={
          <>
            {loading && (
              <View style={{ padding: 16, gap: 10 }}>
                {[1, 2, 3].map((k) => (
                  <View
                    key={k}
                    style={{
                      height: 100,
                      backgroundColor: C.gray100,
                      borderRadius: 12,
                    }}
                  />
                ))}
              </View>
            )}
            {error && !loading && (
              <View style={{ padding: 16 }}>
                <ErrorState message={error} onRetry={loadEvents} />
              </View>
            )}
            {!loading && !error && events.length === 0 && (
              <View style={{ padding: 16 }}>
                <EmptyState
                  icon={tab === "upcoming" ? "🗓️" : "📂"}
                  message={
                    tab === "upcoming"
                      ? isAdmin
                        ? "No upcoming events. Create one!"
                        : "No upcoming events."
                      : "No past events."
                  }
                />
              </View>
            )}
          </>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 40 }}
        scrollEnabled={!loading}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />
        }
      />

      {/* Modals */}
      <EventFormModal
        open={showForm}
        editing={editTarget}
        onClose={() => {
          setShowForm(false);
          setEditTarget(null);
        }}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },
  createBtn: { backgroundColor: C.amber, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  createBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  tabBar: { flexDirection: "row", backgroundColor: C.navy, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: C.amber },
  tabText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.4)" },
  tabTextActive: { color: "#fff" },
  categoryPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  dateBox: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 8, flexShrink: 0 },
  dateNum: { fontSize: 15, fontWeight: "800", lineHeight: 18 },
  dateMonth: { fontSize: 9, fontWeight: "700", color: C.gray500, textTransform: "uppercase", marginTop: 2 },
  eventTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  meta: { fontSize: 11, color: C.gray500, fontWeight: "500" },
  rsvpOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  guestBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: C.gray100, backgroundColor: C.gray50, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "700", color: C.navy, marginBottom: 10, marginTop: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "80%" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.navy, marginBottom: 14 },
});