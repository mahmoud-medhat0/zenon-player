import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';

const syncDocumentLanguage = (language = 'en') => {
  if (typeof document === 'undefined') return;

  const lang = language.split('-')[0] === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })
  .then(() => {
    syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
  });

i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
