/**
 * screens/maintenance/reports/reportUtils.js
 *
 * Shared utilities for downloading, saving, and sharing maintenance reports.
 *
 * Uses only packages already in the project:
 *   expo-file-system  — write temp files
 *   expo-sharing      — share sheet (WhatsApp, Drive, Mail, AirDrop…)
 *   expo-web-browser  — open HTML report in device browser (→ Print → PDF)
 *
 * Flow:
 *   openHtml(url, token)           → opens the HTML report in the browser
 *   shareHtml(url, token, name)    → downloads HTML → shares via share sheet
 *   shareCsv(csvString, filename)  → writes CSV → shares via share sheet
 */

import * as FileSystem  from "expo-file-system";
import * as Sharing     from "expo-sharing";
import * as WebBrowser  from "expo-web-browser";
import { Alert, Platform } from "react-native";

// ─── Build authenticated URL ──────────────────────────────────────────────────
// Since expo-web-browser can't set Authorization headers, we append the JWT
// as a query param. The backend auth middleware should accept ?token= as well.
// If your backend doesn't support query-param auth yet, use shareHtml() instead.

export const buildAuthUrl = (baseUrl, token, extraParams = {}) => {
  const qs = new URLSearchParams({ ...extraParams, token }).toString();
  return `${baseUrl}&${qs}`;
};

// ─── Open in browser (for Print / Save as PDF) ───────────────────────────────

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
// then open the share sheet.

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

// ─── Write CSV → Share sheet ──────────────────────────────────────────────────

export const shareCsv = async ({ csvString, filename = "report.csv" }) => {
  try {
    // Write BOM + CSV so Excel on Windows opens UTF-8 correctly
    const content = "\uFEFF" + csvString;
    const path    = FileSystem.cacheDirectory + filename;
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
    Alert.alert("Error", "Could not export the file. Please try again.");
  }
};

// ─── Convenience: share both HTML and CSV from the same report ────────────────

export const REPORT_ACTIONS = [
  { key: "html",  icon: "🖨️", label: "Print / PDF",        sub: "Open in browser → Print" },
  { key: "csv",   icon: "📊", label: "Export Excel",        sub: "Share as .csv file" },
  { key: "share", icon: "📲", label: "Share via WhatsApp", sub: "Share report file" },
];
