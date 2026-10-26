import { HeaderSlot } from '@/components/header-slot';
import InputError from '@/components/input-error';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { locationMap } from '@/routes';
import app from '@/routes/app';
import { router } from '@inertiajs/react';
import { format as formatDate, formatDistanceStrict, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import {
    AlertCircle,
    ArrowLeft,
    Camera,
    ChevronLeft,
    ChevronRight,
    Clock,
    Database,
    ExternalLink,
    Flag,
    Pencil,
    RotateCcw,
    Ruler,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DecisionPopover } from './decision-popover';
import { GroupEditor } from './group-editor';
import { MapChip, MapLegend, MapTag, ModerationMap, type MapPoint } from './moderation-map';
import type { CommunityPointsProfile, Contributor } from './parts';
import { useAgo } from './parts';
import { Kbd, useShortcuts } from './shortcuts';
import { TypeBadge } from './type-badge';
import type {
    Evidence,
    ImprovementDetails,
    ItemLink,
    NearestMunicipal,
    Options,
    Position,
    QueueItem,
    ReportDetails,
    SelectedItem,
    SubmissionDetails,
} from './types';
import { CHANGE_GROUPS, GROUP_FIELDS, useValueFormatter, type ChangeGroup, type ImprovementValues } from './values';

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A submission this close to another place may describe the same one. */
const DUPLICATE_METRES = 30;

/** Metres between two points, for the distances the moderator sees. */
function metres(a: MapPoint, b: MapPoint): number {
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
}

/** Other parking spaces count as nearby within this distance. */
const NEARBY_METRES = 500;

function nearestOf(point: MapPoint, points: MapPoint[]): number | null {
    const distances = points.map((other) => metres(point, other)).filter((distance) => distance <= NEARBY_METRES);
    return distances.length ? Math.min(...distances) : null;
}

/**
 * The item under review, beside the queue. Every kind of item has the same frame: a toolbar with its place in the
 * queue and the decision, a title, the map beside the aerial photo, and below them what this decision needs.
 */
export function ReviewPane({
    selected,
    position,
    loading,
    options,
    query,
    onNavigate,
    onBack,
}: {
    selected: SelectedItem | null;
    position: Position | null;
    loading: { preview: QueueItem | null } | null;
    options: Options;
    query: Record<string, string>;
    onNavigate: (link: ItemLink) => void;
    onBack: () => void;
}) {
    const item = loading?.preview ?? selected;
    if (!item) return null;

    const nav = { position: loading ? null : position, loading: loading !== null, onNavigate, onBack };
    if (loading || !selected || !position) return <Frame nav={nav} actions={null} body={<BodySkeleton />} />;

    switch (selected.type) {
        case 'report':
            return <ReportReview key={selected.key} details={selected.details} nav={nav} options={options} query={query} />;
        case 'submission':
            return <SubmissionReview key={selected.key} item={selected} details={selected.details} nav={nav} options={options} query={query} />;
        case 'improvement':
            return <ImprovementReview key={selected.key} item={selected} details={selected.details} nav={nav} options={options} query={query} />;
    }
}

type Nav = { position: Position | null; loading: boolean; onNavigate: (link: ItemLink) => void; onBack: () => void };

/** The toolbar, the scrolling body and, on small screens, the decision at the bottom. */
function Frame({ nav, actions, body, overlay }: { nav: Nav; actions: React.ReactNode; body: React.ReactNode; overlay?: React.ReactNode }) {
    const { t } = useTranslation('backend/moderation');
    const { position } = nav;
    const next = position?.next ?? null;
    const previous = position?.previous ?? null;
    useShortcuts({
        j: next && (() => nav.onNavigate(next)),
        k: previous && (() => nav.onNavigate(previous)),
        Escape: nav.onBack,
    });

    return (
        <section aria-label={t('review.label')} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <HeaderSlot side="start">
                <nav
                    aria-label={t('review.position_label')}
                    className="flex min-w-0 items-center gap-1.5 lg:absolute lg:inset-y-0 lg:left-[359px] lg:border-l lg:pl-3"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer lg:hidden"
                        aria-label={t('review.back')}
                        onClick={nav.onBack}
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer text-muted-foreground"
                        disabled={!previous || nav.loading}
                        aria-label={t('review.previous')}
                        onClick={() => previous && nav.onNavigate(previous)}
                    >
                        <ChevronLeft className="size-[18px]" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer text-muted-foreground"
                        disabled={!next || nav.loading}
                        aria-label={t('review.next')}
                        onClick={() => next && nav.onNavigate(next)}
                    >
                        <ChevronRight className="size-[18px]" />
                    </Button>
                    {position && (
                        <span className="ml-1 hidden truncate text-sm whitespace-nowrap text-muted-foreground sm:inline">
                            {t('review.position', { index: position.index, total: position.total })}
                            {position.next && (
                                <span className="hidden text-[13px] text-neutral-400 xl:inline">
                                    {' '}
                                    · {t('review.next_up', { place: nextLabel(position) })}
                                </span>
                            )}
                        </span>
                    )}
                </nav>
            </HeaderSlot>
            <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 py-5 lg:px-7">{body}</div>
            {actions && (
                <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t bg-background px-4 pb-2 lg:px-7 lg:pb-0 max-lg:[&>*]:flex-1">
                    {actions}
                </footer>
            )}
            {overlay}
        </section>
    );
}

function nextLabel(position: Position): string {
    return position.next?.street ?? '…';
}

function BodySkeleton() {
    return (
        <div className="flex flex-col gap-[18px]" aria-hidden>
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-8 w-80 animate-pulse rounded bg-muted" />
            <div className="grid gap-4 md:grid-cols-2">
                <div className="h-[220px] animate-pulse rounded-xl bg-muted" />
                <div className="h-[220px] animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
    );
}

/** Badges, the place as a heading, one line of context and the links to the place itself. */
function TitleRow({
    badges,
    title,
    meta,
    place,
}: {
    badges: React.ReactNode;
    title: string;
    meta: React.ReactNode;
    place?: { id: string; source: 'community' | 'municipal'; at: MapPoint };
}) {
    const { t } = useTranslation('backend/moderation');

    return (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <header className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap gap-1.5">{badges}</div>
                <h2 className="mt-1.5 text-2xl leading-8 font-semibold tracking-[-0.6px]">{title}</h2>
                <p className="text-sm text-muted-foreground">{meta}</p>
            </header>
            {place && (
                <div className="hidden gap-2 md:flex">
                    {place.source === 'community' && (
                        <Button variant="outline" size="sm" asChild>
                            <a href={app.parkingSpaces.edit.url({ parking_space: place.id })}>
                                <Pencil />
                                {t('review.edit_place')}
                            </a>
                        </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                        <a
                            href={locationMap.url({
                                query: {
                                    place: `${place.source}:${place.id}`,
                                    at: `${place.at.latitude.toFixed(5)},${place.at.longitude.toFixed(5)}`,
                                },
                            })}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <ExternalLink />
                            {t('review.on_map')}
                        </a>
                    </Button>
                </div>
            )}
        </div>
    );
}

function Tint({ children, tone = 'orange' }: { children: React.ReactNode; tone?: 'orange' | 'amber' }) {
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
                tone === 'orange'
                    ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200'
                    : 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
            )}
        >
            {children}
        </span>
    );
}

