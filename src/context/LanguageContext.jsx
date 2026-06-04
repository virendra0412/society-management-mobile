/**
 * context/LanguageContext.jsx
 * React Native i18n context.
 * Persists locale in AsyncStorage (replaces localStorage).
 * API surface identical to web LanguageContext.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTranslator, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "../i18n";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((saved) => { if (saved) setLocale(saved); })
      .catch(() => {});
  }, []);

  const changeLocale = useCallback(async (newLocale) => {
    setLocale(newLocale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, newLocale).catch(() => {});
  }, []);

  const t = getTranslator(locale);

  return (
    <LanguageContext.Provider value={{ locale, changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside <LanguageProvider>");
  return ctx;
};