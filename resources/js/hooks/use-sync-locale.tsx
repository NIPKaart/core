import i18n from '@/i18n';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

export function useSyncLocale() {
    const { locale } = usePage<SharedData>().props;

    useEffect(() => {
        if (locale && locale !== i18n.language) {
            i18n.changeLanguage(locale);
        }
    }, [locale]);
}
