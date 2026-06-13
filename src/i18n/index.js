/**
 * i18n/index.js
 * Locale registry — identical to web version.
 * AsyncStorage-based locale persistence handled in LanguageContext.
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

export const getTranslator = (locale = DEFAULT_LOCALE) => {
  const strings = LOCALES[locale]?.strings ?? en;
  return (key, fallback) => strings[key] ?? en[key] ?? fallback ?? key;
};