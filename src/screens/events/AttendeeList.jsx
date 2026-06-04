/**
 * screens/events/AttendeeList.jsx
 * 
 * Admin-only attendee list shown in EventDetailView.
 * Displays RSVPs with filtering by status.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from "react-native";

import { eventsApi } from "../../api/resources.api";
import { useToast } from "../../context/ToastContext";
import { Badge, EmptyState, ErrorState } from "../../components/ui";
import { C, RSVP_STATUS_COLOR, RSVP_LABEL } from "../../constants/theme";

/**
 * AttendeeList
 * Props: eventId (string)
 */
export const AttendeeList = ({ eventId }) => {
  const toast = useToast();
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.getOne(eventId);
      setRsvps(res.data?.event?.rsvps || []);
    } catch (e) {
      setError("Failed to load attendees.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = rsvps.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const shown = filter === "all" ? rsvps : rsvps.filter((r) => r.status === filter);

  const filterOptions = [
    { key: "all", label: `All (${rsvps.length})`, color: C.navy },
    { key: "going", label: `🎉 Going (${counts.going || 0})`, color: "#065F46" },
    { key: "maybe", label: `🤔 Maybe (${counts.maybe || 0})`, color: "#92400E" },
    { key: "not_going", label: `😕 Not (${counts.not_going || 0})`, color: C.gray500 },
  ];

  return (
    <View>
      {/* Summary chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {filterOptions.map(({ key, label, color }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filter === key ? color : C.gray100,
              },
            ]}
          >
            <Text
              style={[
                { fontSize: 11, fontWeight: "600" },
                { color: filter === key ? "#fff" : C.gray500 },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator size="small" color={C.teal} />
        </View>
      )}

      {error && !loading && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && shown.length === 0 && (
        <EmptyState
          icon="🙈"
          message={filter === "all" ? "No RSVPs yet." : `No "${filter}" responses.`}
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <View>
          {shown.map((r) => {
            const sc = RSVP_STATUS_COLOR[r.status] || {};
            const resident = r.resident || {};
            const initials = resident.name
              ? resident.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
              : "?";

            return (
              <View key={r._id} style={styles.attendeeRow}>
                {/* Avatar */}
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                    {initials}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>
                    {resident.name || "Resident"}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[resident.flat, resident.wing].filter(Boolean).join(" · ")}
                    {r.guestCount > 0 && ` · +${r.guestCount} guest${r.guestCount > 1 ? "s" : ""}`}
                  </Text>
                  {r.note && (
                    <Text style={styles.meta} numberOfLines={1}>
                      "{r.note}"
                    </Text>
                  )}
                </View>

                {/* Badge */}
                <Badge
                  label={RSVP_LABEL[r.status] || r.status}
                  bg={sc.bg}
                  text={sc.text}
                  dot={sc.dot}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0,
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.gray100,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  meta: {
    fontSize: 11,
    color: C.gray500,
    marginTop: 2,
  },
});