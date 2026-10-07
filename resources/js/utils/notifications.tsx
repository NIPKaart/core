import { isTranslationKey } from '@/utils/translation';
import type { TFunction } from 'i18next';

/** "community.space_deleted" -> "community" */
function splitCategory(type: string): string {
    const dot = type.indexOf('.');
    return dot > -1 ? type.slice(0, dot) : type;
}

/**
 * Resolve the title for a notification row - dropdown
 */
export function getNotificationLabel(tGlobal: TFunction<'global/notification'>, type?: string | null): string {
    const val = typeof type === 'string' && type ? type : 'default';
    const key = `labels.${val}`;
    if (isTranslationKey('global/notification', key)) return tGlobal(key);

    // fallback to default label
    return tGlobal('labels.default');
}

/**
 * Resolve the title for a notification row - table
 */
export function resolveNotificationTitleBackend(
    tBackend: TFunction<'backend/notifications'>,
    type: string,
    params?: Record<string, unknown>,
): string {
    const cat = splitCategory(type);

    const key = `titles.${type}`;
    if (isTranslationKey('backend/notifications', key)) return tBackend(key, params);

    const wildcard = `titles.${cat}.*`;
    if (isTranslationKey('backend/notifications', wildcard)) return tBackend(wildcard, params);

    return tBackend('titles.default', params);
}

/**
 * Resolve the type label for a notification row - table
 */
export function resolveTypeLabelBackend(tBackend: TFunction<'backend/notifications'>, type?: string | null): string {
    const val = typeof type === 'string' && type ? type : 'default';
    const cat = splitCategory(val);

    const key = `types.${val}`;
    if (isTranslationKey('backend/notifications', key)) return tBackend(key);

    const wildcard = `types.${cat}.*`;
    if (isTranslationKey('backend/notifications', wildcard)) return tBackend(wildcard);

    return tBackend('types.default');
}
