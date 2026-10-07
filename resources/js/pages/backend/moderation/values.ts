import { translateSourceValue } from '@/utils/translation';
import { useTranslation } from 'react-i18next';

/** The improvable values of a community space, as the server compares and stores them. */
export type ImprovementValues = {
    latitude: number;
    longitude: number;
    street: string | null;
    municipality?: string | null;
    municipality_id?: number;
    orientation: string | null;
    under_sign: 'yes' | 'no' | null;
    under_sign_text: string | null;
    parking_time: number | null;
    restriction_days: string[] | null;
    restriction_starts_at: string | null;
    restriction_ends_at: string | null;
    description: string | null;
};

/** One change as moderators see it; the pin and its address move together. */
export type ChangeGroup = 'location' | 'orientation' | 'under_sign' | 'description';

export const GROUP_FIELDS: Record<ChangeGroup, (keyof ImprovementValues)[]> = {
    location: ['latitude', 'longitude'],
    orientation: ['orientation'],
    under_sign: ['under_sign', 'under_sign_text', 'parking_time', 'restriction_days', 'restriction_starts_at', 'restriction_ends_at'],
    description: ['description'],
};

export const CHANGE_GROUPS = Object.keys(GROUP_FIELDS) as ChangeGroup[];

export type EnumOption = { value: string; label: string };

type Options = { orientations: EnumOption[]; underSign?: EnumOption[]; restrictionDays?: string[] };

/** Readable text for one change group, with "not known" and "none" kept apart. */
export function useValueFormatter(options: Options) {
    const { t } = useTranslation('backend/moderation');
    const { t: tContribute } = useTranslation('frontend/map/contribute');

    const duration = (minutes: number) =>
        [
            Math.floor(minutes / 60) ? tContribute('details.under_sign.duration_hours', { count: Math.floor(minutes / 60) }) : null,
            minutes % 60 ? tContribute('details.under_sign.duration_minutes', { count: minutes % 60 }) : null,
        ]
            .filter(Boolean)
            .join(' ');

    return (group: ChangeGroup, values: Partial<ImprovementValues>): string => {
        switch (group) {
            case 'location':
                return [values.street, values.municipality].filter(Boolean).join(', ') || t('values.unknown');
            case 'orientation':
                return options.orientations.find((option) => option.value === values.orientation)?.label ?? t('values.unknown');
            case 'under_sign': {
                if (!values.under_sign) return t('values.unknown');
                if (values.under_sign === 'no') return tContribute('details.under_sign.no');
                const days = (options.restrictionDays ?? [])
                    .filter((day) => values.restriction_days?.includes(day))
                    .map((day) => translateSourceValue('frontend/map/contribute', `days.${day}`))
                    .join(', ');
                const times =
                    values.restriction_starts_at && values.restriction_ends_at
                        ? `${values.restriction_starts_at.slice(0, 5)}–${values.restriction_ends_at.slice(0, 5)}`
                        : null;
                return [
                    tContribute('details.under_sign.yes'),
                    values.under_sign_text ? `“${values.under_sign_text}”` : null,
                    values.parking_time ? duration(values.parking_time) : null,
                    [days, times].filter(Boolean).join(' ') || null,
                ]
                    .filter(Boolean)
                    .join(' · ');
            }
            case 'description':
                return values.description ? `“${values.description}”` : t('values.none');
        }
    };
}

/** "Location (240 m), orientation" for a list of change groups. */
export function useChangeSummary() {
    useTranslation('backend/moderation');

    return (changes: ChangeGroup[], distance: number | null = null) =>
        changes
            .map((group, index) => {
                const label = translateSourceValue('backend/moderation', `groups.${group}`);
                const text = index === 0 ? label : label.toLowerCase();
                return group === 'location' && distance !== null ? `${text} (${distance} m)` : text;
            })
            .join(', ');
}
