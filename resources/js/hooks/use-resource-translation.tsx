import type { Namespace } from 'i18next';
import { useTranslation } from 'react-i18next';

export function useResourceTranslation<N extends Namespace>(namespace: N) {
    const { t: tResource } = useTranslation(namespace);
    const { t: tGlobal } = useTranslation('global/common');

    return {
        t: tResource,
        tGlobal,
    };
}
