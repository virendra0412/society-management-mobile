/**
 * src/components/UpdateManager.jsx
 *
 * Checks for OTA updates on launch and shows a non-intrusive banner
 * when one is available. On tap the app reloads with the new bundle.
 *
 * Drop this anywhere inside your root component tree (App.jsx works well).
 *
 * UPDATE BEHAVIOUR
 * ─────────────────
 * - Check happens once, silently, after the app loads.
 * - If an update is available: green banner slides in at the top.
 * - User taps "Update" → app reloads immediately with the new bundle.
 * - If no update or update fails → nothing shown, no crash.
 * - Works only in standalone/EAS builds; skipped in Expo Go.
 */
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import * as Updates   from "expo-updates";
import Constants      from "expo-constants";

// Constants.appOwnership is deprecated in SDK 50+.
// ExecutionEnvironment.StoreClient = Expo Go; .Standalone = production build; .Bare = dev client.
const isExpoGo = Constants.executionEnvironment === "storeClient";

export const UpdateManager = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const slideAnim = useState(new Animated.Value(-80))[0];

  useEffect(() => {
    // Skip in Expo Go — expo-updates is a no-op there
    if (isExpoGo) return;

    const check = async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        await Updates.fetchUpdateAsync();
        setUpdateAvailable(true);

        // Slide banner in
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
      } catch {
        // Network error or update server down — fail silently
      }
    };

    // Delay check so it doesn't race against auth/splash
    const timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setUpdating(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.text}>
        🎉 A new version is ready!
      </Text>
      <TouchableOpacity
        onPress={handleUpdate}
        disabled={updating}
        style={styles.btn}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>
          {updating ? "Restarting…" : "Update now"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    zIndex:          9999,
    backgroundColor: "#0D7377",
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.2,
    shadowRadius:    4,
    elevation:       8,
  },
  text: {
    color:      "#fff",
    fontSize:   14,
    fontWeight: "600",
    flex:       1,
  },
  btn: {
    backgroundColor: "#fff",
    borderRadius:    8,
    paddingHorizontal: 14,
    paddingVertical:   6,
    marginLeft:      12,
  },
  btnText: {
    color:      "#0D7377",
    fontWeight: "700",
    fontSize:   13,
  },
});