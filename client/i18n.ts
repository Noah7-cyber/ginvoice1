import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import local translation files instead of relying on HTTP backend for immediate loading
import enTranslation from './locales/en/translation.json';
import pcmTranslation from './locales/pcm/translation.json';

const resources = {
  en: {
    translation: enTranslation
  },
  pcm: {
    translation: pcmTranslation
  }
};

i18n
  .use(Backend) // If we want to dynamically fetch locales later
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;
