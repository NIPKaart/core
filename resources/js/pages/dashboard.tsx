import { show as importShow, index as municipalImports } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Destinations from '@/components/map/destinations';
import Favorites from '@/components/map/favorites';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { destinationMapUrl, favoriteMapUrl, favoriteParkingResult } from '@/lib/saved-places';
import { cn } from '@/lib/utils';
import type { SourceStatusKey } from '@/pages/backend/imports/source-status';
import { dashboard, locationMap as mapPage } from '@/routes';
import app from '@/routes/app';
import locationMap from '@/routes/location-map';
import { destroy as withdrawSubmission } from '@/routes/profile/parking-spaces';
import { Deferred, Head, Link, router } from '@inertiajs/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { ArrowRight, ChevronRight, Database, Flag, MapPinPlus, PencilLine, Plus } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
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
};

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
type Contributions = { data: Contribution[]; current_page: number; prev_page_url: string | null; next_page_url: string | null };
type PageProps = { section: string; hasTodo: boolean; todo?: Todo; contributions?: Contributions };

export default function Dashboard({ section, hasTodo, todo, contributions }: PageProps) {
    const { t } = useTranslation('backend/dashboard');
    const { t: tSaved } = useTranslation('frontend/map/saved');
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: dashboard() }]}>
            <Head title={t('title')} />
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('continuity_intro')}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button asChild variant="outline">
                            <Link href={mapPage()}>{t('map.open')}</Link>
                        </Button>
                        <Button asChild>
                            <Link href={locationMap.add()}>
                                <Plus aria-hidden />
                                {t('add_location')}
                            </Link>
                        </Button>
                    </div>
                </header>
                {hasTodo && (
                    <Deferred data="todo" fallback={<ListSkeleton rows={5} />}>
                        <Workplace todo={todo} />
                    </Deferred>
                )}
                <Tabs
                    value={section}
                    onValueChange={(value) =>
                        router.get(dashboard.url({ query: { section: value } }), {}, { preserveState: true, preserveScroll: true })
                    }
                >
                    <TabsList className="h-11 w-full sm:w-fit" aria-label={t('title')}>
                        <TabsTrigger value="destinations">{tSaved('destinations')}</TabsTrigger>
                        <TabsTrigger value="favorites">{tSaved('favorites')}</TabsTrigger>
                        <TabsTrigger value="contributions">{t('contributions.title')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="destinations" className="mt-4 max-w-2xl">
                        <Destinations
                            open={section === 'destinations'}
                            destination={null}
                            onSelect={(value) => router.visit(destinationMapUrl(value), { preserveState: false })}
                        />
                    </TabsContent>
                    <TabsContent value="favorites" className="mt-4 max-w-2xl">
                        <Favorites
                            open={section === 'favorites'}
                            onSelect={(value) => {
                                const place = favoriteParkingResult(value);
                                if (place) router.visit(favoriteMapUrl(place), { preserveState: false });
                            }}
                        />
                    </TabsContent>
                    <TabsContent value="contributions" className="mt-4">
                        <Deferred data="contributions" fallback={<ListSkeleton />}>
                            {contributions && <ContributionList contributions={contributions} />}
                        </Deferred>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

function ContributionList({ contributions }: { contributions: Contributions }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const [withdrawId, setWithdrawId] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);
    if (!contributions.data.length) return <p className="py-8 text-sm text-muted-foreground">{t('contributions.empty')}</p>;
    return (
        <div>
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
            <ul className="divide-y rounded-lg border">
                {contributions.data.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{item.label ?? t('activity.unknown_place')}</p>
                            <p className="text-sm text-muted-foreground">
                                {t(`contributions.kinds.${item.kind}`)} · {t(`contributions.status.${item.status}`)}
                            </p>
                            {item.reason && <p className="text-sm text-muted-foreground">{item.reason}</p>}
                            <time dateTime={item.at} className="text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(item.at))}
                            </time>
                        </div>
                        <div className="flex gap-2">
                            {item.withdraw_id && (
                                <Button variant="ghost" size="sm" onClick={() => setWithdrawId(item.withdraw_id)}>
                                    {t('contributions.withdraw.label')}
                                </Button>
                            )}
                            {item.url && item.action && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={item.url}>{t(`contributions.actions.${item.action}`)}</Link>
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {(contributions.prev_page_url || contributions.next_page_url) && (
                <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('contributions.pagination')}>
                    {contributions.prev_page_url ? (
                        <Button asChild variant="outline">
                            <Link href={contributions.prev_page_url} preserveScroll>
                                {t('contributions.previous')}
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" disabled>
                            {t('contributions.previous')}
                        </Button>
                    )}
                    <span className="text-sm text-muted-foreground">{t('contributions.page', { page: contributions.current_page })}</span>
                    {contributions.next_page_url ? (
                        <Button asChild variant="outline">
                            <Link href={contributions.next_page_url} preserveScroll>
                                {t('contributions.next')}
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" disabled>
                            {t('contributions.next')}
                        </Button>
                    )}
                </nav>
            )}
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

const TYPE_ICONS = { submission: MapPinPlus, improvement: PencilLine, report: Flag } satisfies Record<ItemType, unknown>;

const SOURCE_TONES: Record<string, string> = {
    awaiting_review: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    awaiting_approval: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    reapproval: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    intake_problem: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    live_stale: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    overdue: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

/** Parts of a line joined by a middle dot. */
function Dotted({ parts }: { parts: ReactNode[] }) {
    return parts.filter(Boolean).map((part, index) => (
        <Fragment key={index}>
            {index > 0 && ' · '}
            {part}
        </Fragment>
    ));
}

/** The first items in the moderation queue and the data sources that wait, each opening the work directly. */
function Workplace({ todo }: { todo?: Todo }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const { t: tModeration } = useTranslation('backend/moderation');
    const ago = useAgo();
    if (!todo) return null;
    const { moderation, queue, sources } = todo;
    const reviewAll = (
        <Link href={app.moderation.index()}>
            {t('todo.review_all')}
            <ArrowRight />
        </Link>
    );

    return (
        <div className="flex flex-col gap-9">
            {moderation && (
                <section aria-labelledby="queue-title">
                    <div className="flex items-center justify-between gap-4 pb-3">
                        <div>
                            <h2 id="queue-title" className="text-sm font-semibold">
                                {t('todo.queue_title')}
                            </h2>
                            {moderation.total > 0 && (
                                <p className="mt-0.5 text-[13px] text-muted-foreground">
                                    <Dotted
                                        parts={[
                                            t('todo.queue_count', { count: moderation.total }),
                                            moderation.oldest && t('todo.oldest', { ago: ago(moderation.oldest) }),
                                        ]}
                                    />
                                </p>
                            )}
                        </div>
                        {moderation.total > 0 && (
                            <Button asChild size="sm" className="hidden sm:inline-flex">
                                {reviewAll}
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
                                                'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-l-3 py-3 pr-4 pl-3.5 text-sm hover:bg-muted/50 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto_1rem] sm:gap-x-4',
                                                item.priority === 'high' ? 'border-l-orange-500' : 'border-l-transparent',
                                            )}
                                        >
                                            <span className="inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                <Icon className="size-3" aria-hidden />
                                                {tModeration(`types.${item.type}` as const)}
                                            </span>
                                            <span className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate font-medium">{item.street || tModeration('no_address')}</span>
                                                    {(item.reports ?? 0) > 1 && (
                                                        <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-px text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                                            {tModeration('flags.reports', { count: item.reports ?? 0 })}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-[13px] text-muted-foreground">
                                                    <Dotted
                                                        parts={[
                                                            item.priority === 'high' && (
                                                                <span className="font-medium text-orange-700 dark:text-orange-400">
                                                                    {t('todo.high')}
                                                                </span>
                                                            ),
                                                            item.municipality,
                                                            item.contributor && t('todo.by', { name: item.contributor }),
                                                        ]}
                                                    />
                                                </span>
                                            </span>
                                            <span className="justify-self-end text-[13px] text-muted-foreground sm:justify-self-auto">
                                                {ago(item.waiting_since)}
                                            </span>
                                            <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                                        </Link>
                                    </li>
                                );
                            })}
                            {moderation.total > queue.length && (
                                <li className="bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
                                    {t('todo.more_items', { count: moderation.total - queue.length })} ·{' '}
                                    {t('todo.in_total', {
                                        types: (['submission', 'improvement', 'report'] as const)
                                            .filter((type) => moderation.types[type])
                                            .map((type) => t(`todo.types.${type}` as const, { count: moderation.types[type] ?? 0 }))
                                            .join(', '),
                                    })}
                                </li>
                            )}
                        </ul>
                    )}
                    {moderation.total > 0 && (
                        <Button asChild className="mt-3 w-full sm:hidden">
                            {reviewAll}
                        </Button>
                    )}
                </section>
            )}

            {sources.total > 0 && (
                <section aria-labelledby="sources-title">
                    <div className="pb-3">
                        <h2 id="sources-title" className="text-sm font-semibold">
                            {t('todo.sources_title')}
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{t('todo.sources_hint')}</p>
                    </div>
                    <ul className="divide-y overflow-hidden rounded-lg border">
                        {sources.items.map((source) => (
                            <li
                                key={source.id}
                                className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
                            >
                                <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <Database className="size-4" aria-hidden />
                                </span>
                                <span className="min-w-0 text-sm">
                                    <span className="block font-medium">{source.name}</span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                                        <span className={cn('rounded-md px-1.5 py-px text-xs font-medium', SOURCE_TONES[source.status])}>
                                            {t(`todo.source_tag.${source.status}` as const)}
                                        </span>
                                        <span>
                                            {t(`todo.source.${source.status}` as const)}
                                            {source.since &&
                                                ` · ${new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(source.since))}`}
                                        </span>
                                    </span>
                                </span>
                                <Button asChild variant="outline" size="sm" className="col-span-2 sm:col-span-1">
                                    <Link
                                        href={source.import_id ? importShow(source.import_id) : municipalImports({ query: { status: 'attention' } })}
                                    >
                                        {t('todo.check')}
                                    </Link>
                                </Button>
                            </li>
                        ))}
                        {sources.total > sources.items.length && (
                            <li className="bg-muted/40 px-4 py-2.5 text-[13px]">
                                <Link
                                    href={municipalImports({ query: { status: 'attention' } })}
                                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                >
                                    {t('todo.more_sources', { count: sources.total - sources.items.length })}
                                </Link>
                            </li>
                        )}
                    </ul>
                </section>
            )}
        </div>
    );
}
