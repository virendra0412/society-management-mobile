/**
 * components/ui/LanguageSwitcher.jsx
 * React Native port of the web LanguageSwitcher.
 *
 * compact=true  (default) — single pill that cycles EN → HI → GU → EN on tap.
 *                           Use this in screen headers (tight space).
 * compact=false           — three individual pill buttons side by side.
 *                           Use this in Profile / Settings screens.
 *
 * Web → RN changes:
 *   button    → TouchableOpacity
 *   onClick   → onPress
 *   div       → View
 *   inline CSS → StyleSheet
 *
 * Usage:
 *   import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
 *   <LanguageSwitcher />                  // compact cycling pill
 *   <LanguageSwitcher compact={false} />  // full 3-button row
 */
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { C }           from "../../constants/theme";

const LOCALE_ORDER = ["en", "hi", "gu"];

// Short labels shown in the pill buttons
const SHORT = { en: "EN", hi: "हि", gu: "ગુ" };

export const LanguageSwitcher = ({ compact = true }) => {
  const { locale, changeLocale } = useLanguage();

  // ── Compact: single pill, cycles on tap ───────────────────────────────────
  if (compact) {
    const cycleNext = () => {
      const idx  = LOCALE_ORDER.indexOf(locale);
      const next = LOCALE_ORDER[(idx + 1) % LOCALE_ORDER.length];
      changeLocale(next);
    };

    return (
      <TouchableOpacity
        onPress={cycleNext}
        activeOpacity={0.7}
        style={styles.compactPill}
        accessibilityLabel="Switch language"
        accessibilityRole="button"
      >
        <Text style={styles.compactText}>🌐 {SHORT[locale]}</Text>
      </TouchableOpacity>
    );
  }

  // ── Full: 3 individual buttons ─────────────────────────────────────────────
  return (
    <View style={styles.fullRow}>
      {LOCALE_ORDER.map((loc) => {
        const active = locale === loc;
        return (
          <TouchableOpacity
            key={loc}
            onPress={() => changeLocale(loc)}
            activeOpacity={0.75}
            style={[styles.fullBtn, active && styles.fullBtnActive]}
          >
            <Text style={[styles.fullBtnText, active && styles.fullBtnTextActive]}>
              {SHORT[loc]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact pill
  compactPill: {
    backgroundColor:  C.teal + "15",
    borderWidth:      1.5,
    borderColor:      C.teal + "40",
    borderRadius:     20,
    paddingHorizontal:10,
    paddingVertical:  4,
  },
  compactText: {
    fontSize:   11,
    fontWeight: "700",
    color:      C.teal,
    letterSpacing: 0.5,
  },

  // Full row
  fullRow: {
    flexDirection:    "row",
    backgroundColor:  C.gray100,
    borderRadius:     20,
    padding:          2,
    gap:              2,
    alignSelf:        "flex-start",
  },
  fullBtn: {
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      18,
  },
  fullBtnActive: {
    backgroundColor: C.teal,
  },
  fullBtnText: {
    fontSize:   12,
    fontWeight: "700",
    color:      C.gray500,
  },
  fullBtnTextActive: {
    color: "#fff",
  },
});