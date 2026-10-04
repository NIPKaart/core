import { show as importShow, index as municipalImports } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import ContributionsMap, { type MapPlace } from '@/components/map/contributions-map';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { dashboard, locationMap as mapPage } from '@/routes';
import app from '@/routes/app';
import locationMap from '@/routes/location-map';
import notifications from '@/routes/notifications';
import profile from '@/routes/profile';
import type { SharedData } from '@/types';
import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { ArrowRight, ChevronRight, Flag, MapPinPlus, PencilLine, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ItemType = 'submission' | 'improvement' | 'report';

type QueuePreviewItem = {
    key: string;
    type: ItemType;
    priority: 'high' | 'normal';
    street: string | null;
    municipality: string | null;
    contributor: string | null;
    reports: number | null;
    waiting_since: string;
    url: string;
};

type Todo = {
    moderation: { total: number; high: number; types: Partial<Record<ItemType, number>>; oldest: string | null } | null;
    queue: QueuePreviewItem[];
    sources: { total: number; items: { id: number; name: string; status: string; import_id: number | null; since: string | null }[] };
};

type ActivityEvent = {
    key: string;
    kind: string;
    at: string;
    unread: boolean;
    url: string | null;
    params: { space_label?: string | null; status?: string; new_status?: string; reason?: string; changes?: string[] };
};

type Favorite = {
    favorite_id: number;
    available: boolean;
    type: string;
    title: string;
    city: string | null;
    municipality: { name: string } | null;
    map_url: string | null;
};

type Stats = { added: number; published: number; pending: number; confirmed: number };

type PageProps = {
    profile: { name: string; role: string | null; member_since: string | null };
    hasTodo: boolean;
    todo?: Todo;
    activity?: ActivityEvent[];
    map?: { spaces: (MapPlace & { status: string })[]; favorites: MapPlace[] };
    stats: Stats;
    favorites: Favorite[];
};

/**
 * The page people land on after signing in. People who moderate get their workplace: the first items in the queue and
 * the data sources that need them, with everything about themselves in a side column. Everyone else starts from their
 * figures and their own map. Plain sections and dividers; no cards in cards.
 */
export default function Dashboard({ profile: person, hasTodo, todo, activity, map, stats, favorites }: PageProps) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const { auth } = usePage<SharedData>().props;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const today = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

    const header = (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t(`greeting.${greeting}`, { name: auth.user.name.split(' ')[0] })}</h1>
                <p className="text-sm text-muted-foreground first-letter:uppercase">{today}</p>
            </div>
            <Button asChild className="bg-orange-700 text-white hover:bg-orange-600">
                <Link href={locationMap.add()}>
                    <Plus />
                    {t('add_location')}
                </Link>
            </Button>
        </header>
    );

    const mapSection = (size: string) => (
        <section aria-labelledby="map-title" className="flex flex-col gap-3">
            <SectionHeading id="map-title" title={t('map.title')} href={mapPage()} link={t('map.open')} />
            <Deferred data="map" fallback={<div className={cn('animate-pulse rounded-xl bg-muted', size)} aria-hidden />}>
                {map && (
                    <>
                        <ContributionsMap spaces={map.spaces} favorites={map.favorites} className={size} />
                        <MapLegend stats={stats} favorites={map.favorites.length} />
                    </>
                )}
            </Deferred>
        </section>
    );

    const activitySection = (
        <section aria-labelledby="activity-title">
            <SectionHeading id="activity-title" title={t('activity.title')} href={notifications.index()} link={t('activity.all')} />
            <Deferred data="activity" fallback={<ListSkeleton />}>
                {activity && <ActivityList events={activity} />}
            </Deferred>
        </section>
    );

    const favoritesSection = (
        <section aria-labelledby="favorites-title">
            <SectionHeading id="favorites-title" title={t('favorites.title')} href={profile.favorites.index()} link={t('favorites.all')} />
            <FavoriteList favorites={favorites} />
        </section>
    );

    if (hasTodo) {
        return (
            <AppLayout breadcrumbs={[{ title: t('title'), href: dashboard() }]}>
                <Head title={t('title')} />
                <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_21rem]">
                    <div className="flex min-w-0 flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8">
                        {header}
                        <Deferred data="todo" fallback={<ListSkeleton rows={5} />}>
                            <Workplace todo={todo} />
                        </Deferred>
                    </div>
                    <aside className="flex flex-col gap-8 border-t bg-muted/20 px-4 py-6 sm:px-8 lg:border-t-0 lg:border-l lg:px-7 lg:py-8">
                        <Profile person={person} />
                        <StatGrid stats={stats} />
                        {mapSection('h-56')}
                        {activitySection}
                        {favoritesSection}
                    </aside>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: dashboard() }]}>
            <Head title={t('title')} />
            <div className="flex w-full flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
                {header}
                <StatStrip stats={stats} />
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    {mapSection('h-80 lg:h-[28rem]')}
                    <div className="flex flex-col gap-8">
                        {activitySection}
                        {favoritesSection}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function SectionHeading({ id, title, href, link }: { id: string; title: string; href: Parameters<typeof Link>[0]['href']; link: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 pb-2">
            <h2 id={id} className="text-sm font-semibold">
                {title}
            </h2>
            <Link href={href} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                {link}
            </Link>
        </div>
    );
}

