/**
 * components/ui/index.jsx
 * Core UI primitives — React Native equivalents of the web ui/index.jsx.
 * Same component names, same props — makes feature porting straightforward.
 *
 * Web → RN swap cheatsheet:
 *   div          → View
 *   span / p     → Text
 *   button       → TouchableOpacity + Text
 *   input        → TextInput
 *   img          → Image
 *   style="..."  → StyleSheet.create({}) or inline objects with numeric values
 *
 * Added in this revision (previously missing from mobile port):
 *   Tag      — coloured label chip (used by notices, events, contacts)
 *   Avatar   — initials or image avatar with optional size/colour override
 *   Select   — horizontal pill-based option picker (replaces <select> from web)
 *   Skeleton — animated loading placeholder bar / circle
 */
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ScrollView, Image, Animated, useEffect,
} from "react-native";
import { useEffect as useRNEffect, useRef } from "react";
import { C } from "../../constants/theme";

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Badge = ({ label, bg, text, dot }) => (
  <View style={[styles.badge, { backgroundColor: bg || "#EEE" }]}>
    {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
    <Text style={[styles.badgeText, { color: text || "#333" }]}>{label}</Text>
  </View>
);

// ─── Tag ─────────────────────────────────────────────────────────────────────
// Slightly larger than Badge — used for category labels, notice tags, etc.
// Props: label, color (hex — used as border + text, background at 15% opacity)
export const Tag = ({ label, color = C.teal, style }) => (
  <View style={[
    tagStyles.wrap,
    { backgroundColor: color + "18", borderColor: color + "40" },
    style,
  ]}>
    <Text style={[tagStyles.text, { color }]}>{label}</Text>
  </View>
);

const tagStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});

// ─── Avatar ───────────────────────────────────────────────────────────────────
// Shows a photo (uri) when available; falls back to coloured initials.
// Props: uri?, name, size (default 36), color (ring/bg tint, default C.teal)
export const Avatar = ({ uri, name = "?", size = 36, color = C.teal, style }) => {
  const initials = String(name)
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          { width: size, height: size, borderRadius: radius, borderWidth: 2, borderColor: color + "30" },
          style,
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[
      avatarStyles.wrap,
      { width: size, height: size, borderRadius: radius, backgroundColor: color + "20" },
      style,
    ]}>
      <Text style={[avatarStyles.text, { color, fontSize: size * 0.34 }]}>
        {initials}
      </Text>
    </View>
  );
};

const avatarStyles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "800" },
});

