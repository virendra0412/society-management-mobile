/**
 * components/layout/ScreenWrapper.jsx
 * SafeArea + scroll wrapper used by every screen.
 * Handles status bar, keyboard avoid, and background colour.
 */
import { View, ScrollView, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView }   from "react-native-safe-area-context";
import { C }              from "../../constants/theme";

export const ScreenWrapper = ({
  children,
  scroll   = false,   // wrap content in ScrollView
  bg       = C.bg,    // background colour
  padHoriz = 16,      // horizontal padding (0 to disable)
  padTop   = 0,       // extra top padding inside safe area
  style,
}) => {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: padHoriz, paddingTop: padTop },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flat,
        { paddingHorizontal: padHoriz, paddingTop: padTop, backgroundColor: bg },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={["top","left","right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      {inner}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  flat:          { flex: 1 },
  scrollContent: { paddingBottom: 32, flexGrow: 1 },
});