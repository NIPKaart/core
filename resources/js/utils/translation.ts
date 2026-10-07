import i18n from '@/i18n';
import type { ParseKeys, TOptions, TypeOptions } from 'i18next';

type Catalog = keyof TypeOptions['resources'];

export function isTranslationKey<N extends Catalog>(namespace: N, key: string, options: TOptions = {}): key is ParseKeys<N> {
    if (typeof i18n.getResource('en', namespace, key) === 'string') return true;
    if (typeof options.count !== 'number') return false;
    const suffix =
        options.count === 0 && typeof i18n.getResource('en', namespace, `${key}_zero`) === 'string'
            ? 'zero'
            : new Intl.PluralRules('en').select(options.count);
    return typeof i18n.getResource('en', namespace, `${key}_${suffix}`) === 'string';
}

/** External source values are checked against the catalog before becoming a translation key. */
export function translateSourceValue<N extends Catalog>(namespace: N, key: string, options: TOptions = {}): string {
    if (isTranslationKey(namespace, key, options)) {
        const translate = i18n.getFixedT(i18n.language, namespace) as (key: ParseKeys<N>, options: TOptions) => string;
        return String(translate(key, options));
    }
    return typeof options.defaultValue === 'string' ? options.defaultValue : i18n.t('common.unknown', { ns: 'global/common' });
}