// ─── Select ───────────────────────────────────────────────────────────────────
// Horizontal scrollable pill picker — drop-in replacement for web <Select>.
// Props: label?, value, options (string[] or {label,value}[]), onChange, style
export const Select = ({ label, value, options = [], onChange, style }) => {
  const normalised = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );

  return (
    <View style={[selectStyles.wrap, style]}>
      {label ? <Text style={selectStyles.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={selectStyles.row}>
          {normalised.map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onChange(opt.value)}
                activeOpacity={0.75}
                style={[selectStyles.pill, active && selectStyles.pillActive]}
              >
                <Text style={[selectStyles.pillText, active && selectStyles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const selectStyles = StyleSheet.create({
  wrap:          { marginBottom: 14 },
  label:         { fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 },
  row:           { flexDirection: "row", gap: 8 },
  pill:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.gray100 },
  pillActive:    { backgroundColor: C.navy, borderColor: C.navy },
  pillText:      { fontSize: 13, fontWeight: "600", color: C.gray700 },
  pillTextActive:{ color: "#fff" },
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────
// Animated shimmer placeholder for loading states.
// Props: width, height (default 16), borderRadius (default 8), style
export const Skeleton = ({ width = "100%", height = 16, borderRadius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useRNEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        skeletonStyles.base,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};

const skeletonStyles = StyleSheet.create({
  base: { backgroundColor: C.gray100 },
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 24, color = C.teal }) => (
  <ActivityIndicator size={size > 28 ? "large" : "small"} color={color} />
);

// ─── Btn ──────────────────────────────────────────────────────────────────────
export const Btn = ({
  children, onPress, loading, disabled, variant = "primary",
  style, small,
}) => {
  const bg = {
    primary: C.teal,
    ghost:   "transparent",
    danger:  C.red,
    outline: "transparent",
  }[variant] ?? C.teal;

  const tc = {
    primary: "#fff",
    ghost:   C.teal,
    danger:  "#fff",
    outline: C.teal,
  }[variant] ?? "#fff";

  const border = variant === "outline" ? { borderWidth: 1.5, borderColor: C.teal } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        { backgroundColor: bg, ...border },
        small && { paddingVertical: 6, paddingHorizontal: 12 },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={tc} />
        : <Text style={[styles.btnText, { color: tc, fontSize: small ? 12 : 14 }]}>
            {children}
          </Text>
      }
    </TouchableOpacity>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = ({
  label, value, onChangeText, placeholder, error,
  secureTextEntry, keyboardType, multiline, editable = true,
  style,
}) => (
  <View style={[styles.inputWrap, style]}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.gray300}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
      editable={editable}
      style={[
        styles.input,
        multiline    && { height: 80, textAlignVertical: "top" },
        error        && { borderColor: C.red },
        !editable    && { opacity: 0.55 },
      ]}
    />
    {error && <Text style={styles.inputError}>{error}</Text>}
  </View>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
};

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export const SectionTitle = ({ children, style }) => (
  <Text style={[styles.sectionTitle, style]}>{children}</Text>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = "📭", message, action }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyText}>{message}</Text>
    {action}
  </View>
);

// ─── ErrorState ───────────────────────────────────────────────────────────────
export const ErrorState = ({ message, onRetry }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>⚠️</Text>
    <Text style={[styles.emptyText, { color: C.red }]}>{message}</Text>
    {onRetry && (
      <Btn variant="outline" onPress={onRetry} small style={{ marginTop: 12 }}>
        Retry
      </Btn>
    )}
  </View>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
import { Modal as RNModal, KeyboardAvoidingView, Platform, Pressable } from "react-native";

export const Modal = ({ open, onClose, title, children }) => (
  <RNModal
    visible={!!open}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalOverlay}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        {/* Handle bar */}
        <View style={styles.modalHandle} />
        {title && (
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </RNModal>
);

// ─── ScreenHeader ─────────────────────────────────────────────────────────────
export const ScreenHeader = ({ title, subtitle, action, style }) => (
  <View style={[styles.screenHeader, style]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle && <Text style={styles.screenSub}>{subtitle}</Text>}
    </View>
    {action}
  </View>
);

// ─── FilterPill ───────────────────────────────────────────────────────────────
export const FilterPill = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={[styles.pill, active && styles.pillActive]}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Badge
  badge:       { flexDirection:"row", alignItems:"center", paddingHorizontal:8, paddingVertical:3, borderRadius:20 },
  dot:         { width:6, height:6, borderRadius:3, marginRight:4 },
  badgeText:   { fontSize:11, fontWeight:"700" },

  // Btn
  btn:         { paddingVertical:10, paddingHorizontal:18, borderRadius:10, alignItems:"center", justifyContent:"center" },
  btnText:     { fontWeight:"700" },

  // Input
  inputWrap:   { marginBottom:14 },
  inputLabel:  { fontSize:12, fontWeight:"600", color:C.gray700, marginBottom:5 },
  input:       { borderWidth:1.5, borderColor:C.gray100, borderRadius:10, padding:11, fontSize:14, color:C.text, backgroundColor:"#fff" },
  inputError:  { fontSize:11, color:C.red, marginTop:3 },

  // Card
  card:        { backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:10, borderWidth:1, borderColor:C.gray100 },

  // Section
  sectionTitle:{ fontSize:12, fontWeight:"700", color:C.gray700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 },

  // Empty / Error
  empty:       { alignItems:"center", paddingVertical:40, paddingHorizontal:20 },
  emptyIcon:   { fontSize:36, marginBottom:10 },
  emptyText:   { fontSize:14, color:C.gray500, textAlign:"center", lineHeight:22 },

  // Modal
  modalOverlay: { flex:1, justifyContent:"flex-end" },
  modalBackdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.5)" },
  modalSheet:   { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, maxHeight:"90%", minHeight:200 },
  modalHandle:  { width:40, height:4, borderRadius:2, backgroundColor:C.gray100, alignSelf:"center", marginBottom:16 },
  modalHeader:  { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 },
  modalTitle:   { fontSize:17, fontWeight:"800", color:C.navy },
  modalClose:   { fontSize:18, color:C.gray500, padding:4 },

  // ScreenHeader
  screenHeader: { paddingHorizontal:16, paddingTop:16, paddingBottom:12, flexDirection:"row", alignItems:"center" },
  screenTitle:  { fontSize:22, fontWeight:"800", color:C.navy },
  screenSub:    { fontSize:12, color:C.gray500, marginTop:2 },

  // FilterPill
  pill:         { paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1.5, borderColor:C.gray100, marginRight:8 },
  pillActive:   { backgroundColor:C.navy, borderColor:C.navy },
  pillText:     { fontSize:12, fontWeight:"600", color:C.gray700 },
  pillTextActive:{ color:"#fff" },
});