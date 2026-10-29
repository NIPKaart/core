import type { ContributionForm } from '@/components/contribute/types';
import type { ImprovementValues } from './values';

/**
 * The add flow's form works with strings and separate hours and minutes; moderation keeps the values as the server
 * stores them. These two functions translate between them, so moderators edit with the same form contributors use.
 */
export function toForm(values: ImprovementValues): ContributionForm {
    const minutes = values.parking_time ?? 0;

    return {
        latitude: values.latitude,
        longitude: values.longitude,
        orientation: values.orientation ?? '',
        under_sign: values.under_sign ?? '',
        under_sign_text: values.under_sign_text ?? '',
        parking_hours: minutes ? String(Math.floor(minutes / 60)) : '',
        parking_minutes: minutes ? String(minutes % 60) : '',
        restriction_days: values.restriction_days ?? [],
        restriction_starts_at: values.restriction_starts_at?.slice(0, 5) ?? '',
        restriction_ends_at: values.restriction_ends_at?.slice(0, 5) ?? '',
        description: values.description ?? '',
    };
}

/** The change one form field makes to the values; an empty field means "not known". */
export function fromForm<K extends keyof ContributionForm>(
    values: ImprovementValues,
    key: K,
    value: ContributionForm[K],
): Partial<ImprovementValues> {
    const minutes = values.parking_time ?? 0;
    const text = (input: unknown) => (typeof input === 'string' && input.trim() !== '' ? input : null);

    switch (key) {
        case 'orientation':
            return { orientation: text(value) };
        case 'under_sign':
            return { under_sign: value === 'yes' || value === 'no' ? value : null };
        case 'under_sign_text':
            return { under_sign_text: text(value) };
        case 'parking_hours': {
            const total = Number(value || 0) * 60 + (minutes % 60);
            return { parking_time: total || null };
        }
        case 'parking_minutes': {
            const total = Math.floor(minutes / 60) * 60 + Number(value || 0);
            return { parking_time: total || null };
        }
        case 'restriction_days': {
            const days = value as ImprovementValues['restriction_days'];
            return { restriction_days: days && days.length ? days : null };
        }
        case 'restriction_starts_at':
            return { restriction_starts_at: text(value) };
        case 'restriction_ends_at':
            return { restriction_ends_at: text(value) };
        case 'description':
            return { description: text(value) };
        default:
            return {};
    }
}
