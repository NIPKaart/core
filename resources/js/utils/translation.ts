import i18n from '@/i18n';
import type { ParseKeys, TOptions, TypeOptions } from 'i18next';

type Catalog = keyof TypeOptions['resources'];

/** Notification keys must name a message, never a catalog group. */
export function isTranslationKey<N extends Catalog>(namespace: N, key: string): key is ParseKeys<N> {
    return typeof i18n.getResource('en', namespace, key) === 'string';
}

/** Only untyped external source values cross this runtime boundary. */
export function translateSourceValue(namespace: Catalog, key: string, options: TOptions = {}): string {
    const fallback = typeof options.defaultValue === 'string' ? options.defaultValue : i18n.t('common.unknown', { ns: 'global/common' });
    if (!i18n.exists(key, { ...options, ns: namespace })) return fallback;

    const translate = i18n.getFixedT(i18n.language, namespace) as (key: string, options: TOptions) => { res: unknown };
    const { res } = translate(key, { ...options, returnDetails: true, returnObjects: true });
    return typeof res === 'string' ? res : fallback;
}
