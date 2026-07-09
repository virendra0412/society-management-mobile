/**
 * screens/maintenance/reports/reportUtils.js
 *
 * Shared utilities for downloading, saving, and sharing maintenance reports.
 *
 * Uses only packages already in the project, plus expo-print:
 *   expo-print        — render HTML → a real local PDF file, on-device
 *   expo-file-system   — write/copy temp files
 *   expo-sharing       — share sheet (WhatsApp, Drive, Mail, AirDrop, or just Save)
 *   expo-web-browser    — open HTML report in device browser (fallback only)
 *
 * Flow:
 *   downloadPdf({ htmlString, filename })  → renders HTML to a PDF file, then
 *                                             opens the share sheet (which
 *                                             includes "Save to Files"/"Save
 *                                             to Drive" — this IS the download).
 *   openHtml(url)                  → opens the HTML report in the browser (fallback)
 *   shareHtml(url, token, name)    → downloads HTML → shares via share sheet
 *   shareCsv(csvString, filename)  → writes CSV → shares via share sheet
 */

import * as Print       from "expo-print";
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

// ─── Render HTML → real PDF file → share/save sheet ──────────────────────────
// This is the "one-tap download" path. expo-print renders the HTML natively
// on-device into an actual .pdf file (no server-side PDF library needed —
// the backend just needs to keep serving print-ready HTML, which it already
// does via ?format=html). We then copy it to a nicely-named file and hand it
// to the share sheet, which on both iOS and Android includes a "Save to
// Files" / "Save to device" option — that's the download.

export const downloadPdf = async ({ htmlString, filename = "report.pdf" }) => {
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlString, base64: false });

    // printToFileAsync names the file something generic (e.g. Print-xxxx.pdf);
    // copy it to a readable name before handing it to the share sheet.
    const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
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
    Alert.alert("Error", "Could not generate the PDF. Please try again.");
  }
};

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
  { key: "html",  icon: "⬇️", label: "Download PDF",        sub: "Save or share as a real PDF" },
  { key: "csv",   icon: "📊", label: "Export Excel",        sub: "Share as .csv file" },
  { key: "share", icon: "📲", label: "Share via WhatsApp", sub: "Share report file" },
];