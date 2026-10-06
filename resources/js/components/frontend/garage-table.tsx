import { navigationUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Chip } from '@/components/map/parking-detail/parts';
import { Progress } from '@/components/ui/progress';
import { garageLiveState, type GarageLiveState, type OverviewGarage, type OverviewMunicipality } from '@/lib/garage-overview';
import { cn } from '@/lib/utils';
import { formatLocale } from '@/locale-sync';
import { locationMap } from '@/routes';
import { MapPin, Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const barTone: Record<'green' | 'orange' | 'red', string> = {
    green: '[&>div]:bg-green-600',
    orange: '[&>div]:bg-amber-600',
    red: '[&>div]:bg-red-600',
};

const numberTone: Record<'green' | 'orange' | 'red', string> = {
    green: 'text-green-700 dark:text-green-400',
    orange: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
};

/** Desktop columns: location, status, free, occupancy, measured, actions. The header row uses the same template. */
const columns = 'lg:grid-cols-[minmax(0,2.2fr)_9.5rem_8rem_minmax(0,1.6fr)_5.5rem_6.5rem]';

/** The same columns for a table beside other content, as on the home page. */
const compactColumns = 'lg:grid-cols-[minmax(0,1fr)_4.5rem_7rem_minmax(0,1fr)_3.5rem_6rem] lg:gap-x-4';

const iconLink =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

/** Time only for today's measurements; older ones also get the date. European 24-hour clock, also in English. */
export function useMeasuredTime(): (value: string) => string {
    const { i18n } = useTranslation();
    const locale = formatLocale(i18n.language);

    return (value: string) => {
        const date = new Date(value);
        const today = date.toDateString() === new Date().toDateString();

        return date.toLocaleString(locale, {
            ...(today ? {} : { day: 'numeric', month: 'short' }),
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
    };
}

function StatusChip({ state }: { state: GarageLiveState }) {
    const { t } = useTranslation('frontend/garages');

    return <Chip tone={state.tone}>{t(state.status === 'free' ? 'status.live' : `status.${state.status}`)}</Chip>;
}

function GarageActions({ garage }: { garage: OverviewGarage }) {
    const { t } = useTranslation('frontend/garages');
    const navigate = navigationUrl(garage.latitude, garage.longitude);

    return (
        <div className="flex shrink-0 justify-end gap-2">
            <a
                href={locationMap.url({
                    query: { destination: garage.name, destination_type: 'offstreet', lat: String(garage.latitude), lng: String(garage.longitude) },
                })}
                aria-label={t('actions.map_label', { name: garage.name })}
                title={t('actions.map')}
                className={`${iconLink} border hover:bg-muted`}
            >
                <MapPin className="h-[18px] w-[18px]" aria-hidden />
            </a>
            {navigate && (
                <a
                    href={navigate}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('actions.navigate_label', { name: garage.name })}
                    title={t('actions.navigate')}
                    className={`${iconLink} bg-orange-600 text-white hover:bg-orange-700`}
                >
                    <Navigation className="h-[18px] w-[18px]" aria-hidden />
                </a>
            )}
        </div>
    );
}

function GarageRow({ garage, grid }: { garage: OverviewGarage; grid: string }) {
    const { t } = useTranslation('frontend/garages');
    const measured = useMeasuredTime();
    const state = garageLiveState(garage);
    const type = garage.type ? t(`types.${garage.type}`) : null;
    const time = garage.observed_at ? measured(garage.observed_at) : null;
    const hasTotal = state.free !== null && state.total !== null && state.free <= state.total;
    const freeText =
        state.free === null
            ? null
            : hasTotal
              ? t('status.free_of', { free: state.free, total: state.total })
              : t('status.free', { free: state.free });
    const bar = state.percent !== null && (
        <Progress
            value={state.percent}
            aria-label={t('status.general')}
            aria-valuetext={t('status.occupied', { percent: state.percent })}
            className={`h-2 w-full rounded-full bg-stone-200 dark:bg-neutral-800 ${state.bar ? barTone[state.bar] : ''}`}
        />
    );
    const number = state.free !== null && (
        <span className={`text-2xl font-bold tabular-nums ${state.bar ? numberTone[state.bar] : ''}`} aria-hidden>
            {state.free}
        </span>
    );

    return (
        <li className="border-b border-stone-100 last:border-b-0 dark:border-neutral-800">
            {/* Desktop: one table-like row. */}
            <div className={`hidden min-h-[70px] items-center gap-x-5 px-5 py-2 lg:grid ${grid}`}>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="font-semibold wrap-break-word">{garage.name}</h3>
                    {type && <span className="text-sm text-muted-foreground">{type}</span>}
                </div>
                <div>
                    <StatusChip state={state} />
                </div>
                <div className="text-right">
                    {state.free !== null ? (
                        <>
                            {number}
                            {hasTotal && <span className="text-sm text-muted-foreground tabular-nums"> / {state.total}</span>}
                            <span className="sr-only">{freeText}</span>
                        </>
                    ) : (
                        <span className="text-xl text-muted-foreground" aria-hidden>
                            —
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {bar}
                    {state.percent !== null && (
                        <span className="w-20 shrink-0 text-sm text-muted-foreground tabular-nums" aria-hidden>
                            {t('status.occupied', { percent: state.percent })}
                        </span>
                    )}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                    {time && (
                        <>
                            <span className="sr-only">{t('status.measured')} </span>
                            <time dateTime={garage.observed_at ?? undefined}>{time}</time>
                        </>
                    )}
                </div>
                <GarageActions garage={garage} />
            </div>

            {/* Phone: name and count on one line, the occupancy bar and actions below. */}
            <div className="flex flex-col gap-2 px-4 py-3.5 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 className="font-semibold wrap-break-word">{garage.name}</h3>
                        <span className="text-sm text-muted-foreground">
                            {[type, time && `${t('status.measured')} ${time}`].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                    {state.free !== null ? (
                        <div className="shrink-0 text-right">
                            {number}
                            {hasTotal && (
                                <span className="block text-xs text-muted-foreground" aria-hidden>
                                    {t('status.free_of_short', { total: state.total })}
                                </span>
                            )}
                            <span className="sr-only">{freeText}</span>
                        </div>
                    ) : (
                        <div className="shrink-0">
                            <StatusChip state={state} />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">{bar}</div>
                    <GarageActions garage={garage} />
                </div>
            </div>
        </li>
    );
}

/**
 * One municipality's garages and P+R with their live occupancy, as on the garage overview.
 * `total` labels the heading when only part of the municipality is shown.
 */
export function GarageTable({
    municipality,
    total,
    compact = false,
    className,
}: {
    municipality: OverviewMunicipality;
    total?: number;
    compact?: boolean;
    className?: string;
}) {
    const { t } = useTranslation('frontend/garages');
    const sectionId = `municipality-${municipality.name}`.replace(/\s+/g, '-');
    const grid = compact ? compactColumns : columns;

    return (
        <section
            aria-labelledby={sectionId}
            className={cn('overflow-hidden rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900', className)}
        >
            <h2 id={sectionId} className="border-b bg-stone-100 px-4 py-3 text-lg font-bold lg:px-5 dark:border-neutral-800 dark:bg-neutral-800/60">
                {municipality.name}{' '}
                <span className="text-[15px] font-medium text-muted-foreground">
                    {t('locations', { count: total ?? municipality.garages.length })}
                </span>
            </h2>
            <div
                className={`hidden gap-x-5 border-b px-5 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase lg:grid dark:border-neutral-800 ${grid}`}
                aria-hidden
            >
                <span>{t('columns.location')}</span>
                <span>{t('columns.status')}</span>
                <span className="text-right">{t('columns.free')}</span>
                <span>{t('columns.occupancy')}</span>
                <span>{t('columns.measured')}</span>
                <span className="text-right">{t('columns.go_to')}</span>
            </div>
            <ul>
                {municipality.garages.map((garage) => (
                    <GarageRow key={garage.id} garage={garage} grid={grid} />
                ))}
            </ul>
        </section>
    );
}
