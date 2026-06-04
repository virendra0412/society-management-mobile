/**
 * context/ToastContext.jsx
 * In-app toast notifications for React Native.
 * Uses an Animated overlay — no external library needed.
 * API identical to web: toast.success / toast.error / toast.info
 */
import { createContext, useContext, useState, useRef, useCallback } from "react";
import {
  Animated, Text, View, StyleSheet, SafeAreaView,
} from "react-native";
import { C } from "../constants/theme";

const ToastContext = createContext(null);

const TYPES = {
  success: { bg: C.green,  icon: "✅" },
  error:   { bg: C.red,    icon: "❌" },
  info:    { bg: C.teal,   icon: "ℹ️"  },
  warning: { bg: C.amber,  icon: "⚠️" },
};

const Toast = ({ message, type = "info", visible }) => {
  const t = TYPES[type] ?? TYPES.info;
  if (!visible || !message) return null;
  return (
    <View style={[styles.toast, { backgroundColor: t.bg }]}>
      <Text style={styles.icon}>{t.icon}</Text>
      <Text style={styles.msg} numberOfLines={3}>{message}</Text>
    </View>
  );
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ message: "", type: "info", visible: false });
  const timer = useRef(null);

  const show = useCallback((message, type = "info", duration = 3000) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type, visible: true });
    timer.current = setTimeout(() => {
      setToast((p) => ({ ...p, visible: false }));
    }, duration);
  }, []);

  const success = useCallback((m) => show(m, "success"), [show]);
  const error   = useCallback((m) => show(m, "error"),   [show]);
  const info    = useCallback((m) => show(m, "info"),     [show]);
  const warning = useCallback((m) => show(m, "warning"),  [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toast: {
    position:     "absolute",
    bottom:       90,
    left:         16,
    right:        16,
    flexDirection:"row",
    alignItems:   "center",
    gap:          10,
    borderRadius: 12,
    padding:      14,
    zIndex:       9999,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity:0.2,
    shadowRadius: 8,
    elevation:    8,
  },
  icon: { fontSize: 16 },
  msg:  { flex: 1, color: "#fff", fontSize: 13, fontWeight: "600" },
});

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};