import { show as importShow, index as municipalImports } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useMeasuredTime } from '@/components/frontend/garage-table';
import Destinations from '@/components/map/destinations';
import Favorites from '@/components/map/favorites';
import { navigationUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Chip } from '@/components/map/parking-detail/parts';
import { formatDistance, formatShortDate } from '@/components/map/parking-detail/utils';
import NipkaartStatistics, { type ParkingStatistics } from '@/components/nipkaart-statistics';
import { openSearch, setSearchQuery, useSearchQuery } from '@/components/search/search-store';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import type { DataTableFeatures } from '@/components/tables/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import type { GarageBadge } from '@/lib/garage-occupancy';
import { garageLiveState, type OverviewGarage } from '@/lib/garage-overview';
import { pinSvg } from '@/lib/pin-svg';
import { destinationMapUrl, favoriteMapUrl, favoriteParkingResult } from '@/lib/saved-places';
import { cn } from '@/lib/utils';
import { sourceStatusAppearance, type SourceStatusKey } from '@/pages/backend/imports/source-status';
import { dashboard, garages as garageOverview, locationMap as mapPage } from '@/routes';
import app from '@/routes/app';
import parkingRules from '@/routes/app/parking-rules';
import locationMap from '@/routes/location-map';
import { index as destinationsIndex } from '@/routes/profile/destinations';
import { index as favoritesIndex } from '@/routes/profile/favorites';
import { index as contributionsIndex, destroy as withdrawSubmission } from '@/routes/profile/parking-spaces';
import type { PaginatedResponse, SharedData } from '@/types';
import type { DestinationResult } from '@/types/destination';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleHelp,
    Clock3,
    Database,
    ExternalLink,
    Link2Off,
    MapPin,
    Navigation,
    Plus,
    Search,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Source = 'community' | 'municipal' | 'offstreet';
type ItemType = 'submission' | 'improvement' | 'report';
type Section = 'destinations' | 'favorites' | 'contributions';

type Contribution = {
    key: string;
    kind: ItemType;
    at: string;
    label: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'kept' | 'removed' | 'unavailable';
    reason: string | null;
    url: string | null;
    action: 'edit' | 'map' | null;
    withdraw_id: string | null;
};
type Contributions = PaginatedResponse<Contribution> & {
    counts: Partial<Record<Contribution['status'], number>> & { all: number };
    /** `status` holds one or more statuses separated by commas. */
    filters: { search: string; status: string | null; sort: 'newest' | 'oldest' };
};

type Overview = {
    destinations: { id: number; label: string; destination: DestinationResult }[];
    destination_id: number | null;
    nearby: {
        total: number;
        more: boolean;
        items: {
            key: string;
            source: Source;
            title: string;
            distance_metres: number;
            parking_time: number | null;
            free_space: number | null;
            map_url: string;
        }[];
    } | null;
    garage: (OverviewGarage & { municipality: string | null; map_url: string }) | null;
    pending: { label: string | null; submitted_at: string; edit_url: string | null; withdraw_id: string | null } | null;
    published: number;
    favorites: {
        total: number;
        items: {
            favorite_id: number;
            source: Source;
            title: string | null;
            municipality: string | null;
            parking_time: number | null;
            restriction_days: string[] | null;
            restriction_starts_at: string | null;
            restriction_ends_at: string | null;
            map_url: string;
        }[];
    };
    rules: { id: number; name: string | null; nationwide: boolean; url: string }[];
    history: Contribution[];
};

type Todo = {
    moderation: { total: number; high: number; types: Partial<Record<ItemType, number>>; oldest: string | null } | null;
    next: {
        key: string;
        type: ItemType;
        priority: 'high' | 'normal';
        street: string | null;
        municipality: string | null;
        contributor: string | null;
        reports: number | null;
        waiting_since: string;
        url: string;
    } | null;
    decisions: { total: number; approved: number; rejected: number; reports: number } | null;
    sources: {
        total: number;
        items: {
            id: number;
            name: string;
            status: Exclude<SourceStatusKey, 'published' | 'rejected' | 'awaiting_delivery'>;
            import_id: number | null;
            since: string | null;
        }[];
    };
    rules: { total: number; items: { id: number; name: string | null; failing_since: string | null }[] };
    attention: boolean;
};

type PageProps = {
    statistics: ParkingStatistics;
    section: Section | null;
    view: 'personal' | 'work';
    hasTodo: boolean;
    overview?: Overview;
    todo?: Todo;
    contributions?: Contributions | null;
};

const MAP_IMAGE = '/assets/images/home/map-preview.webp';
const NEARBY_METRES = 300;
const tile = 'flex min-w-0 flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5.5 dark:border-neutral-800 dark:bg-neutral-900';
const eyebrow = 'text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400';
const textLink = 'inline-flex min-h-11 items-center font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400';
const darkButton =
    'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5.5 font-semibold text-white hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200';
const iconLink =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';
const statusChip: Record<Contribution['status'], { tone: 'zinc' | 'blue' | 'green' | 'red' }> = {
    pending: { tone: 'blue' },
    approved: { tone: 'green' },
    rejected: { tone: 'red' },
    kept: { tone: 'zinc' },
    removed: { tone: 'zinc' },
    unavailable: { tone: 'zinc' },
};

