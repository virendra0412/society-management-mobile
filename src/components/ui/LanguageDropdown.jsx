/**
 * components/ui/LanguageDropdown.jsx
 * Reusable language selector with modal bottom sheet.
 * Used on HomeScreen, MoreScreen, LoginScreen, RegisterScreen, etc.
 */
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
} from "react-native";

import { useLanguage } from "../../context/LanguageContext";
import { LOCALES } from "../../i18n";
import { C } from "../../constants/theme";

const LanguageDropdown = () => {
  const { locale, changeLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Resolve current locale object; fall back to English when unknown
  const current = LOCALES[locale] || LOCALES.en;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={styles.pill}
      >
        <Text style={styles.pillText} numberOfLines={1} ellipsizeMode="tail">🌐 {current.nativeLabel}</Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("lang_select")}</Text>
            {Object.entries(LOCALES).map(([code, localeData]) => {
              const active = locale === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => { changeLocale(code); setOpen(false); }}
                  activeOpacity={0.75}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionNative, active && { color: C.teal }]}>
                      {localeData.nativeLabel}
                    </Text>
                    <Text style={styles.optionLabel}>{localeData.label}</Text>
                  </View>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill:         { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "nowrap", backgroundColor: C.gray100, borderWidth: 1.5, borderColor: C.gray300, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillText:     { fontSize: 12, fontWeight: "700", color: C.text, flexShrink: 1, flexWrap: "nowrap" },
  arrow:        { fontSize: 9, color: C.gray500, marginTop: 1, marginLeft: 4 },
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle:   { fontSize: 13, fontWeight: "700", color: C.gray500, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 },
  option:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionActive: { backgroundColor: C.teal + "12" },
  optionNative: { fontSize: 17, fontWeight: "700", color: C.navy },
  optionLabel:  { fontSize: 12, color: C.gray500, marginTop: 2 },
  check:        { fontSize: 16, color: C.teal, fontWeight: "700" },
});

export default LanguageDropdown;
