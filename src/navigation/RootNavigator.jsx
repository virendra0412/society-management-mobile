/**
 * navigation/RootNavigator.jsx
 * Root navigator — switches between Auth stack and App tabs
 * based on login state. Also handles the Pending Approval screen.
 *
 * Wires up notification deep-linking navigationRef here.
 */
import { useRef, useEffect }            from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth }          from "../context/AuthContext";
import { useSAAuth }        from "../context/SAAuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useLanguage }      from "../context/LanguageContext";
import { C }                from "../constants/theme";
import { AuthStack }        from "./AuthStack";
import { AppTabs }          from "./AppTabs";
import SASuperAdminApp      from "../screens/sa/SASuperAdminApp";

// ─── Custom nav theme (keeps background consistent) ───────────────────────────
const NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg },
};

// ─── Splash / Loading screen ─────────────────────────────────────────────────
const LoadingScreen = () => (
  <View style={styles.center}>
    <Text style={styles.logo}>🏘️</Text>
    <Text style={styles.appName}>SocietyApp</Text>
    <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
  </View>
);

// ─── Pending approval screen ──────────────────────────────────────────────────
const PendingScreen = ({ onLogout, t }) => (
  <SafeAreaView style={[styles.center, { backgroundColor: C.bg, paddingHorizontal: 32 }]}>
    <Text style={{ fontSize: 56, marginBottom: 16 }}>⏳</Text>
    <Text style={styles.pendingTitle}>{t("pending_title")}</Text>
    <Text style={styles.pendingBody}>{t("pending_body")}</Text>
    <View style={styles.pendingTip}>
      <Text style={{ fontSize: 13, color: C.gray700, lineHeight: 20 }}>
        {t("pending_tip")}
      </Text>
    </View>
    <TouchableOpacity onPress={onLogout} style={styles.signOutBtn}>
      <Text style={styles.signOutText}>{t("pending_sign_out")}</Text>
    </TouchableOpacity>
  </SafeAreaView>
);

// ─── Root ─────────────────────────────────────────────────────────────────────
export const RootNavigator = () => {
  const { user, loading, isLogged, isAdmin, logout } = useAuth();
  const { isLogged: isSALogged, loading: saLoading } = useSAAuth();
  const { navigationRef }  = useNotifications();
  const { t }              = useLanguage();
  const navRef             = useRef(null);

  // Wire navigation ref into NotificationContext for deep-linking
  useEffect(() => {
    navigationRef.current = navRef.current;
  }, [navigationRef]);

  // Show loading until both auth contexts are resolved
  const anyLoading = loading || saLoading;

  return (
    <NavigationContainer ref={navRef} theme={NavTheme}>
      {anyLoading
        ? <LoadingScreen />
        // SA portal — reached by navigating to /superadmin or via isSALogged state
        : isSALogged
          ? <SASuperAdminApp />
          : !isLogged
            ? <AuthStack />
            : (!user?.isApproved && !isAdmin)
              ? <PendingScreen onLogout={logout} t={t} />
              : <AppTabs />
      }
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.navy },
  logo:         { fontSize: 60, marginBottom: 12 },
  appName:      { fontSize: 26, fontWeight: "800", color: "#fff" },
  pendingTitle: { fontSize: 22, fontWeight: "800", color: C.navy, marginBottom: 12, textAlign: "center" },
  pendingBody:  { fontSize: 14, color: C.gray500, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  pendingTip:   { backgroundColor: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 28, width: "100%" },
  signOutBtn:   { backgroundColor: C.gray100, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  signOutText:  { fontSize: 13, fontWeight: "700", color: C.gray700 },
});