export default function Dashboard({ section, view, hasTodo, overview, todo, contributions, statistics }: PageProps) {
    const { t } = useTranslation('backend/dashboard');
    const { t: tSaved } = useTranslation('frontend/map/saved');

    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: dashboard() }]}>
            <Head title={section === 'contributions' ? t('contributions.title') : t('title')} />
            <div className="flex-1 bg-canvas text-stone-900 dark:bg-neutral-950 dark:text-stone-100">
                <div className="@container flex w-full flex-col gap-10 px-4 py-6 sm:p-8">
                    {section ? (
                        <SectionView
                            title={section === 'contributions' ? t('contributions.title') : tSaved(section)}
                            count={section === 'contributions' ? contributions?.counts.all : undefined}
                        >
                            {section === 'destinations' && (
                                <Destinations
                                    open
                                    destination={null}
                                    onSelect={(value) => router.visit(destinationMapUrl(value), { preserveState: false })}
                                />
                            )}
                            {section === 'favorites' && (
                                <Favorites
                                    open
                                    onSelect={(value) => {
                                        const place = favoriteParkingResult(value);
                                        if (place) router.visit(favoriteMapUrl(place), { preserveState: false });
                                    }}
                                />
                            )}
                            {section === 'contributions' && (
                                <Deferred data="contributions" fallback={<ListSkeleton />}>
                                    {contributions ? <ContributionList contributions={contributions} /> : <></>}
                                </Deferred>
                            )}
                        </SectionView>
                    ) : (
                        <>
                            {view === 'work' && hasTodo ? (
                                <Deferred data={['todo', 'overview']} fallback={<TilesSkeleton />}>
                                    {todo ? <Workplace todo={todo} overview={overview} /> : <></>}
                                </Deferred>
                            ) : (
                                <>
                                    {hasTodo && (
                                        <div className="flex justify-end">
                                            <ViewSwitch view="personal" />
                                        </div>
                                    )}
                                    <Deferred data="overview" fallback={<TilesSkeleton hero />}>
                                        {overview ? <Personal overview={overview} /> : <></>}
                                    </Deferred>
                                    <NipkaartStatistics statistics={statistics} compact />
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function SectionView({ title, children, count }: { title: string; children: ReactNode; count?: number }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <section aria-labelledby="dashboard-section" className="flex w-full flex-col gap-6">
            <Link href={dashboard()} className={cn(textLink, 'gap-2 self-start')}>
                <ArrowLeft className="size-4" aria-hidden />
                {t('sections.back')}
            </Link>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h1
                    id="dashboard-section"
                    className={cn('text-[1.75rem] leading-tight font-bold tracking-tight', count !== undefined && 'sm:text-4xl')}
                >
                    {title}
                </h1>
                {count !== undefined && <span className="text-sm text-muted-foreground">{t('contributions.count', { count })}</span>}
            </div>
            {children}
        </section>
    );
}

/** Moderators and administrators keep their personal places and their work apart; the choice is in the address. */
function ViewSwitch({ view }: { view: 'personal' | 'work' }) {
    const { t } = useTranslation('backend/dashboard');
    const option = (value: 'personal' | 'work') => (
        <Link
            href={dashboard.url({ query: { view: value } })}
            aria-current={view === value ? 'page' : undefined}
            className={cn(
                'inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium',
                view === value
                    ? 'bg-stone-900 font-semibold text-white dark:bg-white dark:text-stone-900'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-300',
            )}
        >
            {t(`view.${value}`)}
        </Link>
    );

    return (
        <nav
            aria-label={t('view.label')}
            className="inline-flex gap-1 rounded-full border border-stone-200 bg-canvas-strong p-1 dark:border-neutral-800 dark:bg-neutral-900"
        >
            {option('personal')}
            {option('work')}
        </nav>
    );
}

function useGreeting(): string {
    const { t } = useTranslation('backend/dashboard');
    const { auth } = usePage<SharedData>().props;
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    return t(`greeting.${part}`, { name: auth.user.name.split(' ')[0] });
}

function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}

/** The map's own marker artwork, so the dashboard shows parking the way the map does. */
function Pin({ garage = false, badge = null, className }: { garage?: boolean; badge?: GarageBadge | null; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn('block shrink-0 [&_svg]:h-full [&_svg]:w-full [&_svg]:overflow-visible', className ?? 'h-10 w-7.5')}
            dangerouslySetInnerHTML={{ __html: pinSvg(garage, badge) }}
        />
    );
}

function useParkingTime() {
    const { t } = useTranslation('frontend/map/modals');

    return (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;

        return [
            hours ? t(hours === 1 ? 'community.table.time_format.hours' : 'community.table.time_format.hours_plural', { count: hours }) : null,
            rest ? t(rest === 1 ? 'community.table.time_format.minutes' : 'community.table.time_format.minutes_plural', { count: rest }) : null,
        ]
            .filter(Boolean)
            .join(' & ');
    };
}

function Personal({ overview }: { overview: Overview }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <>
            <Hero overview={overview} />
            <section aria-labelledby="dashboard-places" className="flex flex-col gap-4.5">
                <h2 id="dashboard-places" className="text-2xl leading-tight font-bold tracking-tight">
                    {t('places_title')}
                </h2>
                <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-4">
                    <GarageTile garage={overview.garage} />
                    <PendingTile pending={overview.pending} />
                    <ImpactTile published={overview.published} />
                    <RulesTile rules={overview.rules} />
                    <FavoritesTile favorites={overview.favorites} />
                    <AddTile />
                    <HistoryTile history={overview.history} />
                </div>
            </section>
        </>
    );
}

