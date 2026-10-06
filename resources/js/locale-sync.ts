import { router } from '@inertiajs/react';
import i18n from './i18n';

let formats: Record<string, string> = {};

export function configureLocalization(localization: { available: { code: string; formatLocale: string }[]; fallback: string }) {
    formats = Object.fromEntries(localization.available.map((language) => [language.code, language.formatLocale]));
    i18n.options.supportedLngs = localization.available.map((language) => language.code);
    i18n.options.fallbackLng = localization.fallback;
}

export function formatLocale(language: string): string {
    return formats[language] ?? language;
}

export function registerLocaleSynchronization() {
    const synchronize = (page: { props: Record<string, unknown> }) => {
        if (typeof page.props.locale === 'string') void i18n.changeLanguage(page.props.locale);
    };
    const navigation = router.on('navigate', ({ detail: { page } }) => synchronize(page));
    const success = router.on('success', ({ detail: { page } }) => synchronize(page));
    return () => {
        navigation();
        success();
    };
}
