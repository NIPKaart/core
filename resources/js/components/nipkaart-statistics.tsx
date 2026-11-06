import { cn } from '@/lib/utils';
import { about } from '@/routes';
import { Link } from '@inertiajs/react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export type ParkingStatistics = {
    parking_locations: number;
    garages: number;
    municipalities: number;
    countries: number;
};

const counters = ['parking_locations', 'garages', 'municipalities', 'countries'] as const;

/** The anchor that the compact strip links to, where the counting is explained. */
export const STATISTICS_ANCHOR = 'cijfers';

export default function NipkaartStatistics({ statistics, compact = false }: { statistics: ParkingStatistics; compact?: boolean }) {
    const { t, i18n } = useTranslation('global/statistics');
    const headingId = useId();
    const format = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);

    if (compact) {
        return (
            <section
                aria-labelledby={headingId}
                className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-stone-200 bg-white px-6 py-3.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
                <h2 id={headingId} className="text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                    {t('title')}
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:flex sm:flex-wrap">
                    {counters.map((key) => (
                        <div key={key} className="flex flex-row-reverse items-baseline justify-end gap-1.5">
                            <dt className="text-stone-600 dark:text-stone-400">{t(`inline.${key}`)}</dt>
                            <dd className="text-[15px] font-bold tabular-nums">{format.format(statistics[key])}</dd>
                        </div>
                    ))}
                </dl>
                <Link
                    href={`${about.url()}#${STATISTICS_ANCHOR}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 hover:text-orange-800 sm:ml-auto dark:text-orange-400"
                >
                    {t('how')}
                </Link>
            </section>
        );
    }

    return (
        <section id={STATISTICS_ANCHOR} aria-labelledby={headingId} className="flex scroll-mt-24 flex-col gap-4 lg:gap-5">
            <h2 id={headingId} className="text-lg font-bold tracking-tight lg:text-xl">
                {t('title')}
            </h2>
            <dl className="grid grid-cols-2 border-t border-stone-200 lg:grid-cols-4 dark:border-neutral-800">
                {counters.map((key, index) => (
                    <div
                        key={key}
                        className={cn(
                            'flex min-w-0 flex-col-reverse justify-end gap-1.5 border-b border-stone-200 py-4 lg:py-6 dark:border-neutral-800',
                            index % 2 === 1 ? 'border-l pl-4' : 'pr-3',
                            'lg:pr-6',
                            index > 0 && 'lg:border-l lg:pl-6',
                        )}
                    >
                        <dt className="text-sm text-stone-600 lg:text-[15px] dark:text-stone-400">{t(key)}</dt>
                        <dd className="text-3xl leading-none font-bold tracking-tight tabular-nums lg:text-5xl">{format.format(statistics[key])}</dd>
                    </div>
                ))}
            </dl>
            <p className="max-w-3xl text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">{t('note')}</p>
        </section>
    );
}
