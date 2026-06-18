/**
 * navigation/RootNavigator.jsx
 *
 * CHANGED IN TASK 1:
 *   - Added Linking.addEventListener for deep links arriving while app is open
 *   - Added Linking.getInitialURL() for cold-start deep links
 *   - Both paths call useInviteLink().parseInviteUrl() which handles
 *     societyapp://join-invite/TOKEN links
 *
 * All existing screens, logic, and styles are IDENTICAL to the original.
 */

import { useRef, useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView }      from "react-native-safe-area-context";
import * as Linking          from "expo-linking";

import { useAuth }           from "../context/AuthContext";
import { useSAAuth }         from "../context/SAAuthContext";
import { useNotifications }  from "../context/NotificationContext";
import { useLanguage }       from "../context/LanguageContext";
import { C }                 from "../constants/theme";
import { AuthStack }         from "./AuthStack";
import { AppTabs }           from "./AppTabs";
import SALoginScreen         from "../screens/sa/SALoginScreen";
import SASuperAdminApp       from "../screens/sa/SASuperAdminApp";
import { AppLogo }           from "../components/ui/AppLogo";
import { useInviteLink }     from "../hooks/useInviteLink";  // NEW

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

// ─── Multi-society selector (shown once after login when user has 2+ societies) ─
const SocietySelectorScreen = ({ memberships, activeSocietyId, onSelect, onContinue, loading, t }) => (
  <SafeAreaView style={[styles.center, { backgroundColor: C.bg, paddingHorizontal: 24 }]}>
    <Text style={{ fontSize: 32, marginBottom: 12 }}>🏘️</Text>
    <Text style={styles.selectorTitle}>{t("selector_title", "Choose your society")}</Text>
    <Text style={styles.selectorSubtitle}>
      {t("selector_subtitle", "You are a member of multiple societies. Pick one to continue.")}
    </Text>
    <ScrollView style={{ width: "100%", marginBottom: 16 }} showsVerticalScrollIndicator={false}>
      {memberships.map((m) => {
        const sid    = m.society?._id?.toString() || m.society?.toString();
        const name   = m.society?.name  || t("selector_unknown_society", "Unknown Society");
        const flat   = m.flat  ? `Flat ${m.flat}` : "";
        const wing   = m.wing  ? `, Wing ${m.wing}` : "";
        const active = sid === activeSocietyId;
        return (
          <TouchableOpacity
            key={sid}
            style={[styles.selectorCard, active && styles.selectorCardActive]}
            onPress={() => onSelect(sid)}
            activeOpacity={0.75}
            disabled={loading}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectorName, active && styles.selectorNameActive]}>{name}</Text>
              {(flat || wing) ? (
                <Text style={styles.selectorFlat}>{flat}{wing}</Text>
              ) : null}
            </View>
            {active && (
              <View style={styles.selectorCheck}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
    <TouchableOpacity
      style={[styles.selectorContinue, loading && { opacity: 0.6 }]}
      onPress={onContinue}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.selectorContinueText}>{t("selector_continue", "Continue ->")}</Text>}
    </TouchableOpacity>
  </SafeAreaView>
);

// ─── Auth screen wrapper ──────────────────────────────────────────────────────
const AuthScreenWithSALink = ({ onSAPress, t }) => (
  <View style={{ flex: 1 }}>
    <AuthStack />
    <View style={styles.saContainer}>
      <Text style={styles.saLabel}>{t("sa_admin_label", "Platform Administrator?")}</Text>
      <TouchableOpacity onPress={onSAPress} style={styles.saLink} activeOpacity={0.85}>
        <Text style={styles.saLinkText}>{t("sa_login_link", "Login as Super Admin")}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Root ─────────────────────────────────────────────────────────────────────
export const RootNavigator = () => {
  const { user, loading, isLogged, isAdmin, logout, activeSocietyId, memberships, switchSociety } = useAuth();
  const { isLogged: isSALogged, loading: saLoading } = useSAAuth();
  const { navigationRef }  = useNotifications();
  const { t }              = useLanguage();
  const navRef             = useRef(null);

  const [showSALogin, setShowSALogin]             = useState(false);
  // TC-MS-001: show society picker on first login when user has 2+ societies
  const [showSocietySelector, setShowSocietySelector] = useState(false);
  const [selectorSwitching, setSelectorSwitching]     = useState(false);
  const selectorShownRef = useRef(false);

  // ── Invite link handler (NEW) ───────────────────────────────────────────────
  const { parseInviteUrl } = useInviteLink(navRef);

  // ── TC-MS-001: Show society selector once after login for multi-society users ─
  useEffect(() => {
    if (
      isLogged &&
      !loading &&
      !selectorShownRef.current &&
      memberships &&
      memberships.filter((m) => m.isApproved).length > 1
    ) {
      selectorShownRef.current = true;
      setShowSocietySelector(true);
    }
    // Reset when user logs out so next login shows picker again
    if (!isLogged) {
      selectorShownRef.current = false;
      setShowSocietySelector(false);
    }
  }, [isLogged, loading, memberships]);

  useEffect(() => {
    navigationRef.current = navRef.current;
  }, [navigationRef]);

  // ── Deep-link: cold start (app was closed) ──────────────────────────────────
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) parseInviteUrl(url, navRef.current);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deep-link: app already open (foreground / background) ──────────────────
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      parseInviteUrl(url, navRef.current);
    });
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyLoading = loading || saLoading;

  const activeMembership = memberships?.find(
    (m) =>
      m.society?._id?.toString() === activeSocietyId ||
      m.society?.toString()      === activeSocietyId
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
        <AuthScreenWithSALink onSAPress={() => setShowSALogin(true)} t={t} />

      ) : (!isApproved && !isAdmin) ? (
        <PendingScreen onLogout={logout} t={t} />

      ) : (showSocietySelector && memberships?.filter((m) => m.isApproved).length > 1) ? (
        <SocietySelectorScreen
          memberships={memberships.filter((m) => m.isApproved)}
          activeSocietyId={activeSocietyId}
          loading={selectorSwitching}
          onSelect={async (sid) => {
            if (sid === activeSocietyId) return;
            setSelectorSwitching(true);
            try { await switchSociety(sid); } catch { /* silent — user can retry */ }
            finally { setSelectorSwitching(false); }
          }}
          onContinue={() => setShowSocietySelector(false)}
        />

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

  selectorTitle:        { fontSize: 22, fontWeight: "800", color: C.navy, marginBottom: 6, textAlign: "center" },
  selectorSubtitle:     { fontSize: 13, color: C.gray500, textAlign: "center", lineHeight: 19, marginBottom: 20 },
  selectorCard:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: C.gray100 },
  selectorCardActive:   { borderColor: C.teal, backgroundColor: "#E6F9F6" },
  selectorName:         { fontSize: 15, fontWeight: "700", color: C.navy },
  selectorNameActive:   { color: C.teal },
  selectorFlat:         { fontSize: 12, color: C.gray500, marginTop: 3 },
  selectorCheck:        { width: 26, height: 26, borderRadius: 13, backgroundColor: C.teal, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  selectorContinue:     { backgroundColor: C.navy, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", width: "100%" },
  selectorContinueText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  saContainer: {
    paddingHorizontal: 24,
    paddingBottom:     24,
    paddingTop:        8,
    backgroundColor:   C.bg,
  },
  saLabel: {
    fontSize:    12,
    color:       C.gray500,
    textAlign:   "center",
    marginBottom: 8,
  },
  saLink: {
    paddingVertical: 14,
    borderRadius:    12,
    backgroundColor: C.navy,
    alignItems:      "center",
  },
  saLinkText: {
    fontSize:   14,
    fontWeight: "700",
    color:      "#fff",
  },
});