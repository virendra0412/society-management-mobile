/**
 * i18n/index.js
 * Locale registry — identical to web version.
 * AsyncStorage-based locale persistence handled in LanguageContext.
 */
import en from "./en";
import hi from "./hi";
import gu from "./gu";

export const LOCALES = {
  en: { label: "English",  nativeLabel: "English",   strings: en },
  hi: { label: "Hindi",    nativeLabel: "हिंदी",      strings: hi },
  gu: { label: "Gujarati", nativeLabel: "ગુજરાતી",    strings: gu },
};

export const DEFAULT_LOCALE     = "en";
export const LOCALE_STORAGE_KEY = "society_locale";

export const getTranslator = (locale = DEFAULT_LOCALE) => {
  const strings = LOCALES[locale]?.strings ?? en;
  return (key, fallback) => strings[key] ?? en[key] ?? fallback ?? key;
};