function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
                <div key={row} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
        </div>
    );
}

/** The person this dashboard belongs to. */
function Profile({ person }: { person: PageProps['profile'] }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const initials = person.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    const since = person.member_since
        ? new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(person.member_since))
        : null;

    return (
        <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold dark:bg-neutral-700">
                {initials}
            </span>
            <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{person.name}</span>
                <span className="text-xs text-muted-foreground">
                    {[person.role, since && t('profile.since', { date: since })].filter(Boolean).join(' · ')}
                </span>
            </span>
        </div>
    );
}

const STAT_KEYS = ['added', 'published', 'pending', 'confirmed'] as const;

function StatGrid({ stats }: { stats: Stats }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <section aria-labelledby="stats-title">
            <h2 id="stats-title" className="mb-3 text-sm font-semibold">
                {t('stats.title')}
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {STAT_KEYS.map((key) => (
                    <div key={key}>
                        <dt className="text-sm text-muted-foreground">{t(`stats.${key}`)}</dt>
                        <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{stats[key]}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/** The person's own figures in one band, divided rather than boxed. */
function StatStrip({ stats }: { stats: Stats }) {
    const { t } = useTranslation('backend/dashboard');

    return (
        <dl className="grid grid-cols-2 rounded-lg border sm:grid-cols-4">
            {STAT_KEYS.map((key, index) => (
                <div
                    key={key}
                    className={cn(
                        'flex flex-col gap-1 px-5 py-4',
                        index % 2 === 1 && 'border-l',
                        index > 1 && 'border-t sm:border-t-0',
                        index === 2 && 'sm:border-l',
                    )}
                >
                    <dt className="text-sm text-muted-foreground">{t(`stats.${key}`)}</dt>
                    <dd className="text-3xl font-semibold tabular-nums">{stats[key]}</dd>
                    <dd className="text-xs text-muted-foreground">{t(`stats.hint.${key}`)}</dd>
                </div>
            ))}
        </dl>
    );
}

function MapLegend({ stats, favorites }: { stats: Stats; favorites: number }) {
    const { t } = useTranslation('backend/dashboard');
    const entries = [
        { color: 'bg-[#2AAD27]', label: t('map.legend.published', { count: stats.published }) },
        { color: 'bg-[#CB8427]', label: t('map.legend.pending', { count: stats.pending }) },
        { color: 'bg-[#9C2BCB]', label: t('map.legend.favorites', { count: favorites }) },
    ];

    return (
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {entries.map((entry) => (
                <span key={entry.label} className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2.5 rounded-full', entry.color)} aria-hidden />
                    {entry.label}
                </span>
            ))}
        </p>
    );
}

const TYPE_ICONS = { submission: MapPinPlus, improvement: PencilLine, report: Flag } satisfies Record<ItemType, unknown>;

/** The first items in the moderation queue and the data sources that wait, each opening the work directly. */
function Workplace({ todo }: { todo?: Todo }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const { t: tModeration } = useTranslation('backend/moderation');
    const ago = useAgo();
    if (!todo) return null;
    const { moderation, queue, sources } = todo;

    return (
        <div className="flex flex-col gap-10">
            {moderation && (
                <section aria-labelledby="queue-title" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 id="queue-title" className="text-sm font-semibold">
                            {t('todo.queue_title')}
                            {moderation.total > 0 && (
                                <span className="ml-2 font-normal text-muted-foreground">
                                    {[
                                        t('todo.queue_count', { count: moderation.total }),
                                        moderation.oldest && t('todo.oldest', { ago: ago(moderation.oldest) }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            )}
                        </h2>
                        {moderation.total > 0 && (
                            <Button asChild size="sm">
                                <Link href={app.moderation.index()}>
                                    {t('todo.review_all')}
                                    <ArrowRight />
                                </Link>
                            </Button>
                        )}
                    </div>
                    {queue.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                            {t('todo.moderation_done')}
                        </p>
                    ) : (
                        <ul className="divide-y overflow-hidden rounded-lg border">
                            {queue.map((item) => {
                                const Icon = TYPE_ICONS[item.type];
                                return (
                                    <li key={item.key}>
                                        <Link
                                            href={item.url}
                                            className={cn(
                                                'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-l-3 px-4 py-3 text-sm hover:bg-muted/50 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto_1rem] sm:gap-4',
                                                item.priority === 'high' ? 'border-l-orange-500' : 'border-l-transparent',
                                            )}
                                        >
                                            <span className="inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                <Icon className="size-3" aria-hidden />
                                                {tModeration(`types.${item.type}`)}
                                            </span>
                                            <span className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1 sm:truncate">
                                                <span className="font-medium">{item.street || tModeration('no_address')}</span>
                                                <span className="text-muted-foreground">
                                                    {[item.municipality, item.contributor].filter(Boolean).map((part) => ` · ${part}`)}
                                                </span>
                                                {(item.reports ?? 0) > 1 && (
                                                    <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                                        {tModeration('flags.reports', { count: item.reports })}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="justify-self-end text-muted-foreground sm:justify-self-auto">
                                                {ago(item.waiting_since)}
                                            </span>
                                            <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {moderation.total > queue.length && (
                        <p className="text-sm text-muted-foreground">
                            {moderation.high > 0 && <Flag className="mr-1 inline size-3.5 -translate-y-px text-orange-500" aria-hidden />}
                            {t('todo.more_items', { count: moderation.total - queue.length })} ·{' '}
                            {(['submission', 'improvement', 'report'] as const)
                                .filter((type) => moderation.types[type])
                                .map((type) => t(`todo.types.${type}`, { count: moderation.types[type] }))
                                .join(', ')}
                        </p>
                    )}
                </section>
            )}

            {sources.total > 0 && (
                <section aria-labelledby="sources-title" className="flex flex-col gap-2">
                    <h2 id="sources-title" className="text-sm font-semibold">
                        {t('todo.sources_title')}
                    </h2>
                    <ul>
                        {sources.items.map((source) => (
                            <li key={source.id} className="grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-4 border-t py-3 last:border-b">
                                <span
                                    className={cn('size-2 rounded-full', source.status === 'awaiting_review' ? 'bg-blue-600' : 'bg-amber-500')}
                                    aria-hidden
                                />
                                <span className="min-w-0 text-sm">
                                    <span className="block font-medium">{source.name}</span>
                                    <span className="text-muted-foreground">
                                        {t(`todo.source.${source.status}`)}
                                        {source.since &&
                                            ` · ${new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(source.since))}`}
                                    </span>
                                </span>
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={source.import_id ? importShow(source.import_id) : municipalImports({ query: { status: 'attention' } })}
                                    >
                                        {t('todo.check')}
                                    </Link>
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {sources.total > sources.items.length && (
                        <Link
                            href={municipalImports({ query: { status: 'attention' } })}
                            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            {t('todo.more_sources', { count: sources.total - sources.items.length })}
                        </Link>
                    )}
                </section>
            )}
        </div>
    );
}

const TONES = {
    positive: 'bg-green-600',
    pending: 'bg-amber-500',
    negative: 'bg-red-600',
    improvement: 'bg-muted-foreground/50',
    saved: 'bg-muted-foreground/50',
    neutral: 'bg-muted-foreground/50',
} as const;

/** How one event reads: its sentence, an optional detail and the tone of its marker. */
function useEventText() {
    const { t } = useTranslation('backend/dashboard');
    const { t: tNotification } = useTranslation('global/notification');
    const { t: tModeration, i18n } = useTranslation('backend/moderation');
    /** "Gewijzigd: vak en onderbord." for the change groups an approved improvement applied. */
    const changed = (groups?: string[]) =>
        groups?.length
            ? t('activity.changed', {
                  fields: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
                      groups.map((group) => tModeration(`groups.${group}`).toLowerCase()),
                  ),
              })
            : null;

    return (event: ActivityEvent): { text: string; detail: string | null; tone: keyof typeof TONES } => {
        const place = event.params.space_label || t('activity.unknown_place');
        const reason = event.params.reason ? tNotification('reason', { reason: tNotification(`reasons.${event.params.reason}`) }) : null;

        switch (event.kind) {
            case 'added': {
                const status = event.params.status ?? 'pending';
                return {
                    text: t('activity.added', { place }),
                    detail: t(`activity.status.${status}`),
                    tone: status === 'approved' ? 'positive' : status === 'rejected' ? 'negative' : 'pending',
                };
            }
            case 'proposed':
                return { text: t('activity.proposed', { place }), detail: null, tone: 'improvement' };
            case 'saved':
                return { text: t('activity.saved', { place }), detail: null, tone: 'saved' };
            case 'community.space_status_changed': {
                const status = event.params.new_status;
                return status === 'approved'
                    ? { text: t('activity.published', { place }), detail: t('activity.published_detail'), tone: 'positive' }
                    : status === 'rejected'
                      ? { text: t('activity.rejected', { place }), detail: null, tone: 'negative' }
                      : { text: t('activity.status_changed', { place }), detail: null, tone: 'neutral' };
            }
            case 'community.improvement_approved':
                return { text: t('activity.improvement_approved', { place }), detail: changed(event.params.changes), tone: 'positive' };
            case 'community.improvement_rejected':
                return { text: t('activity.improvement_rejected', { place }), detail: reason, tone: 'negative' };
            case 'report.place_kept':
                return { text: t('activity.report_kept', { place }), detail: t('activity.report_kept_detail'), tone: 'neutral' };
            case 'report.place_removed':
                return { text: t('activity.report_removed', { place }), detail: reason, tone: 'neutral' };
            case 'community.space_deleted':
                return { text: t('activity.deleted', { place }), detail: null, tone: 'negative' };
            case 'community.space_restored':
                return { text: t('activity.restored', { place }), detail: null, tone: 'positive' };
            default:
                return { text: place, detail: null, tone: 'neutral' };
        }
    };
}

/** Recent events as a compact list: a coloured dot for the outcome, the sentence and when. */
function ActivityList({ events }: { events: ActivityEvent[] }) {
    const { t } = useTranslation('backend/dashboard');
    const ago = useAgo();
    const describe = useEventText();

    if (events.length === 0) {
        return <p className="border-t py-4 text-sm text-muted-foreground">{t('activity.empty')}</p>;
    }

    return (
        <ol>
            {events.map((event) => {
                const { text, detail, tone } = describe(event);
                const sentence = <span className={cn('text-sm', event.unread && 'font-medium')}>{text}</span>;

                return (
                    <li key={event.key} className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 border-t py-2.5">
                        <span className={cn('mt-1.5 size-2 rounded-full', TONES[tone])} aria-hidden />
                        <span className="flex min-w-0 flex-col">
                            {event.url ? (
                                <a href={event.url} className="hover:underline hover:underline-offset-4">
                                    {sentence}
                                </a>
                            ) : (
                                sentence
                            )}
                            <span className="text-xs text-muted-foreground">{[detail, ago(event.at)].filter(Boolean).join(' · ')}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function FavoriteList({ favorites }: { favorites: Favorite[] }) {
    const { t } = useTranslation('backend/dashboard');

    if (favorites.length === 0) {
        return <p className="border-t py-4 text-sm text-muted-foreground">{t('favorites.empty')}</p>;
    }

    return (
        <ul>
            {favorites.map((favorite) => (
                <li key={favorite.favorite_id} className="flex items-baseline justify-between gap-3 border-t py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                        <span className="font-medium">{favorite.title || t('favorites.untitled')}</span>
                        {(favorite.city ?? favorite.municipality?.name) && (
                            <span className="text-muted-foreground"> · {favorite.city ?? favorite.municipality?.name}</span>
                        )}
                    </span>
                    {favorite.map_url ? (
                        <a href={favorite.map_url} className="shrink-0 text-muted-foreground underline underline-offset-4 hover:text-foreground">
                            {t('favorites.view_on_map')}
                        </a>
                    ) : (
                        <span className="shrink-0 text-muted-foreground">{t('favorites.unavailable')}</span>
                    )}
                </li>
            ))}
        </ul>
    );
}
