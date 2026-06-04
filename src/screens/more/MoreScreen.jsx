import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal } from "react-native";
import { SafeAreaView }   from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation }  from "@react-navigation/native";

import { useAuth }     from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { C }           from "../../constants/theme";

// Screens reachable from More
import { NoticesScreen }  from "./NoticesScreen";
import { HelpScreen }     from "./HelpScreen";
import { ContactsScreen } from "./ContactsScreen";
import { PollsScreen }    from "./PollsScreen";
import { ProfileScreen }  from "./ProfileScreen";

const { width } = Dimensions.get("window");
const TILE_SIZE = (width - 56) / 3;

// ─── Language options ─────────────────────────────────────────────────────────
const LOCALES = [
  { code: "en", native: "English",  label: "English"  },
  { code: "hi", native: "हिंदी",    label: "Hindi"    },
  { code: "gu", native: "ગુજરાતી", label: "Gujarati" },
];

// ─── Language Dropdown ────────────────────────────────────────────────────────
// Tapping the pill opens a bottom-sheet with all 3 options visible at once.
const LanguageDropdown = () => {
  const { locale, changeLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <>
      {/* Trigger pill */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={dropStyles.pill}
      >
        <Text style={dropStyles.pillText}>🌐 {current.native}</Text>
        <Text style={dropStyles.arrow}>▾</Text>
      </TouchableOpacity>

      {/* Bottom-sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={dropStyles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={dropStyles.sheet}>
            <Text style={dropStyles.sheetTitle}>Select Language</Text>
            {LOCALES.map((loc) => {
              const active = locale === loc.code;
              return (
                <TouchableOpacity
                  key={loc.code}
                  onPress={() => { changeLocale(loc.code); setOpen(false); }}
                  activeOpacity={0.75}
                  style={[dropStyles.option, active && dropStyles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[dropStyles.optionNative, active && { color: C.teal }]}>
                      {loc.native}
                    </Text>
                    <Text style={dropStyles.optionLabel}>{loc.label}</Text>
                  </View>
                  {active && <Text style={dropStyles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const dropStyles = StyleSheet.create({
  pill:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.teal + "15", borderWidth: 1.5, borderColor: C.teal + "40", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillText:     { fontSize: 12, fontWeight: "700", color: C.teal },
  arrow:        { fontSize: 9, color: C.teal, marginTop: 1 },
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle:   { fontSize: 13, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 },
  option:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionActive: { backgroundColor: C.teal + "12" },
  optionNative: { fontSize: 17, fontWeight: "700", color: C.navy },
  optionLabel:  { fontSize: 12, color: C.gray500, marginTop: 2 },
  check:        { fontSize: 16, color: C.teal, fontWeight: "700" },
});

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
  const { user }   = useAuth();
  const { t }      = useLanguage();

  // Labels derived from translations so they re-render when locale changes
  const MODULES = [
    { id: "Notices",  icon: "📢", label: t("nav_notices"),  color: C.teal   },
    { id: "Help",     icon: "🤝", label: t("nav_help"),     color: C.amber  },
    { id: "Contacts", icon: "📞", label: t("nav_contacts"), color: C.green  },
    { id: "Polls",    icon: "🗳️", label: t("nav_polls"),    color: C.purple },
    { id: "Profile",  icon: "👤", label: t("btn_profile"),  color: C.navy   },
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
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MoreGrid"  component={MoreGrid} />
    <Stack.Screen name="Notices"   component={NoticesScreen} />
    <Stack.Screen name="Help"      component={HelpScreen} />
    <Stack.Screen name="Contacts"  component={ContactsScreen} />
    <Stack.Screen name="Polls"     component={PollsScreen} />
    <Stack.Screen name="Profile"   component={ProfileScreen} />
  </Stack.Navigator>
);