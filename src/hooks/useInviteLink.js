/**
 * hooks/useInviteLink.js
 *
 * Handles incoming deep links of the form:
 *   societyapp://join-invite/TOKEN
 *
 * Usage — call once in RootNavigator (or wherever navigation is available):
 *
 *   const { parseInviteUrl } = useInviteLink();
 *   // RootNavigator calls parseInviteUrl(url) when a deep link arrives.
 *
 * The hook exposes nothing global — it navigates directly via navigationRef.
 * If the token is expired/invalid it shows a toast and does NOT navigate.
 *
 * Deep-link scheme: "societyapp"  (matches app.json > expo.scheme)
 */

import { useCallback }           from "react";
import * as Linking              from "expo-linking";
import { useToast }              from "../context/ToastContext";
import client, { unwrap }        from "../api/client";

// ─── Token pre-check API call ─────────────────────────────────────────────────
// GET /api/v1/invite-link/verify?token=TOKEN
// Public endpoint — no auth header needed.
const verifyInviteToken = async (token) => {
  const res = await client.get(`/invite-link/verify`, { params: { token } });
  return unwrap(res); // { data: { societyId, societyName } }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useInviteLink = (navigationRef) => {
  const toast = useToast();

  /**
   * Parse a raw URL string and, if it matches the invite scheme,
   * verify the token and navigate to Register with pre-filled context.
   *
   * @param {string} url - e.g. "societyapp://join-invite/eyJhbGci..."
   * @param {object} navigation - React Navigation object (from RootNavigator)
   */
  const parseInviteUrl = useCallback(
    async (url, navigation) => {
      if (!url) return;

      // Only handle our invite deep link
      // Pattern: societyapp://join-invite/<token>
      const parsed = Linking.parse(url);
      if (parsed.scheme !== "societyapp" || parsed.hostname !== "join-invite") {
        return;
      }

      // The token is the path after the hostname:
      // Linking.parse("societyapp://join-invite/TOKEN") →
      //   { scheme: "societyapp", hostname: "join-invite", path: "TOKEN" }
      const token = parsed.path?.replace(/^\//, ""); // strip leading slash if any
      if (!token) {
        toast.error("Invalid invite link.");
        return;
      }

      try {
        // Pre-verify on the server before showing register screen
        const result = await verifyInviteToken(token);
        const { societyId, societyName } = result.data;

        // Navigate to Register, passing invite context as route params.
        // RegisterScreen reads these and pre-fills / locks the relevant fields.
        if (navigationRef?.current) {
          navigationRef.current.navigate("Register", {
            inviteToken:  token,
            societyId,
            societyName,
            // Keep joinCode empty so the form doesn't show a manual code field
            joinCode: "",
          });
        } else if (navigation) {
          navigation.navigate("Register", {
            inviteToken: token,
            societyId,
            societyName,
            joinCode: "",
          });
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          "This invite link is invalid or has expired.";
        toast.error(msg);
      }
    },
    [toast, navigationRef]
  );

  return { parseInviteUrl };
};