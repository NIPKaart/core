import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../locales/en/translation.json';
import nlTranslation from '../locales/nl/translation.json';
import enSidebar from '../locales/en/sidebar.json';
import nlSidebar from '../locales/nl/sidebar.json';

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: enTranslation,
                sidebar: enSidebar,
            },
            nl: {
                translation: nlTranslation,
                sidebar: nlSidebar,
            },
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'nl'],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
        },
    });

export default i18n;
