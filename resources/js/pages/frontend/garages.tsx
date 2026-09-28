import { navigationUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Chip } from '@/components/map/parking-detail/parts';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getEcho } from '@/echo';
import FrontendLayout from '@/layouts/frontend-layout';
import {
    filterMunicipalities,
    garageLiveState,
    overviewSummary,
    sortGarages,
    type GarageLiveState,
    type GarageSort,
    type GarageTypeFilter,
    type OverviewGarage,
    type OverviewMunicipality,
} from '@/lib/garage-overview';
import { locationMap } from '@/routes';
import { Head, router, usePoll } from '@inertiajs/react';
import { MapPin, Navigation, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = { municipalities: OverviewMunicipality[] };

/** Re-checked on this interval too, so a measurement that is no longer current stops looking live. */
const REFRESH_MS = 120_000;

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

const iconLink =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

/** Time only for today's measurements; older ones also get the date. European 24-hour clock, also in English. */
function useMeasuredTime(): (value: string) => string {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('en') ? 'en-GB' : i18n.language;

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

function GarageRow({ garage }: { garage: OverviewGarage }) {
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
            <div className={`hidden min-h-[70px] items-center gap-x-5 px-5 py-2 lg:grid ${columns}`}>
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

export default function Garages({ municipalities }: Props) {
    const { t, i18n } = useTranslation('frontend/garages');
    const measured = useMeasuredTime();
    const [query, setQuery] = useState('');
    const [type, setType] = useState<GarageTypeFilter>('all');
    const [sort, setSort] = useState<GarageSort>('name');
    const summary = useMemo(() => overviewSummary(municipalities), [municipalities]);
    const visible = useMemo(
        () =>
            filterMunicipalities(municipalities, query, type, i18n.language).map((municipality) => ({
                ...municipality,
                garages: sortGarages(municipality.garages, sort),
            })),
        [municipalities, query, type, sort, i18n.language],
    );
    const shown = visible.reduce((count, municipality) => count + municipality.garages.length, 0);

    usePoll(REFRESH_MS, { only: ['municipalities'] });

    useEffect(() => {
        const reload = () => router.reload({ only: ['municipalities'] });
        const channel = getEcho()?.channel('parking-offstreet');
        channel?.listen('.observations.applied', reload);

        // Only this listener is removed: other components may share the channel.
        return () => {
            channel?.stopListening('.observations.applied', reload);
        };
    }, []);

    const typeOptions: { value: GarageTypeFilter; count: number }[] = [
        { value: 'all', count: summary.total },
        { value: 'garage', count: summary.garages },
        { value: 'parkandride', count: summary.parkandride },
    ];

    return (
        <FrontendLayout>
            <Head title={t('meta.title')}>
                <meta name="description" content={t('meta.description')} />
            </Head>

            <div className="min-h-screen bg-stone-50 dark:bg-neutral-950">
                <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 lg:px-8 lg:pt-12">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                        <div className="flex max-w-2xl flex-col gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight dark:text-white">
                                {t('title')}
                            </h1>
                            <p className="text-base text-stone-600 lg:text-[17px] dark:text-stone-300">{t('intro')}</p>
                        </div>
                        {summary.total > 0 && (
                            <div className="flex flex-col gap-2 lg:items-end">
                                {summary.latestObservedAt && (
                                    <span className="inline-flex items-center gap-2 self-start rounded-full border bg-white px-3 py-1.5 text-sm font-semibold lg:self-end dark:bg-neutral-900">
                                        <span
                                            className={`h-2 w-2 rounded-full ${summary.current > 0 ? 'bg-green-600' : 'bg-stone-400'}`}
                                            aria-hidden
                                        />
                                        {t('summary.latest', { time: measured(summary.latestObservedAt) })}
                                    </span>
                                )}
                                <span className="text-sm text-stone-600 dark:text-stone-400">
                                    {t('summary.states', { current: summary.current, closed: summary.closed, without: summary.withoutLiveData })}
                                </span>
                            </div>
                        )}
                    </header>

                    {summary.total === 0 ? (
                        <p className="mt-10 text-muted-foreground">{t('empty')}</p>
                    ) : (
                        <>
                            <div className="mt-6 flex flex-col gap-3 lg:mt-8 lg:flex-row lg:items-center lg:gap-4">
                                <div className="relative w-full lg:w-80">
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <label htmlFor="garage-filter" className="sr-only">
                                        {t('filter.label')}
                                    </label>
                                    <Input
                                        id="garage-filter"
                                        type="search"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder={t('filter.placeholder')}
                                        className="h-11 bg-white pl-10 dark:bg-neutral-900"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-1">
                                    <div
                                        role="group"
                                        aria-label={t('filter.type')}
                                        className="flex gap-1 self-start rounded-lg bg-stone-200/70 p-1 dark:bg-neutral-800"
                                    >
                                        {typeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={type === option.value}
                                                onClick={() => setType(option.value)}
                                                className={`h-9 rounded-md px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3.5 ${
                                                    type === option.value
                                                        ? 'bg-white font-semibold shadow-sm dark:bg-neutral-950'
                                                        : 'text-stone-700 hover:bg-white/60 dark:text-stone-300 dark:hover:bg-neutral-900/60'
                                                }`}
                                            >
                                                {t(`filter.types.${option.value}`)}{' '}
                                                <span className="font-normal text-muted-foreground">{option.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                        <label htmlFor="garage-sort" className="sr-only sm:not-sr-only">
                                            {t('sort.label')}
                                        </label>
                                        <Select value={sort} onValueChange={(value: GarageSort) => setSort(value)}>
                                            <SelectTrigger id="garage-sort" className="min-h-11 w-40 bg-white text-foreground dark:bg-neutral-900">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent align="end">
                                                <SelectItem value="name">{t('sort.name')}</SelectItem>
                                                <SelectItem value="free">{t('sort.free')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <p className="sr-only" role="status">
                                {t('filter.count', { count: shown, total: summary.total })}
                            </p>

                            {visible.length === 0 ? (
                                <p className="mt-10 text-muted-foreground">{t('filter.none')}</p>
                            ) : (
                                visible.map((municipality) => {
                                    const sectionId = `municipality-${municipality.name}`.replace(/\s+/g, '-');

                                    return (
                                        <section
                                            key={municipality.name}
                                            aria-labelledby={sectionId}
                                            className="mt-6 overflow-hidden rounded-xl border bg-white lg:mt-8 dark:border-neutral-800 dark:bg-neutral-900"
                                        >
                                            <h2
                                                id={sectionId}
                                                className="border-b bg-stone-100 px-4 py-3 text-lg font-bold lg:px-5 dark:border-neutral-800 dark:bg-neutral-800/60"
                                            >
                                                {municipality.name}{' '}
                                                <span className="text-[15px] font-medium text-muted-foreground">
                                                    {t('locations', { count: municipality.garages.length })}
                                                </span>
                                            </h2>
                                            <div
                                                className={`hidden gap-x-5 border-b px-5 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase lg:grid dark:border-neutral-800 ${columns}`}
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
                                                    <GarageRow key={garage.id} garage={garage} />
                                                ))}
                                            </ul>
                                        </section>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>
            </div>
        </FrontendLayout>
    );
}
