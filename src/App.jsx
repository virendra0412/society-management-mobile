/**
 * App.jsx
 * Root component — wraps all providers in the correct order.
 *
 * Provider order (outer → inner):
 *   SafeAreaProvider        — react-native-safe-area-context
 *   GestureHandlerRootView  — react-native-gesture-handler
 *   LanguageProvider        — i18n (no deps)
 *   AuthProvider            — user session (depends on SecureStore)
 *   ToastProvider           — in-app toasts (rendered at root level)
 *   NotificationProvider    — push notifications (depends on Toast)
 *   RootNavigator           — navigation (depends on Auth + Notifications)
 */
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider }       from "react-native-safe-area-context";
import { StatusBar }              from "expo-status-bar";
import { StyleSheet }             from "react-native";

import { LanguageProvider }     from "./context/LanguageContext";
import { AuthProvider }         from "./context/AuthContext";
import { SAAuthProvider }       from "./context/SAAuthContext";
import { ToastProvider }        from "./context/ToastContext";
import { NotificationProvider } from "./context/NotificationContext";
import { RootNavigator }        from "./navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <SAAuthProvider>
              <ToastProvider>
                <NotificationProvider>
                  <StatusBar style="auto" />
                  <RootNavigator />
                </NotificationProvider>
              </ToastProvider>
            </SAAuthProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});