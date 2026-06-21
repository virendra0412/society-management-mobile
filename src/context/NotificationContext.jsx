/**
 * context/NotificationContext.jsx
 *
 * Added vs previous version:
 *   - Auto-switches active society when user taps a notification from
 *     a different society (reads societyId from notification data payload).
 *   - Uses a ref for `user` to avoid stale closure inside the response listener.
 */
import {
  createContext, useContext, useEffect, useRef, useCallback,
} from "react";
import * as Notifications   from "expo-notifications";
import * as Device          from "expo-device";
import Constants            from "expo-constants";
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
  const toast                    = useToast();
  const { registerPushRef, user, switchSociety } = useAuth();
  const notifListener            = useRef();
  const responseListener         = useRef();
  const navigationRef            = useRef(null);

  // Keep a live ref to `user` so the notification handler never has a stale
  // closure — response listeners are registered once and must read current user.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Same for switchSociety — stable callback but kept as ref for symmetry
  const switchSocietyRef = useRef(switchSociety);
  useEffect(() => { switchSocietyRef.current = switchSociety; }, [switchSociety]);

  // ── Register for push notifications ────────────────────────────────────────
  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name:             "default",
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       "#0F2040",
      });
    }

    // FIX (bug #2): getExpoPushTokenAsync() requires an explicit projectId on
    // SDK 49+ — it does NOT read app.json's extra.eas.projectId on its own.
    // Without this, the call throws "No 'projectId' found..." on every EAS/
    // managed build, which was being silently swallowed by the .catch() in
    // AuthContext's caller — so push registration failed for every user on
    // every login, with no visible error anywhere. That's why no module
    // (visitors, issues, maintenance, etc.) was ever delivering notifications.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;

    if (!projectId) {
      console.warn(
        "[Notifications] No EAS projectId found in app.json (extra.eas.projectId). " +
        "Push registration skipped — notifications will not work until this is set."
      );
      return null;
    }

    let expoPushToken;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = tokenData.data;
    } catch (e) {
      console.warn("[Notifications] Failed to get Expo push token:", e.message);
      return null;
    }

    try {
      // Use the dedicated FCM token endpoint, not updateProfile
      await authApi.updateFcmToken(expoPushToken);
    } catch (e) {
      console.warn("[Notifications] Failed to register token:", e.message);
    }

    return expoPushToken;
  }, []);

  // ── Inject into AuthContext ref ────────────────────────────────────────────
  useEffect(() => {
    registerPushRef.current = registerForPushNotifications;
    return () => { registerPushRef.current = null; };
  }, [registerForPushNotifications, registerPushRef]);

  // ── Foreground + tap listeners ─────────────────────────────────────────────
  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        const message = [title, body].filter(Boolean).join(" — ");
        toast.info(message);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    );

    // ── EDGE-02: Cold-start tap handling ──────────────────────────────────
    // addNotificationResponseReceivedListener only fires when the app is
    // already running.  When the app is fully killed and the user taps a
    // notification from the OS tray, we must call
    // getLastNotificationResponseAsync() once on mount to catch that tap.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    });

    return () => {
      notifListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, [toast]);

  /**
   * Navigate to the correct screen when a notification is tapped.
   *
   * Multi-society behaviour:
   *   If the notification carries a `societyId` that differs from the user's
   *   currently active society, we switch society first, then navigate.
   *   This means tapping a walk-in alert from Society B while viewing Society A
   *   seamlessly takes the resident to Society B's Visitors screen.
   */
  const handleNotificationNavigation = async (data) => {
    if (!data?.type || !navigationRef.current) return;

    // ── Auto-switch society if the notification is from a different one ────
    if (data.societyId) {
      const currentUser = userRef.current;
      // Safely resolve activeSocietyId whether it is a populated object or a
      // raw ObjectId string — ._id is undefined on a plain string, so fall back
      // to toString() directly.  Without this guard the comparison silently
      // fails on unpopulated refs and the auto-switch is skipped. (TC-PN-004)
      const currentId =
        (typeof currentUser?.activeSocietyId === "object" && currentUser?.activeSocietyId !== null
          ? currentUser.activeSocietyId._id?.toString()
          : currentUser?.activeSocietyId?.toString()) || null;

      if (currentId && data.societyId !== currentId) {
        try {
          await switchSocietyRef.current(data.societyId);
        } catch (e) {
          // 401 = access token expired while app was backgrounded 30+ min.
          // The 401-interceptor in client.js will attempt a silent refresh; if
          // that also fails it fires authEvents.logout().  Either way we still
          // navigate — the screen will show the correct data once the user
          // manually re-authenticates or the token refresh succeeds.
          console.warn("[Notifications] Auto-switch failed:", e?.message);
        }
      }
    }

    // ── Navigate to the correct screen ────────────────────────────────────
    const nav = navigationRef.current;

    switch (data.type) {
      case "visitor_walkin":
      case "visitor_pending":
      case "visitor_approved":
      case "visitor_rejected":
      case "visitor_entry":
      case "trusted_pass_expiry":
      case "trusted_visitor_digest":
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