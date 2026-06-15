/**
 * components/ui/AppLogo.jsx
 *
 * Reusable logo component used on:
 *  - LoginScreen
 *  - RegisterScreen
 *  - LoadingScreen (RootNavigator)
 *
 * Props:
 *   size     'sm' | 'md' | 'lg'   — controls icon + text size
 *   dark     boolean               — false = light text (for navy bg), true = navy text (for light bg)
 *   tagline  boolean               — show "Society Operations" subtitle
 */
import { View, Text, Image, StyleSheet } from "react-native";
import { C } from "../../constants/theme";

const SIZES = {
  sm: { icon: 48,  name: 20, sub: 10, gap: 8  },
  md: { icon: 72,  name: 28, sub: 11, gap: 12 },
  lg: { icon: 96,  name: 36, sub: 12, gap: 16 },
};

export const AppLogo = ({ size = "md", dark = false, tagline = false, taglineText, style }) => {
  const sz = SIZES[size];
  const nameColor  = dark ? C.navy  : "#FFFFFF";
  const accentColor = C.teal;
  const subColor   = dark ? C.gray500 : "rgba(255,255,255,0.55)";
  const taglineLabel = taglineText || "SOCIETY OPERATIONS";

  return (
    <View style={[s.wrap, style]}>
      {/* Icon tile */}
      <Image
        source={require("../../../assets/icon.png")}
        style={[s.icon, { width: sz.icon, height: sz.icon, borderRadius: sz.icon * 0.22 }]}
        resizeMode="cover"
      />

      {/* Wordmark row */}
      <View style={[s.textWrap, { marginTop: sz.gap }]}>
        <Text style={[s.my, { fontSize: sz.name, color: accentColor }]}>my</Text>
        <Text style={[s.society, { fontSize: sz.name, color: nameColor }]}>Society</Text>
      </View>

      {/* Amber accent bar */}
      <View style={[s.bar, { width: sz.icon * 1.4 }]} />

      {/* Optional tagline */}
      {tagline && (
        <Text style={[s.tagline, { fontSize: sz.sub, color: subColor }]}> 
          {taglineLabel}
        </Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap:     { alignItems: "center" },
  icon:     { },
  textWrap: { flexDirection: "row", alignItems: "baseline" },
  my:       { fontWeight: "400", letterSpacing: 0.3 },
  society:  { fontWeight: "700", letterSpacing: 0.3 },
  bar:      { height: 3, borderRadius: 2, backgroundColor: "#F4A228", marginTop: 6, marginBottom: 4 },
  tagline:  { letterSpacing: 3, marginTop: 2 },
});