/**
 * The map and the aerial photo side by side: the map shows what NIPKaart knows around the place, the photo what is
 * actually there. Street View opens in a new tab.
 */
function Views({
    at,
    map,
    legend,
}: {
    at: MapPoint;
    map: Omit<React.ComponentProps<typeof ModerationMap>, 'layer' | 'className'>;
    legend: { label: string; color: string }[];
}) {
    const { t } = useTranslation('backend/moderation');
    const streetView = streetViewUrl(at.latitude, at.longitude);
    const [view, setView] = useState<'streets' | 'satellite'>('streets');

    return (
        <div className="flex flex-col gap-3">
            <div role="group" aria-label={t('review.views.label')} className="flex rounded-[9px] bg-muted p-[3px] md:hidden">
                {(['streets', 'satellite'] as const).map((layer) => (
                    <button
                        key={layer}
                        type="button"
                        aria-pressed={view === layer}
                        onClick={() => setView(layer)}
                        className={cn(
                            'h-[30px] flex-1 cursor-pointer rounded-md text-[13px] font-medium',
                            view === layer ? 'bg-background shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-muted-foreground',
                        )}
                    >
                        {t(layer === 'streets' ? 'review.views.map' : 'review.views.aerial')}
                    </button>
                ))}
                {streetView && (
                    <a
                        href={streetView}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-[30px] flex-1 items-center justify-center rounded-md text-[13px] font-medium text-muted-foreground"
                    >
                        {t('review.views.street_view')}
                    </a>
                )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <ModerationMap {...map} layer="streets" className={cn('h-[220px]', view !== 'streets' && 'hidden md:block')}>
                    <MapTag>{t('review.views.map')}</MapTag>
                    <MapLegend items={legend} />
                </ModerationMap>
                <ModerationMap
                    key={`${at.latitude},${at.longitude}`}
                    center={at}
                    proposed={map.proposed}
                    layer="satellite"
                    className={cn('h-[220px]', view !== 'satellite' && 'hidden md:block')}
                >
                    <MapTag>{t('review.views.aerial')}</MapTag>
                    {streetView && (
                        <MapChip href={streetView} target="_blank" rel="noreferrer" className="hidden md:flex">
                            <Camera aria-hidden />
                            {t('review.views.street_view')}
                        </MapChip>
                    )}
                </ModerationMap>
            </div>
        </div>
    );
}

function Section({ title, aside, children, gap = 'gap-3' }: { title: string; aside?: React.ReactNode; children: React.ReactNode; gap?: string }) {
    return (
        <section className={cn('flex min-w-0 flex-col', gap)}>
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="shrink-0 text-sm font-semibold">{title}</h3>
                {aside && <span className="min-w-0 truncate text-[13px] text-muted-foreground">{aside}</span>}
            </div>
            {children}
        </section>
    );
}

type Tone = 'gone' | 'present' | 'ok' | 'attention' | 'neutral';
type Check = { icon: LucideIcon; title: string; detail: string; tone: Tone };

const TONES: Record<Tone, string> = {
    gone: 'text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300',
    attention: 'text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300',
    present: 'text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300',
    ok: 'text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300',
    neutral: 'text-muted-foreground bg-muted',
};

/** Automatic checks against what NIPKaart already knows; each says which way it points, never decides. */
function Checks({ checks }: { checks: Check[] }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <Section title={t('checks.title')} gap="gap-1.5">
            <ul className="border-t">
                {checks.map((check) => (
                    <li key={check.title} className="flex gap-3 border-b py-[11px]">
                        <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-lg', TONES[check.tone])}>
                            <check.icon className="size-[15px]" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                            <span className="flex justify-between gap-2 text-sm font-medium">
                                {check.title}
                                <span className={cn('shrink-0 text-xs font-medium', TONES[check.tone].split(' ')[0])}>
                                    {t(`checks.tones.${check.tone}`)}
                                </span>
                            </span>
                            <span className="text-[13px] leading-[18px] text-muted-foreground">{check.detail}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

/** What someone's earlier contributions of this kind turned out to be, from their community points. */
function track(points: CommunityPointsProfile | null | undefined, kind: 'submission' | 'improvement' | 'report') {
    const outcomes = points?.outcomes.filter((outcome) => outcome.kind === kind) ?? [];
    const total = outcomes.reduce((sum, outcome) => sum + outcome.count, 0);
    const right = outcomes
        .filter((outcome) => outcome.outcome.endsWith('approved') || outcome.outcome === 'report.confirmed')
        .reduce((sum, outcome) => sum + outcome.count, 0);
    return { total, right, trusted: total > 0 && right / total >= 0.5 };
}

function TrackLine({ points, kind }: { points: CommunityPointsProfile | null | undefined; kind: 'submission' | 'improvement' | 'report' }) {
    const { t } = useTranslation('backend/moderation');
    const { total, right, trusted } = track(points, kind);

    return (
        <span className="flex items-center gap-[5px] text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', total === 0 ? 'bg-neutral-400' : trusted ? 'bg-green-600' : 'bg-orange-500')} aria-hidden />
            {total === 0 ? t(`track.first.${kind}`) : t(`track.earlier.${kind}`, { count: total, right })}
        </span>
    );
}

function ContributorCard({ contributor, kind }: { contributor: Contributor | null; kind: 'submission' | 'improvement' }) {
    const { t } = useTranslation('backend/moderation');
    const initials = useInitials();
    if (!contributor) return null;
    const name = contributor.name ?? t('unknown_user');

    return (
        <Section title={t('review.contributor')}>
            <div className="flex items-center gap-3">
                <Avatar className="size-10">
                    <AvatarFallback className="bg-amber-200 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {initials(name)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-px">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="text-[13px] text-muted-foreground">
                        {contributor.community_points
                            ? t('community_points.score', { score: contributor.community_points.score })
                            : t('review.contributions', { approved: contributor.approved, rejected: contributor.rejected })}
                        {contributor.is_new && ` · ${t('contributor.new')}`}
                    </span>
                    <TrackLine points={contributor.community_points} kind={kind} />
                </div>
            </div>
        </Section>
    );
}

/** The place's history on one line: when it was added and approved, confirmed, reported or improved. */
function Timeline({ events, confirmed }: { events: Evidence['timeline']; confirmed: number }) {
    const { t, i18n } = useTranslation('backend/moderation');
    const locale = i18n.language.startsWith('nl') ? nl : enUS;
    if (events.length === 0) return null;

    const times = events.map((event) => parseISO(event.at).getTime());
    const first = times[0];
    const last = times[times.length - 1];
    const span = Math.max(1, last - first);
    const x = (time: number) => (events.length === 1 ? 50 : ((time - first) / span) * 100);
    const lastConfirmed = events.map((event) => event.kind).lastIndexOf('confirmed');
    const reportedAfter = events.findIndex((event, index) => index > lastConfirmed && (event.kind === 'reported' || event.kind === 'unavailable'));
    const month = (time: number) => formatDate(time, 'MMM yyyy', { locale });
    const colors: Record<string, string> = {
        added: '#a3a3a3',
        approved: '#a3a3a3',
        confirmed: '#16a34a',
        improved: '#16a34a',
        moved: '#d97706',
        unavailable: '#d97706',
        improvement: '#2563eb',
        reported: '#dc2626',
    };
    const labels = [
        { index: 0, text: t(`timeline.${events[0].kind}`) },
        ...(lastConfirmed > 0 && lastConfirmed < events.length - 1
            ? [{ index: lastConfirmed, text: t('timeline.confirmed_count', { count: confirmed }) }]
            : []),
        ...(events.length > 1 ? [{ index: events.length - 1, text: t(`timeline.${events[events.length - 1].kind}`) }] : []),
    ].filter((label, position, all) => position === 0 || Math.abs(x(times[label.index]) - x(times[all[position - 1].index])) > 18);

    return (
        <Section title={t('timeline.title')} aside={events.length > 1 ? formatDistanceStrict(first, last, { locale }) : undefined} gap="gap-1.5">
            <div className="relative mx-1.5 h-[66px]">
                <span className="absolute inset-x-0 top-7 h-0.5 bg-border" aria-hidden />
                {reportedAfter > 0 && lastConfirmed >= 0 && (
                    <span
                        className="absolute top-[27px] h-1 rounded-sm bg-[repeating-linear-gradient(90deg,#fca5a5_0_6px,transparent_6px_10px)]"
                        style={{ left: `${x(times[lastConfirmed])}%`, right: `${100 - x(last)}%` }}
                        aria-hidden
                    />
                )}
                <ol className="contents">
                    {events.map((event, index) => (
                        <li
                            key={index}
                            className="absolute top-[22px] size-3 -translate-x-1/2 rounded-full border-2 border-background"
                            style={{ left: `${x(times[index])}%`, background: colors[event.kind], boxShadow: `0 0 0 1px ${colors[event.kind]}` }}
                        >
                            <span className="sr-only">
                                {t(`timeline.${event.kind}`)} · {month(times[index])}
                            </span>
                        </li>
                    ))}
                </ol>
                {labels.map((label) => {
                    const left = x(times[label.index]);
                    return (
                        <span
                            key={label.index}
                            aria-hidden
                            className={cn(
                                'absolute top-11 text-xs whitespace-nowrap',
                                left > 85 ? '-translate-x-full' : left > 15 && '-translate-x-1/2',
                            )}
                            style={{ left: `${left}%` }}
                        >
                            {label.text} <span className="text-muted-foreground">{month(times[label.index])}</span>
                        </span>
                    );
                })}
            </div>
        </Section>
    );
}

function TwoColumns({ children }: { children: React.ReactNode }) {
    return <div className="grid gap-8 md:grid-cols-2">{children}</div>;
}

// ---------------------------------------------------------------- reports

/** Report reasons and the removal reason they point to. */
const SUGGESTED_REMOVAL: Record<string, string> = { sign_removed: 'no_longer_exists', now_regular_bay: 'not_a_disabled_bay' };

function ReportReview({ details, nav, options, query }: { details: ReportDetails; nav: Nav; options: Options; query: Record<string, string> }) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const initials = useInitials();
    const [keeping, setKeeping] = useState(false);
    const [removing, setRemoving] = useState(false);
    const route = { source: details.source, id: details.id };
    const at = { latitude: details.latitude, longitude: details.longitude };
    const { evidence } = details;

    const keep = () =>
        router.post(
            app.moderation.reports.keep.url(route, { query }),
            {},
            { preserveScroll: true, preserveState: true, onStart: () => setKeeping(true), onFinish: () => setKeeping(false) },
        );
    useShortcuts({ l: options.can.report && !keeping && keep, v: options.can.report && (() => setRemoving(true)) });

    const suggested = useMemo(() => {
        const counts = new Map<string, number>();
        details.reports.forEach((report) => {
            const value = report.reason_key ? SUGGESTED_REMOVAL[report.reason_key] : null;
            if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
        });
        const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
        return value ? { value, hint: t('decide.mentioned', { count }) } : null;
    }, [details.reports, t]);

    const trusted = details.reports.filter((report) => track(report.community_points, 'report').trusted).length;
    const nearestCommunity = nearestOf(at, details.nearbySpaces);
    const checks: Check[] = [
        details.source === 'community'
            ? evidence.nearest_municipal && evidence.nearest_municipal.distance_metres <= DUPLICATE_METRES
                ? {
                      icon: Database,
                      title: t('checks.municipal.title'),
                      detail: t('checks.municipal.near', { distance: evidence.nearest_municipal.distance_metres }),
                      tone: 'present',
                  }
                : { icon: Database, title: t('checks.municipal.title'), detail: t('checks.municipal.none'), tone: 'neutral' }
            : { icon: Database, title: t('checks.municipal_source.title'), detail: t('checks.municipal_source.detail'), tone: 'neutral' },
        details.confirmations_since_report > 0
            ? {
                  icon: Clock,
                  title: t('checks.confirmed.title'),
                  detail: t('checks.confirmed.since_report', { count: details.confirmations_since_report }),
                  tone: 'present',
              }
            : evidence.last_confirmed_at
              ? {
                    icon: Clock,
                    title: t('checks.confirmed.title'),
                    detail: t('checks.confirmed.last', { ago: ago(evidence.last_confirmed_at), count: evidence.confirmed_total }),
                    tone: 'gone',
                }
              : { icon: Clock, title: t('checks.confirmed.title'), detail: t('checks.confirmed.never'), tone: 'gone' },
        ...(evidence.unavailable_since_confirmation > 0
            ? [
                  {
                      icon: AlertCircle,
                      title: t('checks.unavailable.title'),
                      detail: t('checks.unavailable.detail', { count: evidence.unavailable_since_confirmation }),
                      tone: 'gone' as Tone,
                  },
              ]
            : []),
        {
            icon: Users,
            title: t('checks.community.title'),
            detail: nearestCommunity === null ? t('checks.community.none') : t('checks.community.nearest', { distance: nearestCommunity }),
            tone: 'neutral',
        },
    ];

    const actions = options.can.report && (
        <>
            <Button variant="outline" className="cursor-pointer" disabled={keeping} onClick={keep}>
                {t('reports.keep')}
                <Kbd aria-hidden>L</Kbd>
            </Button>
            <DecisionPopover
                kind={details.source}
                action={app.moderation.reports.remove.url(route, { query })}
                reasons={options.reasons.report}
                trigger={t(`reports.remove.${details.source}`)}
                shortcut="V"
                variant="default"
                open={removing}
                onOpenChange={setRemoving}
                suggested={suggested}
            />
        </>
    );

    return (
        <Frame
            nav={nav}
            actions={actions}
            body={
                <>
                    <TitleRow
                        badges={
                            <>
                                <TypeBadge type="report" />
                                <Tint>{t('priority.high')}</Tint>
                                {!details.published && <Tint tone="amber">{t('not_public')}</Tint>}
                            </>
                        }
                        title={[details.street, details.municipality].filter(Boolean).join(', ') || t('no_address')}
                        meta={[t(`reports.sources.${details.source}`), t('review.confirmed_total', { count: evidence.confirmed_total })].join(' · ')}
                        place={{ id: details.id, source: details.source, at }}
                    />
                    <Views
                        at={at}
                        map={{ center: at, nearby: details.nearbySpaces }}
                        legend={[
                            { label: t('review.legend.this_place'), color: '#1d4ed8' },
                            { label: t('review.legend.community'), color: '#16a34a' },
                        ]}
                    />
                    <Timeline events={evidence.timeline} confirmed={evidence.confirmed_total} />
                    <TwoColumns>
                        <Section title={t('reports.notes.title')} aside={t('reports.trusted', { count: trusted, total: details.reports.length })}>
                            <ul className="flex flex-col gap-3.5">
                                {details.reports.map((report) => (
                                    <li key={report.id} className="flex gap-2.5">
                                        <Avatar className="size-7">
                                            <AvatarFallback className="text-[11px]">{initials(report.reporter ?? t('unknown_user'))}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className="text-[13px] text-muted-foreground">
                                                {report.reporter ?? t('unknown_user')} · {ago(report.reported_at)}
                                            </span>
                                            <span className="text-sm leading-5">
                                                {report.reason && <span className="font-medium">{report.reason}</span>}
                                                {report.reason && report.note && <span className="text-muted-foreground"> · </span>}
                                                {report.note && (
                                                    <span className={report.reason ? 'text-muted-foreground' : undefined}>“{report.note}”</span>
                                                )}
                                                {!report.reason && !report.note && (
                                                    <span className="text-muted-foreground">{t('reports.notes.none')}</span>
                                                )}
                                            </span>
                                            <TrackLine points={report.community_points} kind="report" />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                        <Checks checks={checks} />
                    </TwoColumns>
                </>
            }
        />
    );
}

// ---------------------------------------------------------------- shared approve

function payload(values: ImprovementValues) {
    const minutes = values.parking_time ?? 0;
    return {
        latitude: values.latitude,
        longitude: values.longitude,
        orientation: values.orientation,
        under_sign: values.under_sign,
        under_sign_text: values.under_sign_text,
        parking_hours: minutes ? Math.floor(minutes / 60) : null,
        parking_minutes: minutes ? minutes % 60 : null,
        restriction_days: values.restriction_days ?? [],
        restriction_starts_at: values.restriction_starts_at,
        restriction_ends_at: values.restriction_ends_at,
        description: values.description,
    };
}

function useApprove(url: string) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const approve = (values: ImprovementValues) =>
        router.post(url, payload(values), {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: setErrors,
        });
    return { approve, errors, processing };
}

function EditButton({
    edited,
    editing,
    label,
    onEdit,
    onRestore,
}: {
    edited: boolean;
    editing: boolean;
    label: string;
    onEdit: () => void;
    onRestore: () => void;
}) {
    const { t } = useTranslation('backend/moderation');
    return edited ? (
        <Button
            variant="ghost"
            size="icon"
            className="size-7 cursor-pointer text-muted-foreground"
            aria-label={t('review.restore')}
            onClick={onRestore}
        >
            <RotateCcw className="size-[15px]" />
        </Button>
    ) : (
        <Button
            variant="ghost"
            size="icon"
            className="size-7 cursor-pointer text-muted-foreground"
            aria-pressed={editing}
            aria-label={label}
            onClick={onEdit}
        >
            <Pencil className="size-[15px]" />
        </Button>
    );
}

// ---------------------------------------------------------------- submissions

function SubmissionReview({
    item,
    details,
    nav,
    options,
    query,
}: {
    item: SelectedItem;
    details: SubmissionDetails;
    nav: Nav;
    options: Options;
    query: Record<string, string>;
}) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const format = useValueFormatter(options);
    const [draft, setDraft] = useState<ImprovementValues>(details.current);
    const [editing, setEditing] = useState<ChangeGroup | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const { approve, errors, processing } = useApprove(app.moderation.submissions.approve.url({ parking_space: details.space.id }, { query }));
    const update = (values: Partial<ImprovementValues>) => setDraft((previous) => ({ ...previous, ...values }));
    const isEdited = (group: ChangeGroup) => GROUP_FIELDS[group].some((field) => !same(draft[field], details.current[field]));
    const at = { latitude: draft.latitude, longitude: draft.longitude };
    const can = options.can.submission;
    useShortcuts({ a: can && !processing && (() => approve(draft)), r: can && (() => setRejecting(true)) });

    const municipal = details.nearestMunicipal;
    const nearestCommunity = nearestOf(at, details.nearbySpaces);
    const firstContribution = item.contributor !== null && item.contributor.approved + item.contributor.rejected === 0;
    const checks: Check[] = [
        municipal && municipal.distance_metres <= DUPLICATE_METRES
            ? {
                  icon: Database,
                  title: t('checks.municipal.title'),
                  detail: t('checks.municipal.duplicate', { distance: municipal.distance_metres }),
                  tone: 'attention',
              }
            : { icon: Database, title: t('checks.municipal.title'), detail: t('checks.municipal.clear', { distance: DUPLICATE_METRES }), tone: 'ok' },
        nearestCommunity !== null && nearestCommunity <= DUPLICATE_METRES
            ? {
                  icon: Users,
                  title: t('checks.community.title'),
                  detail: t('checks.community.duplicate', { distance: nearestCommunity }),
                  tone: 'attention',
              }
            : {
                  icon: Users,
                  title: t('checks.community.title'),
                  detail:
                      nearestCommunity === null ? t('checks.community.none') : t('checks.community.nearest_clear', { distance: nearestCommunity }),
                  tone: 'ok',
              },
    ];

    const actions = can && (
        <>
            <DecisionPopover
                kind="submission"
                action={app.moderation.submissions.reject.url({ parking_space: details.space.id }, { query })}
                reasons={options.reasons.submission}
                trigger={t('review.reject_with_reason')}
                shortcut="R"
                open={rejecting}
                onOpenChange={setRejecting}
                suggested={
                    municipal && municipal.distance_metres <= DUPLICATE_METRES
                        ? { value: 'duplicate', hint: t('decide.municipal_nearby', { distance: municipal.distance_metres }) }
                        : null
                }
            />
            <Button className="cursor-pointer" disabled={processing} onClick={() => approve(draft)}>
                {t('review.approve')}
                <Kbd inverted aria-hidden>
                    A
                </Kbd>
            </Button>
        </>
    );

    return (
        <Frame
            nav={nav}
            actions={actions}
            body={
                <>
                    <TitleRow
                        badges={
                            <>
                                <TypeBadge type="submission" />
                                {firstContribution && <Tint tone="amber">{t('review.first_contribution')}</Tint>}
                            </>
                        }
                        title={[draft.street ?? item.street, draft.municipality ?? item.municipality].filter(Boolean).join(', ') || t('no_address')}
                        meta={[t('review.submitted_ago', { ago: ago(item.waiting_since) }), format('orientation', draft)].join(' · ')}
                    />
                    <Views
                        at={at}
                        map={{
                            center: { latitude: details.current.latitude, longitude: details.current.longitude },
                            proposed: at,
                            nearby: details.nearbySpaces,
                            municipal: details.nearbyMunicipalSpaces,
                        }}
                        legend={[
                            { label: t('review.legend.submission'), color: '#1d4ed8' },
                            { label: t('review.legend.community'), color: '#16a34a' },
                            { label: t('review.legend.municipal'), color: '#7c3aed' },
                        ]}
                    />
                    <TwoColumns>
                        <div className="flex flex-col gap-5">
                            <Section title={t('review.submitted')} aside={can ? t('review.submitted_hint') : undefined} gap="gap-2">
                                <InputError message={errors.general ?? Object.values(errors)[0]} />
                                <ul className="border-t">
                                    {CHANGE_GROUPS.map((group) => (
                                        <li key={group} className="grid grid-cols-[110px_minmax(0,1fr)_28px] items-start gap-3 border-b py-2 text-sm">
                                            <span className="pt-1 text-muted-foreground">{t(`groups.${group}`)}</span>
                                            <div className="flex min-w-0 flex-col gap-1 pt-1">
                                                {editing === group ? (
                                                    <GroupEditor group={group} draft={draft} update={update} options={options} />
                                                ) : (
                                                    <span>
                                                        {group === 'location' && isEdited('location')
                                                            ? t('review.location_moved')
                                                            : format(group, draft)}
                                                    </span>
                                                )}
                                                {isEdited(group) && (
                                                    <span className="text-xs text-orange-700 dark:text-orange-400">
                                                        {t('review.edited', { value: format(group, details.current) })}
                                                    </span>
                                                )}
                                            </div>
                                            {can && (
                                                <EditButton
                                                    edited={isEdited(group)}
                                                    editing={editing === group}
                                                    label={t('review.edit', { field: t(`groups.${group}`) })}
                                                    onEdit={() => setEditing(editing === group ? null : group)}
                                                    onRestore={() => {
                                                        update(
                                                            Object.fromEntries(GROUP_FIELDS[group].map((field) => [field, details.current[field]])),
                                                        );
                                                        setEditing(null);
                                                    }}
                                                />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                            <ContributorCard contributor={item.contributor} kind="submission" />
                        </div>
                        <div className="flex flex-col gap-5">
                            <Checks checks={checks} />
                            {municipal && <MunicipalComparison municipal={municipal} draft={draft} options={options} />}
                        </div>
                    </TwoColumns>
                </>
            }
        />
    );
}

/** The submission beside the nearest municipal place, field by field; matching values are what make a duplicate. */
function MunicipalComparison({ municipal, draft, options }: { municipal: NearestMunicipal; draft: ImprovementValues; options: Options }) {
    const { t } = useTranslation('backend/moderation');
    const orientation = (value: string | null) => options.orientations.find((option) => option.value === value)?.label ?? t('values.unknown');
    const rows: [string, string, string, boolean][] = [
        [
            t('compare.street'),
            draft.street ?? t('values.unknown'),
            municipal.street ?? t('values.unknown'),
            !!draft.street && draft.street === municipal.street,
        ],
        [
            t('compare.orientation'),
            orientation(draft.orientation),
            orientation(municipal.orientation),
            !!draft.orientation && draft.orientation === municipal.orientation,
        ],
        [t('compare.number'), '1', municipal.number != null ? String(municipal.number) : t('values.unknown'), municipal.number === 1],
    ];
    const equal = rows.filter(([, , , match]) => match).length;

    return (
        <Section
            title={t('compare.title')}
            aside={t('compare.summary', { equal, total: rows.length, distance: municipal.distance_metres })}
            gap="gap-1.5"
        >
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs font-medium">
                        <th className="w-[110px] pb-1.5 font-medium">
                            <span className="sr-only">{t('compare.field')}</span>
                        </th>
                        <th className="pb-1.5 font-medium text-muted-foreground">{t('compare.submission')}</th>
                        <th className="pb-1.5 font-medium text-violet-600">{t('compare.municipal')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([label, a, b, match]) => (
                        <tr key={label} className="border-t">
                            <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                                {label}
                            </th>
                            <td className="py-2">{a}</td>
                            <td className={cn('py-2', match && 'font-medium text-orange-700 dark:text-orange-400')}>{b}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Section>
    );
}

// ---------------------------------------------------------------- improvements

function ImprovementReview({
    item,
    details,
    nav,
    options,
    query,
}: {
    item: SelectedItem;
    details: ImprovementDetails;
    nav: Nav;
    options: Options;
    query: Record<string, string>;
}) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const format = useValueFormatter(options);
    const { current, submitted, changes, evidence } = details;
    const proposed = useMemo<ImprovementValues>(() => ({ ...current, ...submitted }), [current, submitted]);
    const [draft, setDraft] = useState<ImprovementValues>(proposed);
    const [accepted, setAccepted] = useState<Record<ChangeGroup, boolean>>(
        () => Object.fromEntries(changes.map((group) => [group, true])) as Record<ChangeGroup, boolean>,
    );
    const [editing, setEditing] = useState<ChangeGroup | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const { approve, errors, processing } = useApprove(app.moderation.improvements.approve.url({ improvement: details.id }, { query }));
    const can = options.can.improvement;
    const update = (values: Partial<ImprovementValues>) => setDraft((previous) => ({ ...previous, ...values }));
    const isEdited = (group: ChangeGroup) => GROUP_FIELDS[group].some((field) => !same(draft[field], proposed[field]));
    const takenOver = changes.filter((group) => accepted[group]);
    const result = (): ImprovementValues => ({
        ...current,
        ...Object.fromEntries(
            CHANGE_GROUPS.flatMap((group) => GROUP_FIELDS[group].map((field) => [field, (accepted[group] ? draft : current)[field]])),
        ),
    });
    const apply = () => takenOver.length > 0 && !processing && approve(result());
    useShortcuts({ a: can && apply, r: can && (() => setRejecting(true)) });

    const here = { latitude: current.latitude, longitude: current.longitude };
    const moved = changes.includes('location') && accepted.location;
    const there = { latitude: draft.latitude, longitude: draft.longitude };
    const otherMunicipality = item.flags.other_municipality != null;
    const checks: Check[] = [
        ...(changes.includes('location')
            ? [
                  details.distance_metres !== null && details.distance_metres > DUPLICATE_METRES
                      ? {
                            icon: Ruler,
                            title: t('checks.moved.title'),
                            detail: t('checks.moved.far', { distance: details.distance_metres }),
                            tone: 'attention' as Tone,
                        }
                      : {
                            icon: Ruler,
                            title: t('checks.moved.title'),
                            detail: t('checks.moved.near', { distance: details.distance_metres ?? 0 }),
                            tone: 'ok' as Tone,
                        },
              ]
            : []),
        ...(otherMunicipality
            ? [
                  {
                      icon: AlertCircle,
                      title: t('checks.other_municipality.title'),
                      detail: t('checks.other_municipality.detail'),
                      tone: 'attention' as Tone,
                  },
              ]
            : []),
        ...(item.flags.competing
            ? [{ icon: Flag, title: t('checks.competing.title'), detail: t('checks.competing.detail'), tone: 'attention' as Tone }]
            : []),
        evidence.last_confirmed_at
            ? {
                  icon: Clock,
                  title: t('checks.confirmed.title'),
                  detail: t('checks.confirmed.last_current', { ago: ago(evidence.last_confirmed_at) }),
                  tone: 'neutral',
              }
            : { icon: Clock, title: t('checks.confirmed.title'), detail: t('checks.confirmed.never'), tone: 'neutral' },
        {
            icon: Users,
            title: t('checks.contributor.title'),
            detail: (() => {
                const record = track(item.contributor?.community_points, 'improvement');
                return record.total === 0
                    ? t('track.first.improvement')
                    : t('checks.contributor.detail', { right: record.right, count: record.total });
            })(),
            tone:
                track(item.contributor?.community_points, 'improvement').total === 0
                    ? 'neutral'
                    : track(item.contributor?.community_points, 'improvement').trusted
                      ? 'ok'
                      : 'attention',
        },
    ];

    const actions = can && (
        <>
            <DecisionPopover
                kind="improvement"
                action={app.moderation.improvements.reject.url({ improvement: details.id }, { query })}
                reasons={options.reasons.improvement}
                trigger={t('review.reject_with_reason')}
                shortcut="R"
                open={rejecting}
                onOpenChange={setRejecting}
            />
            <Button className="cursor-pointer" disabled={processing || takenOver.length === 0} onClick={apply}>
                {t('review.apply')}
                <Kbd inverted aria-hidden>
                    A
                </Kbd>
            </Button>
        </>
    );

    return (
        <Frame
            nav={nav}
            actions={actions}
            body={
                <>
                    <TitleRow
                        badges={
                            <>
                                <TypeBadge type="improvement" />
                                {!details.space.published && <Tint tone="amber">{t('not_public')}</Tint>}
                            </>
                        }
                        title={[details.space.street, details.space.municipality].filter(Boolean).join(', ') || t('no_address')}
                        meta={[
                            t('review.proposed_ago', { ago: ago(details.submitted_at) }),
                            t('review.change_count', { count: changes.length }),
                        ].join(' · ')}
                        place={{ id: details.space.id, source: 'community', at: here }}
                    />
                    <Views
                        at={moved ? there : here}
                        map={{ center: here, proposed: moved ? there : null, current: moved ? here : null, nearby: details.nearbySpaces }}
                        legend={
                            moved
                                ? [
                                      { label: t('review.legend.proposed'), color: '#1d4ed8' },
                                      { label: t('review.legend.current'), color: '#a3a3a3' },
                                  ]
                                : [
                                      { label: t('review.legend.this_place'), color: '#1d4ed8' },
                                      { label: t('review.legend.community'), color: '#16a34a' },
                                  ]
                        }
                    />
                    <TwoColumns>
                        <div className="flex flex-col gap-5">
                            <Section title={t('review.changes')} aside={can ? t('review.changes_hint') : undefined} gap="gap-2">
                                <InputError message={errors.general ?? Object.values(errors)[0]} />
                                <ul className="border-t">
                                    {changes.map((group) => (
                                        <li
                                            key={group}
                                            className={cn(
                                                'grid grid-cols-[110px_minmax(0,1fr)_auto] items-start gap-3 border-b py-2.5 text-sm',
                                                !accepted[group] && 'text-muted-foreground',
                                            )}
                                        >
                                            <span className="text-muted-foreground">{t(`groups.${group}`)}</span>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                {editing === group && accepted[group] ? (
                                                    <GroupEditor group={group} draft={draft} update={update} options={options} />
                                                ) : (
                                                    <span>
                                                        <span className="text-muted-foreground line-through">{format(group, current)}</span>
                                                        <span className="text-muted-foreground"> → </span>
                                                        <span
                                                            className={cn(
                                                                'rounded px-1 py-px',
                                                                accepted[group]
                                                                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                                                                    : 'line-through',
                                                            )}
                                                        >
                                                            {group === 'location' && isEdited('location')
                                                                ? t('review.location_moved')
                                                                : group === 'location' && details.distance_metres !== null
                                                                  ? `${format(group, draft)} · ${t('review.moved', { distance: details.distance_metres })}`
                                                                  : format(group, draft)}
                                                        </span>
                                                    </span>
                                                )}
                                                {isEdited(group) && accepted[group] && (
                                                    <span className="text-xs text-orange-700 dark:text-orange-400">
                                                        {t('review.edited', { value: format(group, proposed) })}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1">
                                                {can && accepted[group] && (
                                                    <EditButton
                                                        edited={isEdited(group)}
                                                        editing={editing === group}
                                                        label={t('review.edit', { field: t(`groups.${group}`) })}
                                                        onEdit={() => setEditing(editing === group ? null : group)}
                                                        onRestore={() => {
                                                            update(Object.fromEntries(GROUP_FIELDS[group].map((field) => [field, proposed[field]])));
                                                            setEditing(null);
                                                        }}
                                                    />
                                                )}
                                                <Checkbox
                                                    checked={accepted[group]}
                                                    disabled={!can}
                                                    aria-label={t('review.take_over', { field: t(`groups.${group}`) })}
                                                    onCheckedChange={(checked) => setAccepted((previous) => ({ ...previous, [group]: !!checked }))}
                                                    className="mt-0.5 cursor-pointer"
                                                />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                            <ContributorCard contributor={item.contributor} kind="improvement" />
                        </div>
                        <Checks checks={checks} />
                    </TwoColumns>
                    <Timeline events={evidence.timeline} confirmed={evidence.confirmed_total} />
                </>
            }
        />
    );
}
