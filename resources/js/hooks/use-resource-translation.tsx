import { useTranslation } from 'react-i18next';

export function useResourceTranslation(namespace: string) {
    const { t: tResource } = useTranslation(namespace);
    const { t: tGlobal } = useTranslation('backend/global');

    return {
        t: tResource,
        tGlobal,
    };
}
