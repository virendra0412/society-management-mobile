/**
 * screens/maintenance/reports/reportUtils.js
 *
 * Shared utilities for downloading, saving, and sharing maintenance reports.
 *
 * Uses only packages already in the project, plus expo-print:
 *   expo-print              — render HTML → a real local PDF file, on-device
 *   expo-file-system/legacy — write/copy temp files, Android SAF direct-save
 *   expo-secure-store        — remembers the Android Downloads folder grant
 *   expo-sharing              — share sheet (WhatsApp, Drive, Mail, AirDrop, or just Save)
 *   expo-web-browser           — open HTML report in device browser (fallback only)
 *
 * NOTE: imports from "expo-file-system/legacy", not "expo-file-system". SDK 54
 * made a new object-based API (File/Directory classes) the default export of
 * "expo-file-system" — the function-style calls used here (writeAsStringAsync,
 * copyAsync, StorageAccessFramework, cacheDirectory) only exist on the legacy
 * import and throw a deprecation error under the new default import.
 *
 * DOWNLOAD BEHAVIOR (both PDF and CSV):
 *   Android → saves straight into a user-granted folder (Downloads) via
 *             Storage Access Framework. One-time folder-permission prompt,
 *             then every download after that is silent — no share sheet.
 *   iOS     → always the share sheet. Apple's sandbox has no equivalent to
 *             SAF; every iOS app downloads files this way (Files app,
 *             Gmail, banking apps, etc. all work the same way). This is
 *             expected iOS behavior, not a bug.
 *   If the Android permission prompt is declined, or the direct write fails
 *   for any reason, we fall back to the share sheet so the download still
 *   completes one way or another.
 *
 * Exports:
 *   downloadPdf({ htmlString, filename })  → PDF, see behavior above
 *   downloadCsv({ csvString, filename })   → CSV, see behavior above (was `shareCsv`;
 *                                             kept both names — see bottom of file)
 *   openHtml(url)                          → opens the HTML report in the browser (fallback)
 *   shareHtml({ htmlString, filename })    → downloads HTML → shares via share sheet
 */

import * as Print       from "expo-print";
import * as FileSystem  from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as Sharing     from "expo-sharing";
import * as WebBrowser  from "expo-web-browser";
import { Alert, Platform } from "react-native";

const { StorageAccessFramework: SAF } = FileSystem;

// Persisted across app restarts — the SAF directory the admin granted once.
const DOWNLOAD_DIR_KEY = "society_pdf_download_dir_uri";

// ─── Build authenticated URL ──────────────────────────────────────────────────
// Since expo-web-browser can't set Authorization headers, we append the JWT
// as a query param. The backend auth middleware should accept ?token= as well.
// If your backend doesn't support query-param auth yet, use shareHtml() instead.

export const buildAuthUrl = (baseUrl, token, extraParams = {}) => {
  const qs = new URLSearchParams({ ...extraParams, token }).toString();
  return `${baseUrl}&${qs}`;
};

// ─── Android: save straight into a granted folder (no share sheet) ───────────
// `content` is a string; pass encoding: Base64 for binary data (PDF) or
// leave it as UTF8 for text (CSV).

const saveToAndroidFolder = async ({ content, filename, mimeType, encoding }) => {
  let directoryUri = await SecureStore.getItemAsync(DOWNLOAD_DIR_KEY);

  if (!directoryUri) {
    // First time: ask the user to pick a folder (they should pick Downloads).
    // This is a one-time system dialog — every download after this is silent.
    const permissions = await SAF.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return false; // user declined — caller falls back to the share sheet
    }
    directoryUri = permissions.directoryUri;
    await SecureStore.setItemAsync(DOWNLOAD_DIR_KEY, directoryUri);
  }

  try {
    const fileUri = await SAF.createFileAsync(directoryUri, filename, mimeType);
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: encoding || FileSystem.EncodingType.UTF8,
    });
    return true;
  } catch (e) {
    // Grant may have been revoked (e.g. folder deleted, permission reset by
    // the OS). Clear it so the next attempt re-prompts, then let the caller
    // fall back to the share sheet for this one.
    await SecureStore.deleteItemAsync(DOWNLOAD_DIR_KEY);
    return false;
  }
};

