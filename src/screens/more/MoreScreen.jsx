import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth }     from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import { C }           from "../../constants/theme";

// Screens reachable from More
import { NoticesScreen }  from "./NoticesScreen";
import { HelpScreen }     from "./HelpScreen";
import { ContactsScreen } from "./ContactsScreen";
import { PollsScreen }    from "./PollsScreen";
import { ProfileScreen }  from "./ProfileScreen";
import UpgradeScreen      from "./UpgradeScreen";

// Screens that were built but not wired (Events / Parking / Amenity)
import { EventsScreen }  from "../events/EventsScreen";
import { ParkingScreen } from "../parking/ParkingScreen";
import { AmenityScreen } from "../amenity/AmenityScreen";
import { AdminScreen }   from "./AdminScreen";
import { PrivacyPolicyScreen } from "../legal/PrivacyPolicyScreen";
import { TermsScreen }         from "../legal/TermsScreen";

const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 56) / 3;

const SCREEN_TITLES = {
  Notices:          "Notices",
  Help:             "Community Help",
  Contacts:         "Contacts",
  Polls:            "Polls",
  Events:           "Events",
  Parking:          "Parking",
  Amenity:          "Amenities",
  Profile:          "Profile",
  Committee:        "Committee",
  Upgrade:          "Upgrades",
  PrivacyPolicy:    "Privacy Policy",
  Terms:            "Terms & Conditions",
};

// ─── MoreScreen ───────────────────────────────────────────────────────────────

// ─── Module tile ──────────────────────────────────────────────────────────────
const ModuleTile = ({ icon, label, color, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[tileStyles.tile, { backgroundColor: color + "0F", borderColor: color + "25" }]}>
    <Text style={tileStyles.icon}>{icon}</Text>
    <Text style={[tileStyles.label, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const tileStyles = StyleSheet.create({
  tile:  { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 6 },
  icon:  { fontSize: 28 },
  label: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});

// ─── More Grid ────────────────────────────────────────────────────────────────
const MoreGrid = () => {
  const navigation = useNavigation();
  const { user, isAdmin }   = useAuth();
  const { t }      = useLanguage();

  const MODULES = [
    { id: "Notices",  icon: "📢", label: t("nav_notices"),  color: C.teal   },
    { id: "Help",     icon: "🤝", label: t("nav_help"),     color: C.amber  },
    { id: "Contacts", icon: "📞", label: t("nav_contacts"), color: C.green  },
    { id: "Polls",    icon: "🗳️", label: t("nav_polls"),    color: C.purple },
    { id: "Events",   icon: "🎉", label: t("nav_events",  "Events"),  color: "#D97706" },
    { id: "Parking",  icon: "🚗", label: t("nav_parking", "Parking"), color: C.navy   },
    { id: "Amenity",  icon: "🏊", label: t("nav_amenities", "Amenities"), color: C.teal   },
    { id: "Profile",  icon: "👤", label: t("btn_profile"),  color: C.gray700 },
    // Legal — always visible
    { id: "PrivacyPolicy", icon: "🔒", label: t("nav_privacy_policy", "Privacy Policy"), color: C.gray700 },
    { id: "Terms",         icon: "📄", label: t("nav_terms", "Terms & Conditions"), color: C.gray700 },
    // Admin-only: Committee management
    ...(isAdmin ? [
      { id: "Committee", icon: "🛡️", label: t("nav_committee", "Committee"), color: C.purple },
      { id: "Upgrade",   icon: "⬆️", label: t("nav_upgrades", "Upgrades"),  color: C.amber },
    ] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={gridStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={gridStyles.title}>{t("nav_more", "More")}</Text>
          <Text style={gridStyles.sub}>{user?.society?.name}</Text>
        </View>
        {/* Language picker — tap to open bottom-sheet with all 3 options */}
        <LanguageDropdown />
      </View>
      <ScrollView contentContainerStyle={gridStyles.grid} showsVerticalScrollIndicator={false}>
        {MODULES.map((m) => (
          <ModuleTile
            key={m.id}
            {...m}
            onPress={() => navigation.navigate(m.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const gridStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center" },
  title:  { fontSize: 24, fontWeight: "800", color: C.navy },
  sub:    { fontSize: 13, color: C.gray500, marginTop: 2 },
  grid:   { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingBottom: 32 },
});

// ─── Stack navigator wrapping More grid + sub-screens ────────────────────────
const Stack = createNativeStackNavigator();

export const MoreScreen = () => (
  <Stack.Navigator
    screenOptions={({ navigation, route }) => {
      const showHeader = route.name !== "MoreGrid";
      return {
        headerShown: showHeader,
        headerTitle: SCREEN_TITLES[route.name] || route.name,
        headerTitleAlign: "center",
        headerTitleStyle: { fontSize: 16, fontWeight: "700", color: C.navy },
        headerStyle: {
          backgroundColor: C.bg,
          shadowColor: "transparent",
          elevation: 0,
          borderBottomColor: "rgba(0,0,0,0.08)",
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        headerLeft: showHeader
          ? () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 10 }}>
                <Ionicons name="chevron-back" size={22} color={C.navy} />
              </TouchableOpacity>
            )
          : undefined,
      };
    }}
  >
    <Stack.Screen name="MoreGrid"   component={MoreGrid} />
    <Stack.Screen name="Notices"    component={NoticesScreen} />
    <Stack.Screen name="Help"       component={HelpScreen} />
    <Stack.Screen name="Contacts"   component={ContactsScreen} />
    <Stack.Screen name="Polls"      component={PollsScreen} />
    <Stack.Screen name="Events"     component={EventsScreen} />
    <Stack.Screen name="Parking"    component={ParkingScreen} />
    <Stack.Screen name="Amenity"    component={AmenityScreen} />
    <Stack.Screen name="Profile"    component={ProfileScreen} />
    <Stack.Screen name="Committee"  component={AdminScreen} />
    <Stack.Screen name="Upgrade"    component={UpgradeScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <Stack.Screen name="Terms"         component={TermsScreen} />
  </Stack.Navigator>
);