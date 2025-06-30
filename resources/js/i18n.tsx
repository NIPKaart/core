import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

type TranslationJson = string | { [key: string]: TranslationJson };
type NamespaceResources = { [namespace: string]: TranslationJson };
type ResourceMap = { [lang: string]: NamespaceResources };

// Load all JSON files under locales/{lang}/{namespace}.json
const modules = import.meta.glob('../locales/*/*/**/*.json', { eager: true }) as Record<string, { default: TranslationJson }>;

const resources: ResourceMap = {};
const namespaces: Set<string> = new Set();

for (const path in modules) {
    // Match paths in the format: ../locales/{domain}/{lang}/{optional_folder}/{namespace}.json
    // - {domain}: Alphanumeric, underscores, or hyphens (e.g., "global", "app")
    // - {lang}: Two-letter language code (e.g., "en", "nl")
    // - {optional_folder}: Optional subfolder for grouping namespaces (e.g., "common")
    // - {namespace}: Alphanumeric, underscores, or hyphens (e.g., "messages", "errors")
    const match = path.match(/^\.{2}\/locales\/([a-zA-Z0-9_-]+)\/([a-z]{2})(?:\/([a-zA-Z0-9_-]+))?\/([a-zA-Z0-9_-]+)\.json$/);
    if (!match) continue;

    const [, domain, lang, folder, filename] = match;

    const namespace = folder ? `${domain}/${folder}/${filename}` : `${domain}/${filename}`;

    resources[lang] ??= {};
    resources[lang][namespace] = modules[path].default;
    namespaces.add(namespace);
}

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'nl'],
        defaultNS: 'global',
        ns: [...namespaces],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
        },
        resources,
    });

export default i18n;
