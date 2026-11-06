import { cn } from '@/lib/utils';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export type ParkingStatistics = {
    parking_locations: number;
    garages: number;
    municipalities: number;
    countries: number;
};

const counters = ['parking_locations', 'garages', 'municipalities', 'countries'] as const;

export default function NipkaartStatistics({ statistics, compact = false }: { statistics: ParkingStatistics; compact?: boolean }) {
    const { t, i18n } = useTranslation('global/statistics');
    const headingId = useId();
    const format = new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language);

    return (
        <section
            aria-labelledby={headingId}
            className={cn('flex flex-col gap-5', compact && 'border-t border-stone-200 pt-6 dark:border-neutral-800')}
        >
            <h2 id={headingId} className={cn('text-2xl font-bold tracking-tight lg:text-3xl', compact && 'text-base font-semibold lg:text-base')}>
                {t('title')}
            </h2>
            <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4', compact && 'gap-y-5')}>
                {counters.map((key) => (
                    <div key={key} className="flex min-w-0 flex-col gap-2">
                        <dt className="text-sm leading-relaxed [overflow-wrap:anywhere] text-stone-600 dark:text-stone-400">{t(key)}</dt>
                        <dd
                            className={cn(
                                'order-first text-3xl font-bold tracking-tight tabular-nums sm:text-4xl lg:text-5xl',
                                compact && 'text-2xl sm:text-2xl lg:text-3xl',
                            )}
                        >
                            {format.format(statistics[key])}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="max-w-3xl text-xs leading-relaxed text-stone-500 dark:text-stone-400">{t('note')}</p>
        </section>
    );
}