// ─── Render HTML → real PDF file → save directly (Android) or share (iOS) ────

export const downloadPdf = async ({ htmlString, filename = "report.pdf" }) => {
  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  try {
    const { uri, base64 } = await Print.printToFileAsync({ html: htmlString, base64: true });

    if (Platform.OS === "android") {
      const saved = await saveToAndroidFolder({
        content:  base64,
        filename: safeName,
        mimeType: "application/pdf",
        encoding: FileSystem.EncodingType.Base64,
      });
      if (saved) {
        Alert.alert("Downloaded", `${safeName} was saved to your chosen folder.`);
        return;
      }
      // Permission declined or write failed — fall through to the share sheet below.
    }

    // iOS (always), or Android fallback: copy to a nicely-named file, share it.
    const dest = FileSystem.cacheDirectory + safeName;
    await FileSystem.copyAsync({ from: uri, to: dest });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "Your device does not support file sharing.");
      return;
    }
    await Sharing.shareAsync(dest, {
      mimeType: "application/pdf",
      dialogTitle: "Save or Share PDF",
      UTI: "com.adobe.pdf",
    });
  } catch (e) {
    Alert.alert("Error", `Could not generate the PDF. ${e.message || "Please try again."}`);
  }
};

// ─── Write CSV → save directly (Android) or share (iOS) ──────────────────────

export const downloadCsv = async ({ csvString, filename = "report.csv" }) => {
  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  // Write BOM + CSV so Excel on Windows opens UTF-8 correctly
  const content = "\uFEFF" + csvString;

  try {
    if (Platform.OS === "android") {
      const saved = await saveToAndroidFolder({
        content,
        filename: safeName,
        mimeType: "text/csv",
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (saved) {
        Alert.alert("Downloaded", `${safeName} was saved to your chosen folder.`);
        return;
      }
      // Permission declined or write failed — fall through to the share sheet below.
    }

    // iOS (always), or Android fallback: write to cache, share it.
    const path = FileSystem.cacheDirectory + safeName;
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "Your device does not support file sharing.");
      return;
    }
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: "Export to Excel",
      UTI: "public.comma-separated-values-text",
    });
  } catch (e) {
    Alert.alert("Error", `Could not export the file. ${e.message || "Please try again."}`);
  }
};

// Old name, kept as an alias so nothing else needs to change.
export const shareCsv = downloadCsv;

// ─── Open in browser (fallback for Print / Save as PDF manually) ─────────────

export const openHtml = async (url) => {
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor:       "#0F2040",
      controlsColor:      "#0D7377",
      dismissButtonStyle: "close",
    });
  } catch (e) {
    Alert.alert("Error", "Could not open the report. Please try again.");
  }
};

// ─── Download HTML → Share sheet ─────────────────────────────────────────────
// Use this if the backend requires Authorization header (not query param token).
// The axios client fetches the HTML string, we write it to a .html temp file,
// then open the share sheet. (HTML previews aren't meaningful to "direct-save"
// the way a PDF/CSV is, so this one always uses the share sheet.)

export const shareHtml = async ({ htmlString, filename = "report.html" }) => {
  try {
    const path = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(path, htmlString, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Sharing not available", "Your device does not support file sharing.");
      return;
    }
    await Sharing.shareAsync(path, {
      mimeType: "text/html",
      dialogTitle: "Share Report",
      UTI: "public.html",
    });
  } catch (e) {
    Alert.alert("Error", "Could not share the report. Please try again.");
  }
};

// ─── Convenience: report action button metadata ───────────────────────────────

export const REPORT_ACTIONS = [
  { key: "html",  icon: "⬇️", label: "Download PDF",  sub: "Saves directly on Android; share sheet on iOS" },
  { key: "csv",   icon: "📊", label: "Download Excel", sub: "Saves directly on Android; share sheet on iOS" },
  { key: "share", icon: "📲", label: "Share via WhatsApp", sub: "Share report file" },
];