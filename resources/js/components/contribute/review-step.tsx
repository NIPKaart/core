import type { RestrictionDay } from '@/types';
import { useTranslation } from 'react-i18next';
import StaticPinMap from './static-pin-map';
import type { ContributionForm, OrientationOption, ResolvedLocation } from './types';

type Props = {
    data: ContributionForm;
    location: ResolvedLocation | null;
    orientationOptions: OrientationOption[];
    restrictionDays: RestrictionDay[];
    onEditLocation: () => void;
    onEditDetails: () => void;
    /** What happens after sending: a new place or an improvement to a published one. */
    after?: 'review.after' | 'improve.after';
};

export default function ReviewStep({
    data,
    location,
    orientationOptions,
    restrictionDays,
    onEditLocation,
    onEditDetails,
    after = 'review.after',
}: Props) {
    const { t } = useTranslation('frontend/map/contribute');
    const duration = Number(data.parking_hours || 0) * 60 + Number(data.parking_minutes || 0);
    const days = restrictionDays.filter((day) => data.restriction_days.includes(day)).map((day) => t(`days.${day}` as const));
    const times = data.restriction_starts_at && data.restriction_ends_at ? `${data.restriction_starts_at}–${data.restriction_ends_at}` : null;
    const title = [location?.street, location?.municipality].filter(Boolean).join(', ');

    const rows: [string, string | null][] = [
        [t('review.orientation'), orientationOptions.find((option) => option.value === data.orientation)?.label ?? null],
        [t('review.under_sign'), data.under_sign ? t(`details.under_sign.${data.under_sign}` as const) : null],
        ...(data.under_sign === 'yes'
            ? ([
                  [t('review.text'), data.under_sign_text ? `“${data.under_sign_text}”` : null],
                  [
                      t('review.duration'),
                      duration > 0
                          ? `${[
                                Math.floor(duration / 60) ? t('details.under_sign.duration_hours', { count: Math.floor(duration / 60) }) : null,
                                duration % 60 ? t('details.under_sign.duration_minutes', { count: duration % 60 }) : null,
                            ]
                                .filter(Boolean)
                                .join(' ')} · ${t('review.parking_disc')}`
                          : null,
                  ],
                  [t('review.applies'), [days.join(', '), times].filter(Boolean).join(' · ') || null],
              ] as [string, string | null][])
            : []),
        [t('review.note'), data.description || t('review.none')],
    ];

    return (
        <div className="flex flex-col gap-4">
            <section aria-labelledby="review-title" className="overflow-hidden rounded-2xl border bg-card">
                {data.latitude !== null && data.longitude !== null && (
                    <StaticPinMap latitude={data.latitude} longitude={data.longitude} className="h-36" />
                )}
                <h2 id="review-title" className="px-4 pt-3.5 pb-1 text-lg font-semibold">
                    {title}
                </h2>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-2 text-sm">
                    {rows.map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className={value ? 'font-medium' : 'text-muted-foreground'}>{value ?? t('review.unknown')}</dd>
                        </div>
                    ))}
                </dl>
                <div className="flex gap-5 px-4 pb-3">
                    <button type="button" onClick={onEditLocation} className="py-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                        {t('review.change_location')}
                    </button>
                    <button type="button" onClick={onEditDetails} className="py-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                        {t('review.change_details')}
                    </button>
                </div>
            </section>

            <section aria-labelledby="after-title" className="grid gap-2.5 rounded-2xl border bg-card p-4">
                <h2 id="after-title" className="text-[15px] font-semibold">
                    {t('review.after_title')}
                </h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                    {(t(after, { returnObjects: true }) as string[]).map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
