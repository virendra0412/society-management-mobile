/**
 * navigation/RootNavigator.jsx
 */
import { useRef, useEffect, useState } from "react";
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
import SALoginScreen        from "../screens/sa/SALoginScreen";
import SASuperAdminApp      from "../screens/sa/SASuperAdminApp";
import { AppLogo }          from "../components/ui/AppLogo";

const NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg },
};

// ─── Loading screen ───────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <View style={styles.center}>
    <AppLogo size="lg" dark={false} tagline />
    <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
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

// ─── Auth screen wrapper — regular login + SA link below ─────────────────────
const AuthScreenWithSALink = ({ onSAPress }) => (
  <View style={{ flex: 1 }}>
    <AuthStack />
    <View style={styles.saContainer}>
      <Text style={styles.saLabel}>Platform Administrator?</Text>
      <TouchableOpacity onPress={onSAPress} style={styles.saLink} activeOpacity={0.85}>
        <Text style={styles.saLinkText}>🛡️  Login as Super Admin</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Root ─────────────────────────────────────────────────────────────────────
export const RootNavigator = () => {
  const { user, loading, isLogged, isAdmin, logout, activeSocietyId, memberships } = useAuth();
  const { isLogged: isSALogged, loading: saLoading } = useSAAuth();
  const { navigationRef } = useNotifications();
  const { t }             = useLanguage();
  const navRef            = useRef(null);

  const [showSALogin, setShowSALogin] = useState(false);

  useEffect(() => {
    navigationRef.current = navRef.current;
  }, [navigationRef]);

  const anyLoading = loading || saLoading;

  // isApproved lives inside memberships[] in the new schema
  const activeMembership = memberships?.find(
    (m) => m.society?._id?.toString() === activeSocietyId ||
           m.society?.toString()       === activeSocietyId
  );
  const isApproved = activeMembership?.isApproved ?? user?.isApproved ?? false;

  return (
    <NavigationContainer ref={navRef} theme={NavTheme}>
      {anyLoading ? (
        <LoadingScreen />

      ) : isSALogged ? (
        <SASuperAdminApp />

      ) : showSALogin ? (
        <SALoginScreen onBack={() => setShowSALogin(false)} />

      ) : !isLogged ? (
        <AuthScreenWithSALink onSAPress={() => setShowSALogin(true)} />

      ) : (!isApproved && !isAdmin) ? (
        <PendingScreen onLogout={logout} t={t} />

      ) : (
        <AppTabs />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center:       { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.navy },
  pendingTitle: { fontSize: 22, fontWeight: "800", color: C.navy, marginBottom: 12, textAlign: "center" },
  pendingBody:  { fontSize: 14, color: C.gray500, textAlign: "center", lineHeight: 22, marginBottom: 20 },
  pendingTip:   { backgroundColor: "#FEF3C7", borderRadius: 12, padding: 14, marginBottom: 28, width: "100%" },
  signOutBtn:   { backgroundColor: C.gray100, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  signOutText:  { fontSize: 13, fontWeight: "700", color: C.gray700 },

  saContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: C.bg,
  },
  saLabel: {
    fontSize: 12,
    color: C.gray500,
    textAlign: "center",
    marginBottom: 8,
  },
  saLink: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.navy,
    alignItems: "center",
  },
  saLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});