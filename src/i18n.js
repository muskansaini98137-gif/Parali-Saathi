import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import english from "./locales/en/translation.json";
import hindi from "./locales/hi/translation.json";

const LANGUAGE_STORAGE_KEY = "parali-saathi-language";

function getSavedLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

const initialLanguage = getSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: english },
    hi: { translation: hindi },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "hi"],
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

function syncDocumentLanguage(language) {
  const selectedLanguage = language === "hi" ? "hi" : "en";
  document.documentElement.lang = selectedLanguage;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
  } catch {
    // The in-memory language switch still works if browser storage is unavailable.
  }
}

syncDocumentLanguage(initialLanguage);
i18n.on("languageChanged", syncDocumentLanguage);

export default i18n;