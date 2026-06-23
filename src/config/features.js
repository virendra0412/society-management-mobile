/**
 * src/config/features.js
 *
 * Central feature-flag registry.
 *
 * THREE WAYS TO OVERRIDE A FLAG (in priority order)
 * ──────────────────────────────────────────────────
 * 1. Remote — your backend's GET /api/v1/config returns { featureFlags: {...} }.
 *    Call initFeatureFlags(remoteFlags) once at app startup (AuthContext or App.jsx).
 *
 * 2. OTA push — change the defaults below, run `eas update --channel production`.
 *    Users get it silently on next cold launch. No store build needed.
 *    Only works for JS-level changes — cannot change native permissions or plugins via OTA.
 *
 * 3. Store build — for anything native (new SDK, permission, plugin).
 *
 * WHAT CAN BE TOGGLED VIA OTA (no store build needed)
 * ─────────────────────────────────────────────────────
 *  ✅ PAYMENTS_ENABLED          once you've passed Razorpay test-mode checklist
 *  ✅ BIOMETRICS_ENABLED        expo-local-authentication is already installed
 *  ✅ DOCUMENT_PICKER_ENABLED   expo-document-picker is already installed
 *  ✅ CONTACTS_IMPORT_ENABLED   expo-contacts is already installed
 *  ✅ Any UI/UX flag, text change, screen addition that uses already-installed SDKs
 *
 * WHAT REQUIRES A STORE BUILD (cannot be OTA'd)
 * ───────────────────────────────────────────────
 *  ❌ Adding a brand-new native package to package.json
 *  ❌ Adding new entries to app.json plugins or android.permissions
 *  ❌ Expo SDK version upgrades
 *  ❌ google-services.json changes
 */

const FLAGS = {
  // ── Payments (Razorpay) ────────────────────────────────────────────────────
  // react-native-razorpay is installed. Keep false until test-mode checklist passes.
  // Flip to true via OTA push — no store build needed.
  PAYMENTS_ENABLED:         false,
  PAYMENTS_TEST_MODE:       true,  // force test mode; set false when switching to live keys

  // ── Biometric login ────────────────────────────────────────────────────────
  // expo-local-authentication is installed. OTA-safe.
  BIOMETRICS_ENABLED:       false,

  // ── Document attachments (help requests, issue reports) ───────────────────
  // expo-document-picker is installed. OTA-safe.
  DOCUMENT_PICKER_ENABLED:  false,

  // ── Import emergency contacts from phone into society directory ────────────
  // expo-contacts is installed. OTA-safe.
  CONTACTS_IMPORT_ENABLED:  false,

  // ── Already-active flags ────────────────────────────────────────────────────
  QR_SCANNER_ENABLED:       true,  // gate entry QR — already wired in VisitorsScreen
  SHARE_ENABLED:            true,  // invite links — already in AdminScreen
  DEEP_LINKING_ENABLED:     true,  // societyapp:// scheme already registered
  WEB_BROWSER_ENABLED:      true,  // for T&C, external links
  HAPTICS_ENABLED:          true,  // tactile feedback
};

/**
 * Call once at startup with flags from your backend /api/v1/config endpoint.
 * Remote values override the defaults above.
 *
 * Example in App.jsx or AuthContext:
 *   const config = await fetch("/api/v1/config").then(r => r.json());
 *   initFeatureFlags(config.featureFlags);
 */
export function initFeatureFlags(remoteFlags = {}) {
  Object.assign(FLAGS, remoteFlags);
}

/**
 * Read a single flag.
 * Always use isEnabled("FLAG_NAME"), never read FLAGS directly.
 *
 * @param {string} flag  e.g. "PAYMENTS_ENABLED"
 * @returns {boolean}
 */
export function isEnabled(flag) {
  return Boolean(FLAGS[flag]);
}

export default FLAGS;