/**
 * i18n/index.js
 * Locale registry — React Native.
 * AsyncStorage-based locale persistence handled in LanguageContext.
 *
 * t(key, fallback, params?) supports {placeholder} interpolation:
 *   t("visitor_flat_label", "Flat {value}", { value: "A-101" })
 *   → "Flat A-101"
 */
import en from "./en";
import hi from "./hi";
import gu from "./gu";
import ta from "./ta";
import mr from "./mr";
import pa from "./pa";

export const LOCALES = {
  en: { label: "English",  nativeLabel: "English",   strings: en },
  hi: { label: "Hindi",    nativeLabel: "हिंदी",      strings: hi },
  gu: { label: "Gujarati", nativeLabel: "ગુજરાતી",    strings: gu },
  ta: { label: "Tamil",    nativeLabel: "தமிழ்",      strings: ta },
  mr: { label: "Marathi",  nativeLabel: "मराठी",      strings: mr },
  pa: { label: "Punjabi",  nativeLabel: "ਪੰਜਾਬੀ",    strings: pa },
};

export const DEFAULT_LOCALE     = "en";
export const LOCALE_STORAGE_KEY = "society_locale";

/**
 * Interpolate {key} placeholders in a string.
 * e.g. interpolate("Hello {name}!", { name: "Raj" }) → "Hello Raj!"
 */
const interpolate = (str, params) => {
  if (!params || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`
  );
};

export const getTranslator = (locale = DEFAULT_LOCALE) => {
  const strings = LOCALES[locale]?.strings ?? en;
  /**
   * t(key, fallback?, params?)
   *   key      — translation key
   *   fallback — English fallback string (with {placeholders})
   *   params   — interpolation object e.g. { value: "A-101", count: 3 }
   */
  return (key, fallback, params) => {
    const raw = strings[key] ?? en[key] ?? fallback ?? key;
    return interpolate(raw, params);
  };
};