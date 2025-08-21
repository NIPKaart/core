import i18n from '@/i18n';
import type { TFunction } from 'i18next';

/** "community.space_deleted" -> "community" */
function splitCategory(type: string): string {
    const dot = type.indexOf('.');
    return dot > -1 ? type.slice(0, dot) : type;
}

/**
 * Resolve the title for a notification row - dropdown
 */
export function getNotificationLabel(tGlobal: TFunction, type?: string | null): string {
    const val = typeof type === 'string' && type ? type : 'default';
    const exactKey = `global/notification:labels.${val}`;
    if (i18n.exists(exactKey)) return tGlobal(`labels.${val}`);

    // fallback to default label
    return tGlobal('labels.default');
}

/**
 * Resolve the title for a notification row - table
 */
export function resolveNotificationTitleBackend(tBackend: TFunction, type: string, params?: Record<string, unknown>): string {
    const cat = splitCategory(type);

    const exactKey = `backend/notifications:titles.${type}`;
    if (i18n.exists(exactKey)) return tBackend(`titles.${type}`, params);

    const wildcardKey = `backend/notifications:titles.${cat}.*`;
    if (i18n.exists(wildcardKey)) return tBackend(`titles.${cat}.*`, params);

    return tBackend('titles.default', params);
}

/**
 * Resolve the type label for a notification row - table
 */
export function resolveTypeLabelBackend(tBackend: TFunction, type?: string | null): string {
    const val = typeof type === 'string' && type ? type : 'default';
    const cat = splitCategory(val);

    const exactKey = `backend/notifications:types.${val}`;
    if (i18n.exists(exactKey)) return tBackend(`types.${val}`);

    const wildcardKey = `backend/notifications:types.${cat}.*`;
    if (i18n.exists(wildcardKey)) return tBackend(`types.${cat}.*`);

    return tBackend('types.default');
}
