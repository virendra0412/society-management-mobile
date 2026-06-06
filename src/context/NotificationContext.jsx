/**
 * context/NotificationContext.jsx
 * Expo push notification setup.
 *
 * On login:
 *   1. Request permission (iOS prompts user, Android grants automatically)
 *   2. Get Expo push token
 *   3. PATCH /users/profile with { fcmToken } — registers with backend
 *
 * Foreground:   notification displayed as in-app toast via ToastContext
 * Background:   handled natively by expo-notifications
 * Deep linking: tapping notification navigates to the relevant screen
 *
 * Wiring:
 *   NotificationProvider reads registerPushRef from AuthContext and
 *   assigns registerForPushNotifications into it. This avoids any
 *   circular context dependency — AuthContext calls the fn after login
 *   without importing NotificationContext directly.
 */
import {
  createContext, useContext, useEffect, useRef, useCallback,
} from "react";
import * as Notifications   from "expo-notifications";
import * as Device          from "expo-device";
import { Platform }         from "react-native";
import { authApi }          from "../api/auth.api";
import { useToast }         from "./ToastContext";
import { useAuth }          from "./AuthContext";

// How foreground notifications are shown
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const toast              = useToast();
  const { registerPushRef } = useAuth();
  const notifListener      = useRef();
  const responseListener   = useRef();
  const navigationRef      = useRef(null); // Set from RootNavigator

  // Register for push notifications and save token to backend
  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      // Simulators can't receive push notifications
      console.log("[Notifications] Skipping — not a physical device");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission denied");
      return null;
    }

    // Android needs a notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name:        "default",
        importance:  Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:  "#0F2040",
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoPushToken = tokenData.data;

    // Register token with backend (PATCH /users/profile)
    try {
      await authApi.updateProfile({ fcmToken: expoPushToken });
      console.log("[Notifications] Token registered:", expoPushToken);
    } catch (e) {
      console.warn("[Notifications] Failed to register token:", e.message);
    }

    return expoPushToken;
  }, []);

  // ── Inject registerForPushNotifications into AuthContext's ref ─────────────
  // AuthContext.login calls registerPushRef.current() after a successful login.
  // This is the bridge that avoids a circular import between the two contexts.
  useEffect(() => {
    registerPushRef.current = registerForPushNotifications;
    return () => { registerPushRef.current = null; };
  }, [registerForPushNotifications, registerPushRef]);

  // ── Foreground notification listener ──────────────────────────────────────
  useEffect(() => {
    // Foreground notification → show as toast
    notifListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        const message = [title, body].filter(Boolean).join(" — ");
        toast.info(message);
      }
    );

    // User tapped notification → navigate
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    );

    return () => {
      notifListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, [toast]);

  /**
   * Map notification data.type → navigation destination.
   * Called when user taps a notification (background or killed state).
   */
  const handleNotificationNavigation = (data) => {
    if (!data?.type || !navigationRef.current) return;
    const nav = navigationRef.current;

    switch (data.type) {
      case "visitor_pending":
      case "visitor_approved":
      case "visitor_rejected":
        nav.navigate("Visitors");
        break;
      case "maintenance_due":
      case "maintenance_overdue":
      case "bill_published":
        nav.navigate("Maintenance");
        break;
      case "issue_update":
        nav.navigate("Issues");
        break;
      case "booking_confirmed":
      case "booking_rejected":
        nav.navigate("Amenity");
        break;
      case "parking_approved":
      case "parking_rejected":
        nav.navigate("Parking");
        break;
      case "new_notice":
        nav.navigate("More");
        break;
      case "new_poll":
        nav.navigate("More");
        break;
      default:
        nav.navigate("Home");
    }
  };

  return (
    <NotificationContext.Provider value={{ registerForPushNotifications, navigationRef }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside <NotificationProvider>");
  return ctx;
};