function Hero({ overview }: { overview: Overview }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const greeting = useGreeting();
    const parkingTime = useParkingTime();
    const query = useSearchQuery();
    const selected = overview.destinations.find((item) => item.id === overview.destination_id) ?? null;
    const search = (value: string) => {
        setSearchQuery(value);
        openSearch();
    };

    return (
        <section
            aria-labelledby="dashboard-hero"
            className="grid overflow-hidden rounded-2xl border border-stone-200/70 bg-canvas-strong @min-[900px]:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900/40"
        >
            <div className="flex flex-col gap-5.5 p-6 sm:p-8 lg:p-11">
                <div className="flex flex-col gap-3.5">
                    <span className="text-[15px] font-medium text-stone-600 dark:text-stone-400">{greeting}</span>
                    <h1 id="dashboard-hero" className="text-4xl leading-[1.04] font-bold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
                        {t('hero.title')}
                    </h1>
                </div>
                <form
                    role="search"
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                        event.preventDefault();
                        search(query);
                    }}
                >
                    <label htmlFor="dashboard-destination" className="sr-only">
                        {t('hero.search_label')}
                    </label>
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-stone-500" aria-hidden />
                        <input
                            id="dashboard-destination"
                            type="search"
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder={t('hero.search_placeholder')}
                            autoComplete="off"
                            className="h-14 w-full rounded-xl border border-stone-300 bg-white pr-4 pl-11 text-[17px] placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                        />
                    </div>
                    <button type="submit" className={cn(darkButton, 'h-14 px-6')}>
                        {t('hero.search_submit')}
                    </button>
                </form>
                {overview.destinations.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-[15px] font-semibold">{t('hero.destinations')}</h2>
                            <Link href={destinationsIndex.url()} className={cn(textLink, 'min-h-0 text-sm')}>
                                {t('hero.manage')}
                            </Link>
                        </div>
                        <ul className="flex flex-wrap gap-2">
                            {overview.destinations.map((item) => {
                                const active = item.id === overview.destination_id;
                                return (
                                    <li key={item.id}>
                                        <Link
                                            href={dashboard.url({ query: { view: 'personal', destination: item.id } })}
                                            only={['overview']}
                                            preserveScroll
                                            preserveState
                                            aria-current={active ? 'true' : undefined}
                                            className={cn(
                                                'inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-semibold',
                                                active
                                                    ? 'border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900'
                                                    : 'border-stone-300 bg-white hover:border-stone-900 dark:border-neutral-700 dark:bg-neutral-900',
                                            )}
                                        >
                                            {item.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
            <div className="relative min-h-105 overflow-hidden">
                <img src={MAP_IMAGE} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-135 object-cover object-[55%_60%]" />
                {overview.destinations.length === 0 && (
                    <div className="absolute inset-x-5 bottom-5 flex flex-col gap-1 rounded-lg bg-white px-4 py-3.5 shadow-[0_8px_24px_rgb(28_25_23/16%)] dark:bg-neutral-900">
                        <h2 className="text-[15px] font-semibold">{t('hero.destinations')}</h2>
                        <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">{t('hero.no_destinations')}</p>
                    </div>
                )}
                {selected && overview.nearby && (
                    <div className="absolute inset-x-5 bottom-5 flex flex-col overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_rgb(28_25_23/16%)] dark:bg-neutral-900">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3.5 pb-2.5">
                            <h2 className="text-[15px] font-semibold">{t('nearby.at', { label: selected.label })}</h2>
                            <span className="text-[13px] text-stone-600 dark:text-stone-400">
                                {overview.nearby.total === 0
                                    ? t('nearby.none', { metres: NEARBY_METRES })
                                    : overview.nearby.more
                                      ? t('nearby.more', { count: overview.nearby.total, metres: NEARBY_METRES })
                                      : t('nearby.count', { count: overview.nearby.total, metres: NEARBY_METRES })}
                            </span>
                        </div>
                        {overview.nearby.items.length > 0 && (
                            <ul>
                                {overview.nearby.items.map((item) => (
                                    <li key={item.key} className="border-t border-stone-100 dark:border-neutral-800">
                                        <Link
                                            href={item.map_url}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-neutral-800"
                                        >
                                            <span className="w-14 shrink-0 text-sm font-bold tabular-nums">
                                                {formatDistance(item.distance_metres, i18n.language)}
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="truncate text-sm font-semibold">{item.title || t('nearby.untitled')}</span>
                                                <span className="text-[13px] text-stone-600 dark:text-stone-400">
                                                    {[
                                                        t(`sources.${item.source}`),
                                                        item.parking_time ? t('nearby.max_time', { time: parkingTime(item.parking_time) }) : null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </span>
                                            {item.free_space !== null && (
                                                <span className="text-lg font-bold text-green-700 tabular-nums dark:text-green-400">
                                                    {t('nearby.free', { count: item.free_space })}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <a
                            href={destinationMapUrl(selected.destination)}
                            className={cn(textLink, 'border-t border-stone-100 px-4 dark:border-neutral-800')}
                        >
                            {t('nearby.on_map')}
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}

function GarageTile({ garage }: { garage: Overview['garage'] }) {
    const { t } = useTranslation('backend/dashboard');

    if (garage) return <LiveGarageTile garage={garage} />;

    return (
        <article aria-labelledby="dashboard-garage" className={cn(tile, '@min-[640px]:col-span-2')}>
            <p className={eyebrow}>{t('garage.eyebrow')}</p>
            <div className="flex items-center gap-4">
                <Pin garage className="h-12 w-9 opacity-40" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 id="dashboard-garage" className="text-lg font-semibold">
                        {t('garage.empty_title')}
                    </h3>
                    <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t('garage.empty_text')}</p>
                </div>
            </div>
            <Link href={garageOverview()} className={cn(textLink, 'mt-auto self-start')}>
                {t('garage.empty_action')}
            </Link>
        </article>
    );
}

function LiveGarageTile({ garage }: { garage: NonNullable<Overview['garage']> }) {
    const { t } = useTranslation('backend/dashboard');
    const { t: tGarages } = useTranslation('frontend/garages');
    const measured = useMeasuredTime();
    const state = garageLiveState(garage);
    const navigate = navigationUrl(garage.latitude, garage.longitude);
    const tone = state.bar ?? 'green';
    const badge: GarageBadge | null = state.free !== null ? { text: String(state.free), tone, label: '' } : null;
    const hasTotal = state.free !== null && state.total !== null && state.free <= state.total;

    return (
        <article aria-labelledby="dashboard-garage" className={cn(tile, '@min-[640px]:col-span-2')}>
            <div className="flex items-center justify-between gap-3">
                <p className={eyebrow}>{t('garage.eyebrow')}</p>
                <Chip tone={state.tone}>{tGarages(state.status === 'free' ? 'status.live' : `status.${state.status}`)}</Chip>
            </div>
            <div className="flex items-center gap-4">
                <span className="pr-6">
                    <Pin garage badge={badge} className="h-12 w-9" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3 id="dashboard-garage" className="text-lg font-semibold wrap-break-word">
                        {garage.name}
                    </h3>
                    <span className="text-sm text-stone-600 dark:text-stone-400">
                        {[garage.type ? tGarages(`types.${garage.type}`) : null, garage.municipality].filter(Boolean).join(' · ')}
                    </span>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Link
                        href={garage.map_url}
                        aria-label={tGarages('actions.map_label', { name: garage.name })}
                        title={tGarages('actions.map')}
                        className={cn(iconLink, 'border border-stone-200 hover:bg-stone-50 dark:border-neutral-700 dark:hover:bg-neutral-800')}
                    >
                        <MapPin className="size-4.5" aria-hidden />
                    </Link>
                    {navigate && (
                        <a
                            href={navigate}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={tGarages('actions.navigate_label', { name: garage.name })}
                            title={tGarages('actions.navigate')}
                            className={cn(iconLink, 'bg-orange-600 text-white hover:bg-orange-700')}
                        >
                            <Navigation className="size-4.5" aria-hidden />
                        </a>
                    )}
                </div>
            </div>
            {state.free !== null && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-2xl font-bold tabular-nums">
                        <span
                            className={
                                tone === 'red'
                                    ? 'text-red-700 dark:text-red-400'
                                    : tone === 'orange'
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-green-700 dark:text-green-400'
                            }
                        >
                            {hasTotal ? state.free : t('nearby.free', { count: state.free })}
                        </span>
                        {hasTotal && (
                            <span className="text-sm font-normal text-stone-500"> {tGarages('status.free_of_short', { total: state.total })}</span>
                        )}
                    </span>
                    {state.percent !== null && (
                        <Progress
                            value={state.percent}
                            aria-label={tGarages('status.general')}
                            aria-valuetext={tGarages('status.occupied', { percent: state.percent })}
                            className={cn(
                                'h-2 min-w-32 flex-1 rounded-full bg-stone-200 dark:bg-neutral-800',
                                tone === 'red' ? '[&>div]:bg-red-600' : tone === 'orange' ? '[&>div]:bg-amber-600' : '[&>div]:bg-green-600',
                            )}
                        />
                    )}
                    {garage.observed_at && (
                        <span className="text-sm text-stone-500 tabular-nums">
                            {tGarages('status.measured')} {measured(garage.observed_at)}
                        </span>
                    )}
                </div>
            )}
        </article>
    );
}

function PendingTile({ pending }: { pending: Overview['pending'] }) {
    const { t } = useTranslation('backend/dashboard');

    if (pending) return <WaitingSubmissionTile pending={pending} />;

    return (
        <article aria-labelledby="dashboard-pending" className={tile}>
            <p className={eyebrow}>{t('pending.eyebrow')}</p>
            <h3 id="dashboard-pending" className="text-[17px] font-semibold">
                {t('pending.empty_title')}
            </h3>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t('pending.empty_text')}</p>
            <Link href={locationMap.add()} className={cn(textLink, 'mt-auto min-h-0 text-sm')}>
                {t('add_location')}
            </Link>
        </article>
    );
}

function WaitingSubmissionTile({ pending }: { pending: NonNullable<Overview['pending']> }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const [withdrawing, setWithdrawing] = useState<'ask' | 'busy' | null>(null);
    const step = (state: 'done' | 'current' | 'next', label: ReactNode, last = false) => (
        <li aria-current={state === 'current' ? 'step' : undefined} className="grid grid-cols-[1.25rem_1fr] gap-3">
            <span className="flex flex-col items-center">
                {state === 'done' ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-white dark:text-stone-900">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                ) : (
                    <span
                        className={cn(
                            'size-5 rounded-full bg-white dark:bg-neutral-900',
                            state === 'current' ? 'border-6 border-orange-600' : 'border-2 border-stone-300',
                        )}
                    />
                )}
                {!last && (
                    <span className={cn('h-3.5 w-0.5', state === 'done' ? 'bg-stone-900 dark:bg-white' : 'bg-stone-200 dark:bg-neutral-700')} />
                )}
            </span>
            <span className={cn('text-sm', state === 'current' ? 'font-semibold' : 'text-stone-600 dark:text-stone-400')}>{label}</span>
        </li>
    );

    return (
        <article aria-labelledby="dashboard-pending" className={tile}>
            <p className={eyebrow}>{t('pending.eyebrow')}</p>
            <h3 id="dashboard-pending" className="text-[17px] font-semibold wrap-break-word">
                {pending.label ?? t('activity.unknown_place')}
            </h3>
            <ol aria-label={t('pending.progress')}>
                {step('done', t('pending.submitted', { date: formatShortDate(pending.submitted_at, i18n.language) }))}
                {step('current', t('pending.with_moderator'))}
                {step('next', t('pending.on_map'), true)}
            </ol>
            {pending.edit_url && (
                <div className="mt-auto flex gap-4">
                    <Link href={pending.edit_url} className={textLink}>
                        {t('pending.edit')}
                    </Link>
                    {pending.withdraw_id && (
                        <button
                            type="button"
                            onClick={() => setWithdrawing('ask')}
                            className="min-h-11 text-[15px] font-medium text-stone-600 hover:text-stone-900 dark:text-stone-300"
                        >
                            {t('pending.withdraw')}
                        </button>
                    )}
                </div>
            )}
            {withdrawing && pending.withdraw_id && (
                <ConfirmDialog
                    title={t('contributions.withdraw.title')}
                    description={t('contributions.withdraw.description')}
                    confirmText={t('contributions.withdraw.label')}
                    cancelText={t('contributions.withdraw.cancel')}
                    variant="destructive"
                    disabled={withdrawing === 'busy'}
                    onClose={() => setWithdrawing(null)}
                    onConfirm={() => {
                        setWithdrawing('busy');
                        router.delete(withdrawSubmission.url(pending.withdraw_id as string), {
                            preserveScroll: true,
                            onFinish: () => setWithdrawing(null),
                        });
                    }}
                />
            )}
        </article>
    );
}

function ImpactTile({ published }: { published: number }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <article aria-labelledby="dashboard-impact" className={tile}>
            <p className={eyebrow}>{t('impact.eyebrow')}</p>
            {published > 0 ? (
                <>
                    <p className="text-5xl leading-none font-bold tracking-[-0.035em] tabular-nums">{published}</p>
                    <h3 id="dashboard-impact" className="text-[15px] leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                        {t('impact.text', { count: published })}
                    </h3>
                    <div aria-hidden className="mt-auto flex flex-wrap gap-0.5">
                        {Array.from({ length: Math.min(published, 12) }, (_, index) => (
                            <Pin key={index} className="h-5 w-3.75" />
                        ))}
                    </div>
                </>
            ) : (
                <h3 id="dashboard-impact" className="text-[15px] leading-relaxed font-medium text-stone-700 dark:text-stone-300">
                    {t('impact.none')}
                </h3>
            )}
            <Link href={contributionsIndex.url()} className={cn(textLink, 'mt-auto min-h-0 text-sm')}>
                {t('history.all')}
            </Link>
        </article>
    );
}

function RulesTile({ rules }: { rules: Overview['rules'] }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <article
            aria-labelledby="dashboard-rules"
            className={cn(tile, 'border-stone-200/70 bg-canvas-strong @min-[640px]:col-span-2 dark:bg-neutral-900/40')}
        >
            <p className={eyebrow}>{t('rules.eyebrow')}</p>
            <h3 id="dashboard-rules" className="text-lg leading-snug font-semibold text-balance">
                {t('rules.title')}
            </h3>
            {rules.length === 0 ? (
                <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t('rules.empty')}</p>
            ) : (
                <ul>
                    {rules.map((rule) => (
                        <li key={rule.id} className="border-t border-stone-200 dark:border-neutral-800">
                            <a
                                href={rule.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t('rules.open_label', { name: rule.name ?? t('rules.nationwide') })}
                                className="flex min-h-12 items-center gap-3"
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-[15px] font-semibold">{rule.name ?? t('rules.nationwide')}</span>
                                    <span className="text-[13px] text-stone-600 dark:text-stone-400">
                                        {t(rule.nationwide ? 'rules.nationwide' : 'rules.municipality')}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                                    {t('rules.open')}
                                    <ExternalLink className="size-3.5" aria-hidden />
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}

function FavoritesTile({ favorites }: { favorites: Overview['favorites'] }) {
    const { t } = useTranslation('backend/dashboard');
    const { t: tModals } = useTranslation('frontend/map/modals');
    const parkingTime = useParkingTime();
    const conditions = (item: Overview['favorites']['items'][number]) =>
        [
            item.parking_time ? t('favorites.max_time', { time: parkingTime(item.parking_time) }) : null,
            item.restriction_days?.length
                ? item.restriction_days.map((day) => tModals(`community.days.${day}` as 'community.days.mon')).join(', ')
                : null,
            item.restriction_starts_at && item.restriction_ends_at
                ? `${item.restriction_starts_at.slice(0, 5)}–${item.restriction_ends_at.slice(0, 5)}`
                : null,
        ].filter((value): value is string => Boolean(value));

    return (
        <article aria-labelledby="dashboard-favorites" className={cn(tile, 'pb-2 @min-[640px]:col-span-2')}>
            <div className="flex items-center justify-between gap-3">
                <h3 id="dashboard-favorites" className={eyebrow}>
                    {t('favorites.eyebrow')}
                </h3>
                {favorites.total > 0 && (
                    <Link href={favoritesIndex.url()} className={cn(textLink, 'min-h-0 text-sm')}>
                        {t('favorites.all')}
                    </Link>
                )}
            </div>
            {favorites.items.length === 0 ? (
                <div className="flex flex-col gap-1 pb-3">
                    <p className="text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{t('favorites.empty')}</p>
                    <Link href={mapPage()} className={cn(textLink, 'self-start')}>
                        {t('favorites.open_map')}
                    </Link>
                </div>
            ) : (
                <ul className="-mx-5.5">
                    {favorites.items.map((item) => {
                        const title = item.title || t('favorites.untitled');
                        return (
                            <li
                                key={item.favorite_id}
                                className="flex items-center gap-3.5 border-t border-stone-100 px-5.5 py-2.5 dark:border-neutral-800"
                            >
                                <Pin garage={item.source === 'offstreet'} className="h-8 w-6" />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[15px] font-semibold">{title}</span>
                                    <span className="text-[13px] text-stone-600 dark:text-stone-400">
                                        {[t(`sources.${item.source}`), item.municipality].filter(Boolean).join(' · ')}
                                    </span>
                                    {conditions(item).length > 0 && (
                                        <span className="mt-1 flex flex-wrap gap-1">
                                            {conditions(item).map((condition) => (
                                                <span
                                                    key={condition}
                                                    className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-neutral-800 dark:text-stone-300"
                                                >
                                                    {condition}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </span>
                                <Link
                                    href={item.map_url}
                                    aria-label={t('favorites.view_on_map', { title })}
                                    className={cn(
                                        iconLink,
                                        'border border-stone-200 hover:bg-stone-50 dark:border-neutral-700 dark:hover:bg-neutral-800',
                                    )}
                                >
                                    <MapPin className="size-4.5" aria-hidden />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </article>
    );
}

function AddTile() {
    const { t } = useTranslation('backend/dashboard');

    return (
        <article
            aria-labelledby="dashboard-add"
            className="relative min-h-60 overflow-hidden rounded-xl border border-stone-200 @min-[640px]:col-span-2 @min-[1100px]:col-span-4 dark:border-neutral-800"
        >
            <img src={MAP_IMAGE} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-150 object-cover object-[60%_70%]" />
            <span className="absolute top-[22%] left-1/2 -translate-x-1/2">
                <Pin className="h-12 w-9" />
            </span>
            <div className="absolute inset-x-5 bottom-5 flex flex-col gap-3 rounded-lg bg-white px-4 py-3.5 shadow-[0_8px_24px_rgb(28_25_23/16%)] sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-900">
                <span className="flex flex-col gap-0.5">
                    <h3 id="dashboard-add" className="text-[15px] font-semibold">
                        {t('add.title')}
                    </h3>
                    <span className="text-[13px] text-stone-600 dark:text-stone-400">{t('add.text')}</span>
                </span>
                <Link href={locationMap.add()} className={darkButton}>
                    <Plus className="size-4" aria-hidden />
                    {t('add_location')}
                </Link>
            </div>
        </article>
    );
}

function HistoryTile({ history }: { history: Contribution[] }) {
    const { t, i18n } = useTranslation('backend/dashboard');

    return (
        <article aria-labelledby="dashboard-history" className={cn(tile, 'pb-2 @min-[640px]:col-span-2 @min-[1100px]:col-span-4')}>
            <div className="flex items-center justify-between gap-3">
                <h3 id="dashboard-history" className={eyebrow}>
                    {t('history.eyebrow')}
                </h3>
                <Link href={contributionsIndex.url()} className={cn(textLink, 'min-h-0 text-sm')}>
                    {t('history.all')}
                </Link>
            </div>
            {history.length === 0 ? (
                <p className="pb-3 text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{t('history.empty')}</p>
            ) : (
                <ul className="-mx-5.5">
                    {history.map((item) => (
                        <li
                            key={item.key}
                            className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-stone-100 px-5.5 py-3 dark:border-neutral-800"
                        >
                            <span className="min-w-0 flex-[1_1_14rem] text-[15px] font-semibold">{item.label ?? t('activity.unknown_place')}</span>
                            <span className="flex-[1_1_11rem] text-sm text-stone-600 dark:text-stone-400">
                                {t(`contributions.kinds.${item.kind}`)}
                            </span>
                            <time dateTime={item.at} className="w-24 text-sm text-stone-500 tabular-nums max-sm:hidden">
                                {formatShortDate(item.at, i18n.language)}
                            </time>
                            <Chip tone={statusChip[item.status].tone}>{t(`contributions.status.${item.status}`)}</Chip>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}

function Workplace({ todo, overview }: { todo: Todo; overview?: Overview }) {
    const { t } = useTranslation('backend/dashboard');
    const greeting = useGreeting();
    const moderationTotal = todo.moderation?.total ?? 0;
    const attentionTotal = todo.sources.total + todo.rules.total;
    const total = moderationTotal + attentionTotal;
    // With an empty moderation queue, the first source or rule takes the main card and leaves the attention list.
    const lead: AttentionItem | null = todo.next
        ? null
        : todo.sources.items[0]
          ? { kind: 'source', source: todo.sources.items[0] }
          : todo.rules.items[0]
            ? { kind: 'rule', rule: todo.rules.items[0] }
            : null;
    const queueShown = moderationTotal > 0;
    const doneShown = Boolean(lead && todo.moderation && !queueShown);
    const attentionShown = todo.attention && (!lead || attentionTotal > 1);

    return (
        <>
            <header className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex flex-col gap-3">
                    <span className="text-[15px] font-medium text-stone-600 dark:text-stone-400">{greeting}</span>
                    <h1 className="text-4xl leading-[1.04] font-bold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
                        {total > 0 ? t('work.title', { count: total }) : t('work.nothing')}
                    </h1>
                    {attentionTotal > 0 && <TaskSummary todo={todo} />}
                </div>
                <ViewSwitch view="work" />
            </header>
            {overview && <PersonalStrip overview={overview} />}
            <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-4">
                {lead ? <AttentionNextTile item={lead} total={total} /> : todo.moderation && <NextTile next={todo.next} total={moderationTotal} />}
                {todo.moderation && queueShown && <QueueTile moderation={todo.moderation} />}
                {doneShown && <ModerationDoneTile wide={!attentionShown} />}
                {todo.decisions && <DecisionsTile decisions={todo.decisions} wide={queueShown ? !attentionShown : !doneShown || !attentionShown} />}
                {attentionShown && <AttentionTile sources={todo.sources} rules={todo.rules} skip={lead} wide={!queueShown || !todo.decisions} />}
            </div>
        </>
    );
}

type AttentionItem = { kind: 'source'; source: Todo['sources']['items'][number] } | { kind: 'rule'; rule: Todo['rules']['items'][number] };

/** What the task count consists of, so the number above it is never a mystery. */
function TaskSummary({ todo }: { todo: Todo }) {
    const { t } = useTranslation('backend/dashboard');
    const link = 'underline decoration-stone-300 underline-offset-4 hover:text-stone-900 dark:decoration-neutral-600 dark:hover:text-stone-100';

    return (
        <p className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-sm text-stone-600 dark:text-stone-400">
            {todo.moderation &&
                (todo.moderation.total > 0 ? (
                    <Link href={app.moderation.index()} className={link}>
                        {t('work.summary.moderation', { count: todo.moderation.total })}
                    </Link>
                ) : (
                    <Link href={app.moderation.index()} className={cn(link, 'inline-flex items-center gap-1.5')}>
                        <Check className="size-3.5 text-green-700 dark:text-green-400" strokeWidth={2.5} aria-hidden />
                        {t('work.summary.moderation_done')}
                    </Link>
                ))}
            {todo.sources.total > 0 && (
                <Link href={municipalImports.url({ query: { status: 'attention' } })} className={link}>
                    {t('work.summary.sources', { count: todo.sources.total })}
                </Link>
            )}
            {todo.rules.total > 0 && (
                <Link href={parkingRules.index.url()} className={link}>
                    {t('work.summary.rules', { count: todo.rules.total })}
                </Link>
            )}
        </p>
    );
}

function PersonalStrip({ overview }: { overview: Overview }) {
    const { t } = useTranslation('backend/dashboard');
    const garage = overview.garage ? garageLiveState(overview.garage) : null;
    const parts = [
        overview.pending && (
            <span key="pending" className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-orange-600" aria-hidden />
                {t('work.strip.pending', { label: overview.pending.label ?? t('activity.unknown_place') })}
            </span>
        ),
        overview.garage && garage?.free !== null && garage?.free !== undefined && (
            <span key="garage" className="flex items-center gap-1.5 text-sm">
                <span className="font-bold text-green-700 tabular-nums dark:text-green-400">{garage.free}</span>
                {t('work.strip.garage', { name: overview.garage.name })}
            </span>
        ),
    ].filter(Boolean);

    return (
        <Link
            href={dashboard.url({ query: { view: 'personal' } })}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-stone-200 bg-white px-4.5 py-3.5 hover:bg-stone-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
            <span className={eyebrow}>{t('work.strip.label')}</span>
            {parts.length > 0 ? parts : <span className="text-sm text-stone-600 dark:text-stone-400">{t('work.strip.empty')}</span>}
            <span className="ml-auto text-[15px] font-semibold text-orange-700 dark:text-orange-400">{t('work.strip.open')}</span>
        </Link>
    );
}

function sourceAttentionUrl(source: Todo['sources']['items'][number]): string {
    return source.import_id ? importShow.url(source.import_id) : municipalImports.url({ query: { source: source.id } });
}

function useRuleBrokenText() {
    const { t, i18n } = useTranslation('backend/dashboard');

    return (rule: Todo['rules']['items'][number]) =>
        rule.failing_since
            ? t('work.attention.rule_broken', { date: formatShortDate(rule.failing_since, i18n.language) })
            : t('work.attention.rule_broken_unknown');
}

/** The verb on the button says what the next step is for this kind of attention. */
function attentionAction(item: AttentionItem): 'review' | 'approve' | 'inspect' | 'rule' {
    if (item.kind === 'rule') return 'rule';
    if (item.source.status === 'awaiting_review') return 'review';

    return item.source.status === 'awaiting_approval' || item.source.status === 'reapproval' ? 'approve' : 'inspect';
}

/** The same dark card as the next moderation item, so a source or rule reads as the next task rather than an alarm. */
function AttentionNextTile({ item, total }: { item: AttentionItem; total: number }) {
    const { t } = useTranslation('backend/dashboard');
    const ruleBroken = useRuleBrokenText();
    const Icon = item.kind === 'source' ? Database : Link2Off;

    return (
        <article
            aria-labelledby="dashboard-next"
            className="flex min-w-0 flex-col gap-3.5 rounded-xl bg-stone-900 p-6 text-white @min-[640px]:col-span-2 @min-[1100px]:row-span-2 dark:bg-neutral-900"
        >
            <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-stone-800 text-orange-300">
                <Icon className="size-6.5" strokeWidth={1.75} />
            </span>
            <span className="mt-2.5 text-sm font-semibold text-orange-300">{t('work.attention.next', { total })}</span>
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="zinc">{t(item.kind === 'source' ? 'work.attention.source' : 'work.attention.rule')}</Chip>
            </div>
            <h2 id="dashboard-next" className="text-3xl leading-tight font-bold tracking-tight wrap-break-word">
                {item.kind === 'source' ? item.source.name : (item.rule.name ?? t('work.attention.nationwide'))}
            </h2>
            <p className="text-[15px] leading-relaxed text-stone-300">
                {item.kind === 'source' ? t(`todo.source.${item.source.status}`) : ruleBroken(item.rule)}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                    href={item.kind === 'source' ? sourceAttentionUrl(item.source) : parkingRules.index.url()}
                    className={cn(darkButton, 'bg-white text-stone-900 hover:bg-stone-200')}
                >
                    {t(`work.attention.actions.${attentionAction(item)}`)}
                    <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                    href={item.kind === 'source' ? municipalImports.url({ query: { status: 'attention' } }) : parkingRules.index.url()}
                    className="inline-flex min-h-11 items-center font-semibold text-orange-300 hover:text-orange-200"
                >
                    {t(item.kind === 'source' ? 'work.attention.all_sources' : 'work.attention.all_rules')}
                </Link>
            </div>
        </article>
    );
}

/** An empty queue next to other work: a small confirmation instead of a tile full of zeros. */
function ModerationDoneTile({ wide }: { wide: boolean }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <article
            aria-labelledby="dashboard-queue"
            className={cn(
                'flex min-w-0 flex-col gap-2.5 rounded-xl border border-green-200 bg-green-50/60 p-5.5 dark:border-green-900 dark:bg-green-950/20',
                wide && '@min-[640px]:col-span-2',
            )}
        >
            <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm ring-1 ring-green-900/5 dark:bg-green-900 dark:text-green-300 dark:ring-green-300/10"
            >
                <CheckCircle2 className="size-5.5" strokeWidth={1.75} />
            </span>
            <h3 id="dashboard-queue" className="mt-1.5 text-xs font-semibold tracking-wider text-green-800 uppercase dark:text-green-300">
                {t('work.queue.moderation')}
            </h3>
            <p className="text-xl font-bold tracking-tight text-green-950 dark:text-green-50">{t('work.next.done')}</p>
            <p className="text-sm leading-relaxed text-green-900/75 dark:text-green-200/80">{t('work.queue.done')}</p>
        </article>
    );
}

function NextTile({ next, total }: { next: Todo['next']; total: number }) {
    const { t } = useTranslation('backend/dashboard');
    const ago = useAgo();

    if (!next) {
        return (
            <article
                aria-labelledby="dashboard-next"
                className="flex min-h-80 min-w-0 flex-col items-center justify-center gap-6 rounded-xl border border-green-200 bg-green-50/60 px-6 py-12 text-center @min-[640px]:col-span-2 @min-[1100px]:row-span-2 dark:border-green-900 dark:bg-green-950/20"
            >
                <div
                    aria-hidden
                    className="flex size-24 items-center justify-center rounded-full border border-green-200/70 bg-green-100/60 dark:border-green-900 dark:bg-green-950/60"
                >
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-white text-green-700 shadow-sm ring-1 ring-green-900/5 dark:bg-green-900 dark:text-green-300 dark:ring-green-300/10">
                        <CheckCircle2 className="size-8" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="flex max-w-sm flex-col gap-3">
                    <h2 id="dashboard-next" className="text-3xl leading-tight font-bold tracking-tight text-green-950 dark:text-green-50">
                        {t('work.next.done')}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-green-900/75 dark:text-green-200/80">{t('work.next.done_description')}</p>
                </div>
                <Link
                    href={app.moderation.index()}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-green-800 underline underline-offset-4 dark:text-green-300"
                >
                    {t('work.next.queue')}
                </Link>
            </article>
        );
    }

    return (
        <article
            aria-labelledby="dashboard-next"
            className="flex flex-col overflow-hidden rounded-xl bg-stone-900 text-white @min-[640px]:col-span-2 @min-[1100px]:row-span-2 dark:bg-neutral-900"
        >
            <div aria-hidden className="relative h-48 overflow-hidden sm:h-56">
                <img src={MAP_IMAGE} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-160 object-cover object-[40%_50%]" />
                <span className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Pin garage={false} className="h-12 w-9" />
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-3.5 p-6">
                <span className="text-sm font-semibold text-orange-300">{t('work.next.eyebrow', { total })}</span>
                <div className="flex flex-wrap gap-1.5">
                    <Chip tone={next.type === 'report' ? 'red' : 'zinc'}>{t(`work.queue.types.${next.type}`)}</Chip>
                    {next.priority === 'high' && (
                        <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">{t('work.next.high')}</span>
                    )}
                </div>
                <h2 id="dashboard-next" className="text-3xl leading-tight font-bold tracking-tight wrap-break-word">
                    {[next.street || t('work.next.no_address'), next.municipality].filter(Boolean).join(', ')}
                </h2>
                <p className="text-[15px] leading-relaxed text-stone-300">
                    {[
                        (next.reports ?? 0) > 0 ? t('work.next.reports', { count: next.reports ?? 0 }) : null,
                        next.contributor ? t('work.next.by', { name: next.contributor }) : null,
                        t('work.next.waiting', { ago: ago(next.waiting_since) }),
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link href={next.url} className={cn(darkButton, 'bg-white text-stone-900 hover:bg-stone-200')}>
                        {t('work.next.start')}
                        <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    <Link
                        href={app.moderation.index()}
                        className="inline-flex min-h-11 items-center font-semibold text-orange-300 hover:text-orange-200"
                    >
                        {t('work.next.queue')}
                    </Link>
                </div>
            </div>
        </article>
    );
}

function QueueTile({ moderation }: { moderation: NonNullable<Todo['moderation']> }) {
    const { t } = useTranslation('backend/dashboard');
    const ago = useAgo();
    const types = (['submission', 'improvement', 'report'] as const).filter((type) => moderation.types[type] !== undefined || moderation.total === 0);

    return (
        <article aria-labelledby="dashboard-queue" className={cn(tile, '@min-[640px]:col-span-2')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="dashboard-queue" className={eyebrow}>
                    {t('work.queue.eyebrow')}
                </h3>
                {moderation.oldest && <Chip tone="red">{t('work.queue.oldest', { ago: ago(moderation.oldest) })}</Chip>}
            </div>
            <ul className="grid grid-cols-3">
                {types.map((type, index) => (
                    <li key={type} className={cn(index > 0 && 'border-l border-stone-200 pl-5 dark:border-neutral-800')}>
                        <Link href={app.moderation.index({ query: { type } })} className="flex flex-col gap-1">
                            <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">{moderation.types[type] ?? 0}</span>
                            <span className="text-sm text-stone-600 dark:text-stone-400">{t(`work.queue.types.${type}`)}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            <Link href={app.moderation.index()} className={cn(textLink, 'mt-auto')}>
                {t('work.queue.review_all')}
            </Link>
        </article>
    );
}

function DecisionsTile({ decisions, wide }: { decisions: NonNullable<Todo['decisions']>; wide: boolean }) {
    const { t } = useTranslation('backend/dashboard');
    const decided = decisions.approved + decisions.rejected;

    return (
        <article aria-labelledby="dashboard-decisions" className={cn(tile, wide && '@min-[640px]:col-span-2')}>
            <h3 id="dashboard-decisions" className={eyebrow}>
                {t('work.decisions.eyebrow')}
            </h3>
            {decisions.total === 0 ? (
                <p className="text-[15px] text-stone-600 dark:text-stone-400">{t('work.decisions.none')}</p>
            ) : (
                <>
                    <p className="flex items-baseline gap-2">
                        <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">{decisions.total}</span>
                        <span className="text-sm text-stone-600 dark:text-stone-400">{t('work.decisions.week')}</span>
                    </p>
                    {decided > 0 && (
                        <>
                            <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                                <span className="bg-green-600" style={{ flexGrow: decisions.approved }} />
                                <span className="bg-red-600" style={{ flexGrow: decisions.rejected }} />
                            </div>
                            <span className="text-sm text-stone-600 dark:text-stone-400">
                                {t('work.decisions.split', { approved: decisions.approved, rejected: decisions.rejected })}
                            </span>
                        </>
                    )}
                    {decisions.reports > 0 && (
                        <span className="text-sm text-stone-600 dark:text-stone-400">
                            {t('work.decisions.reports', { count: decisions.reports })}
                        </span>
                    )}
                </>
            )}
            <Link href={app.moderation.index({ query: { status: 'decided' } })} className={cn(textLink, 'mt-auto min-h-0 text-sm')}>
                {t('work.decisions.history')}
            </Link>
        </article>
    );
}

function AttentionTile({
    sources,
    rules,
    skip,
    wide,
}: {
    sources: Todo['sources'];
    rules: Todo['rules'];
    skip: AttentionItem | null;
    wide: boolean;
}) {
    const { t } = useTranslation('backend/dashboard');
    const ruleBroken = useRuleBrokenText();
    const item = (key: string, kind: string, name: string, status: ReactNode, href: string) => (
        <li key={key} className="border-t border-stone-100 first:border-t-0 dark:border-neutral-800">
            <Link href={href} className="flex items-center gap-3 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-xs font-semibold text-stone-500">{kind}</span>
                    <span className="truncate text-[15px] font-semibold">{name}</span>
                    {status}
                </span>
                <ChevronRight className="size-4.5 shrink-0 text-stone-400" aria-hidden />
            </Link>
        </li>
    );
    const status = (Icon: LucideIcon, className: string, text: string) => (
        <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', className)}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {text}
        </span>
    );

    return (
        <article aria-labelledby="dashboard-attention" className={cn(tile, wide && '@min-[640px]:col-span-2')}>
            <div className="flex items-center justify-between gap-2">
                <h3 id="dashboard-attention" className={eyebrow}>
                    {t(skip ? 'work.attention.also' : 'work.attention.eyebrow')}
                </h3>
                <span className="text-xs text-stone-500">{t('work.attention.admins')}</span>
            </div>
            {sources.total + rules.total === 0 && (
                <p className="flex items-center gap-2 text-[15px] text-stone-600 dark:text-stone-400">
                    <Check className="size-4 text-green-700 dark:text-green-400" aria-hidden />
                    {t('work.attention.none')}
                </p>
            )}
            <ul className="-my-3 flex flex-col">
                {sources.items
                    .filter((source) => !(skip?.kind === 'source' && skip.source.id === source.id))
                    .map((source) =>
                        item(
                            `source-${source.id}`,
                            t('work.attention.source'),
                            source.name,
                            status(
                                sourceStatusAppearance[source.status].icon,
                                sourceStatusAppearance[source.status].className,
                                t(`todo.source.${source.status}`),
                            ),
                            sourceAttentionUrl(source),
                        ),
                    )}
                {rules.items
                    .filter((rule) => !(skip?.kind === 'rule' && skip.rule.id === rule.id))
                    .map((rule) =>
                        item(
                            `rule-${rule.id}`,
                            t('work.attention.rule'),
                            rule.name ?? t('work.attention.nationwide'),
                            status(Link2Off, 'text-destructive', ruleBroken(rule)),
                            parkingRules.index.url(),
                        ),
                    )}
            </ul>
            {(sources.total > sources.items.length || rules.total > rules.items.length) && (
                <p className="mt-auto flex flex-col gap-1 text-[13px] text-stone-600 dark:text-stone-400">
                    {sources.total > sources.items.length && (
                        <Link href={municipalImports.url({ query: { status: 'attention' } })} className="underline underline-offset-4">
                            {t('work.attention.more_sources', { count: sources.total - sources.items.length })}
                        </Link>
                    )}
                    {rules.total > rules.items.length && (
                        <Link href={parkingRules.index.url()} className="underline underline-offset-4">
                            {t('work.attention.more_rules', { count: rules.total - rules.items.length })}
                        </Link>
                    )}
                </p>
            )}
        </article>
    );
}

function ContributionStatus({ status }: { status: Contribution['status'] }) {
    const { t } = useTranslation('backend/dashboard');
    const Icon = status === 'pending' ? Clock3 : status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : CircleHelp;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                status === 'pending'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : status === 'approved'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : status === 'rejected'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                        : 'bg-stone-100 text-stone-700 dark:bg-neutral-800 dark:text-stone-300',
            )}
        >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {t(`contributions.status.${status}`)}
        </span>
    );
}

function ContributionList({ contributions }: { contributions: Contributions }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const { filters, counts } = contributions;
    const [search, setSearch] = useState(filters.search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [withdrawId, setWithdrawId] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);
    const selected = filters.status ? (filters.status.split(',') as Contribution['status'][]) : [];
    const statuses: Contribution['status'][] = [
        'pending',
        'approved',
        'rejected',
        ...(['kept', 'removed', 'unavailable'] as const).filter((status) => counts[status] || selected.includes(status)),
    ];
    const date = (at: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(at));
    const filtered = Boolean(filters.search || filters.status);

    /** Reload only the list with one filter changed, keeping the others and starting at the first page. */
    const visit = (changes: Partial<Contributions['filters']>) => {
        const next = { ...filters, ...changes };
        router.get(
            contributionsIndex.url(),
            {
                contributions_search: next.search || undefined,
                contributions_status: next.status || undefined,
                contributions_sort: next.sort === 'oldest' ? 'oldest' : undefined,
            },
            { only: ['contributions'], preserveScroll: true, preserveState: true, replace: true },
        );
    };
    /** Searching starts while typing; a short pause keeps one request per word instead of one per letter. */
    const onSearch = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => visit({ search: value.trim() }), 300);
    };
    const actions = (item: Contribution) => (
        <>
            {item.withdraw_id && (
                <Button variant="ghost" size="sm" onClick={() => setWithdrawId(item.withdraw_id)}>
                    {t('contributions.withdraw.label')}
                </Button>
            )}
            {item.url && item.action && (
                <Button asChild variant="outline" size="sm" className="rounded-lg shadow-none">
                    <Link href={item.url}>{t(`contributions.actions.${item.action}`)}</Link>
                </Button>
            )}
        </>
    );
    const empty = (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-muted-foreground">{filtered ? t('contributions.no_results') : t('contributions.empty')}</p>
            {filtered && (
                <Link href={contributionsIndex()} className={cn(textLink, 'text-sm')}>
                    {t('contributions.reset')}
                </Link>
            )}
        </div>
    );
    const SortIcon = filters.sort === 'oldest' ? ArrowUp : ArrowDown;
    const columns: ColumnDef<DataTableFeatures, Contribution>[] = [
        {
            id: 'location',
            header: t('contributions.columns.location'),
            cell: ({ row }) => (
                <div className="min-w-0 whitespace-normal">
                    <p className="font-medium break-words">{row.original.label ?? t('activity.unknown_place')}</p>
                    {row.original.reason && <p className="mt-1 text-xs text-muted-foreground">{row.original.reason}</p>}
                </div>
            ),
        },
        {
            id: 'kind',
            header: t('contributions.columns.kind'),
            cell: ({ row }) => <span className="text-stone-600 dark:text-stone-300">{t(`contributions.kinds.${row.original.kind}`)}</span>,
        },
        {
            id: 'status',
            header: t('contributions.columns.status'),
            cell: ({ row }) => <ContributionStatus status={row.original.status} />,
        },
        {
            id: 'date',
            header: () => (
                <button
                    type="button"
                    onClick={() => visit({ sort: filters.sort === 'oldest' ? 'newest' : 'oldest' })}
                    aria-label={t(filters.sort === 'oldest' ? 'contributions.sort.newest' : 'contributions.sort.oldest')}
                    className="inline-flex items-center gap-1 rounded-sm py-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                    {t('contributions.columns.date')}
                    <SortIcon className="size-4" aria-hidden />
                </button>
            ),
            cell: ({ row }) => (
                <time dateTime={row.original.at} className="text-muted-foreground tabular-nums">
                    {date(row.original.at)}
                </time>
            ),
        },
        {
            id: 'actions',
            header: () => <span className="sr-only">{t('contributions.columns.actions')}</span>,
            meta: { align: 'right' },
            cell: ({ row }) => <div className="flex flex-wrap justify-end gap-1">{actions(row.original)}</div>,
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <p className="-mt-2 text-sm text-muted-foreground">{t('contributions.description')}</p>
            {withdrawId && (
                <ConfirmDialog
                    title={t('contributions.withdraw.title')}
                    description={t('contributions.withdraw.description')}
                    confirmText={t('contributions.withdraw.label')}
                    cancelText={t('contributions.withdraw.cancel')}
                    variant="destructive"
                    disabled={withdrawing}
                    onClose={() => setWithdrawId(null)}
                    onConfirm={() => {
                        setWithdrawing(true);
                        router.delete(withdrawSubmission.url(withdrawId), {
                            preserveScroll: true,
                            onFinish: () => {
                                setWithdrawing(false);
                                setWithdrawId(null);
                            },
                        });
                    }}
                />
            )}
            <div className="flex flex-wrap items-center gap-2">
                <label role="search" className="relative w-full sm:w-96">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder={t('contributions.search')}
                        aria-label={t('contributions.search')}
                        maxLength={200}
                        className="h-11 rounded-xl bg-white pl-9 shadow-none dark:bg-neutral-900"
                    />
                </label>
                <DataTableFacetFilter
                    title={t('contributions.columns.status')}
                    selected={selected}
                    options={statuses.map((status) => ({ value: status, label: t(`contributions.status.${status}`), count: counts[status] ?? 0 }))}
                    onChange={(next) => visit({ status: next.join(',') || null })}
                    onClear={() => visit({ status: null })}
                />
            </div>
            <div className="hidden md:block">
                <DataTable columns={columns} data={contributions.data} toolbar={null} enableSorting={false} emptyState={empty} />
            </div>
            <ul className="border-t border-stone-200 md:hidden dark:border-neutral-800">
                {contributions.data.length === 0 && <li>{empty}</li>}
                {contributions.data.map((item) => (
                    <li key={item.key} className="flex flex-col gap-2 border-b border-stone-200 py-4 dark:border-neutral-800">
                        <p className="font-medium break-words">{item.label ?? t('activity.unknown_place')}</p>
                        <p className="text-xs text-muted-foreground">
                            {t(`contributions.kinds.${item.kind}`)} · {date(item.at)}
                        </p>
                        {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <ContributionStatus status={item.status} />
                            <div className="flex flex-wrap gap-1">{actions(item)}</div>
                        </div>
                    </li>
                ))}
            </ul>
            {contributions.total > 0 && <DataTablePagination pagination={contributions} />}
        </div>
    );
}

function ListSkeleton() {
    return (
        <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="h-10 animate-pulse rounded-md bg-stone-200/70 dark:bg-neutral-800" />
            ))}
        </div>
    );
}

function TilesSkeleton({ hero = false }: { hero?: boolean }) {
    return (
        <div className="flex flex-col gap-10" aria-hidden>
            {hero && <div className="h-105 animate-pulse rounded-2xl bg-stone-200/70 dark:bg-neutral-800" />}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="h-56 animate-pulse rounded-xl bg-stone-200/70 md:col-span-2 dark:bg-neutral-800" />
                <div className="h-56 animate-pulse rounded-xl bg-stone-200/70 dark:bg-neutral-800" />
                <div className="h-56 animate-pulse rounded-xl bg-stone-200/70 dark:bg-neutral-800" />
            </div>
        </div>
    );
}
