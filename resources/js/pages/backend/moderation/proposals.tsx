import type { OrientationOption } from '@/components/contribute/types';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { PaginatedResponse, RestrictionDay } from '@/types';
import { Form, Head, Link, router } from '@inertiajs/react';
import { ArrowRight, CircleCheck, Undo2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DuplicateWalk, walkTarget, type Walk, type WalkAnswer } from './duplicate-walk';
import type { MapPoint } from './geo';
import type { PublishedBay } from './location-proposal-draft';
import {
    ExistingLine,
    LocationProposalReview,
    LocationProposals,
    SOURCE_COLOR,
    toLocationProposal,
    type ClosedDecision,
    type NearbyPlace,
    type ProposalOverlap,
    type ProposalRow,
} from './location-proposals';
import type { EnumOption } from './values';
import { PanelNav, Workspace } from './workspace';

type Point = ProposalRow['points'][number];
type ClosedRow = ProposalRow & {
    decidedAt: string;
    moderator: string | null;
    existing: { source: 'municipal' | 'community'; street: string | null; distance_metres: number | null } | null;
};
type Props = {
    proposals: PaginatedResponse<ProposalRow | ClosedRow> | null;
    municipalities: { id: number; name: string; open_count: number; point: MapPoint | null }[];
    municipality: number | null;
    municipalityName: string | null;
    hasNext: boolean;
    fromQueue: boolean;
    view: 'open' | 'closed';
    /** Open proposals in the municipality with parking already on the map within 3 m, across all pages. */
    onMapCount: number;
    /** Proposals just closed as already on the map, so the moderator can undo it. */
    recentlyClosed: number[];
    bayOptions: {
        orientations: OrientationOption[];
        restrictionDays: RestrictionDay[];
        maxBays: number;
        completionReasons: EnumOption[];
        rejectionReasons: EnumOption[];
    };
    selected: {
        id: number;
        pointId: number;
        municipality: string;
        points: Point[];
        candidates: Point[];
        published: boolean;
        revision: number;
        reportedBays: number | null;
        canReject: boolean;
        publishedBays: PublishedBay[];
        imagery: AerialLayer[];
        community: NearbyPlace[];
        municipal: NearbyPlace[];
        decision: ClosedDecision | null;
    } | null;
};

/** Signs that keep their proposal open after going over them stay on the map, quieter. */
const LEFT_OUT_COLOR = '#64748b';
/** Close enough on the aerial photo to count the bays at one sign. */
const WALK_ZOOM = 20;

/** The parking spaces already on the map near these proposals, split the way the map draws them. */
function existingOnMap(rows: ProposalRow[]) {
    const overlaps = rows.flatMap((row) => row.points.flatMap((point) => (point.overlap ? [point.overlap] : [])));
    const unique = (source: ProposalOverlap['source']) => [
        ...new Map(overlaps.filter((overlap) => overlap.source === source).map((overlap) => [overlap.id, overlap])).values(),
    ];

    return { nearby: unique('community'), municipal: unique('municipal') };
}

export default function Proposals({
    proposals,
    municipalities,
    municipality,
    municipalityName,
    hasNext,
    selected,
    bayOptions,
    fromQueue,
    view,
    onMapCount,
    recentlyClosed,
}: Props) {
    const { t } = useTranslation('backend/moderation');
    const routes = app.moderation.proposals;
    const query = { ...(municipality ? { municipality } : {}), page: proposals?.current_page };
    const [walk, setWalk] = useState<Walk | null>(null);
    const [closing, setClosing] = useState(false);
    const [grouping, setGrouping] = useState<{ proposal: number; candidate: string } | null>(null);
    const candidate =
        grouping?.proposal === selected?.id ? selected?.candidates.find((point) => String(point.proposal_id) === grouping?.candidate) : undefined;

    const reviewQuery = { ...query, ...(selected ? { point: selected.pointId } : {}), ...(fromQueue ? { from: 'queue' as const } : {}) };
    const rows = proposals?.data.map(toLocationProposal) ?? [];
    const onMapRows = view === 'open' ? (proposals?.data ?? []).filter((row) => row.points.some((point) => point.overlap)) : [];
    const todoRows = view === 'open' ? (proposals?.data ?? []).filter((row) => !onMapRows.includes(row)) : [];
    const closedRows = view === 'closed' ? ((proposals?.data ?? []) as ClosedRow[]) : [];
    const walking = walk !== null && onMapRows.length > 0;
    const walkRow = walking ? (onMapRows[walk.index] ?? null) : null;
    const walkPoint = walkRow ? walkTarget(walkRow) : null;
    const existing = walkPoint ? existingOnMap([walkRow!]) : existingOnMap(onMapRows);
    const duplicateLabel = bayOptions.rejectionReasons.find((option) => option.value === 'duplicate')?.label;

    const closeConfirmed = (ids: number[]) => {
        if (ids.length === 0 || closing) return;
        setClosing(true);
        router.post(
            routes.duplicates.close.url(),
            { proposals: ids, municipality },
            { preserveScroll: true, onSuccess: () => setWalk(null), onFinish: () => setClosing(false) },
        );
    };
    const undo = () => router.post(routes.duplicates.reopen.url(), { proposals: recentlyClosed, municipality }, { preserveScroll: true });
    const answer = useCallback(
        (row: ProposalRow, value: WalkAnswer) =>
            setWalk((current) => current && { index: current.index + 1, answers: { ...current.answers, [row.id]: value } }),
        [],
    );
    const overview = routes.index({ query: { overview: 1 } });
    const next = hasNext && municipality !== null ? routes.index({ query: { municipality, after: selected?.id ?? 0 } }) : undefined;
    const review = selected
        ? toLocationProposal({
              id: selected.id,
              municipality: selected.municipality,
              status: selected.published ? 'added' : 'open',
              bayCount: selected.reportedBays,
              points: selected.points,
          })
        : null;
    const municipalityPins = municipalities.flatMap((item) =>
        item.point
            ? [
                  {
                      key: String(item.id),
                      point: item.point,
                      color: SOURCE_COLOR,
                      label: `${item.name} · ${t('proposals.open_count', { count: item.open_count })}`,
                      count: item.open_count,
                      legendLabel: t('map.legend.municipality_count'),
                  },
              ]
            : [],
    );
    const selectedPoint = review?.points.find((point) => point.id === selected?.pointId);

    const groups = selected && (
        <>
            <section aria-labelledby="proposal-on-map" className="flex flex-col gap-2">
                <h3 id="proposal-on-map" className="text-sm font-semibold">
                    {t('proposals.on_map')}
                </h3>
                {(() => {
                    const close = [
                        ...selected.community.map((place) => ({ ...place, source: 'community' as const })),
                        ...selected.municipal.map((place) => ({ ...place, source: 'municipal' as const })),
                    ]
                        .filter((place) => place.possible_duplicate)
                        .sort((a, b) => a.distance_metres - b.distance_metres);

                    return close.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('proposals.on_map_none_hint')}</p>
                    ) : (
                        <ul className="divide-y overflow-hidden rounded-xl border bg-muted/40 text-sm">
                            {close.map((place) => (
                                <li key={`${place.source}:${place.id}`} className="flex items-center gap-3 px-3 py-2.5">
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="font-medium">{place.street ?? t('proposals.unknown_street')}</span>
                                        <span className="text-[13px] text-muted-foreground">
                                            <ExistingLine source={place.source} distance={null} />
                                        </span>
                                    </span>
                                    <span className="text-[13px] text-muted-foreground tabular-nums">
                                        {t('proposals.overlap_distance', { count: place.distance_metres })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    );
                })()}
            </section>
            {selected.candidates.length > 0 && (
                <Form action={routes.group(selected.id, { query: reviewQuery })} className="space-y-2">
                    {({ processing, errors }) => (
                        <>
                            <label className="block text-sm font-semibold" htmlFor="group-with">
                                {t('proposals.group')}
                            </label>
                            <p className="text-sm text-muted-foreground">{t('proposals.group_help')}</p>
                            <select
                                id="group-with"
                                name="with"
                                required
                                value={candidate?.proposal_id ?? ''}
                                onChange={(event) => setGrouping({ proposal: selected.id, candidate: event.target.value })}
                                className="w-full rounded-md border bg-background p-2 text-sm"
                            >
                                <option value="" disabled>
                                    {t('proposals.choose')}
                                </option>
                                {selected.candidates.map((point) => (
                                    <option key={point.id} value={point.proposal_id}>
                                        #{point.proposal_id} · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                                    </option>
                                ))}
                            </select>
                            {errors.with && (
                                <p role="alert" className="text-sm text-destructive">
                                    {errors.with}
                                </p>
                            )}
                            <Button type="submit" variant="outline" disabled={processing}>
                                {t('proposals.group')}
                            </Button>
                        </>
                    )}
                </Form>
            )}
        </>
    );

    return (
        <AppLayout
            breadcrumbs={[
                { title: t('queue.label'), href: app.moderation.index.url() },
                { title: t('proposals.title'), href: overview.url },
            ]}
        >
            <Head title={t('proposals.title')} />
            <div className="flex h-[calc(100svh-4rem)] min-h-0 md:h-[calc(100svh-5rem)] md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(100svh-4rem)]">
                {selected && review && selectedPoint ? (
                    <LocationProposalReview
                        key={`${selected.id}:${selected.pointId}:${selected.revision}`}
                        selection={{ proposal: review, point: selectedPoint }}
                        imagery={selected.imagery}
                        options={bayOptions}
                        publishedBays={selected.publishedBays}
                        revision={selected.revision}
                        canReject={selected.canReject}
                        community={selected.community}
                        municipal={selected.municipal}
                        decision={selected.decision}
                        comparison={candidate}
                        group={groups}
                        query={reviewQuery}
                        nextUrl={next?.url}
                        onPointChange={(point) => router.visit(routes.index({ query: { ...reviewQuery, proposal: selected.id, point } }))}
                        onBack={() =>
                            router.visit(
                                fromQueue
                                    ? app.moderation.index()
                                    : routes.index({ query: { ...query, ...(selected.decision ? { view: 'closed' } : {}) } }),
                            )
                        }
                    />
                ) : (
                    <Workspace
                        scope={walkPoint ? 'item' : 'overview'}
                        label={t(walking ? 'proposals.walk_label' : 'proposals.title')}
                        streetView={walkPoint?.point}
                        map={{
                            center: walkPoint?.point ?? rows[0]?.points[0] ?? municipalityPins[0]?.point ?? { latitude: 52.2, longitude: 5.3 },
                            zoom: walkPoint ? WALK_ZOOM : municipality === null ? 7 : 12,
                            nearby: existing.nearby,
                            municipal: existing.municipal,
                            queue:
                                municipality === null
                                    ? municipalityPins
                                    : (walkPoint ? [toLocationProposal(walkRow!)] : walking ? onMapRows.map(toLocationProposal) : rows).flatMap(
                                          (item) =>
                                              item.points.map((point) => ({
                                                  key: String(point.id),
                                                  point,
                                                  color: walking && !walkPoint && walk.answers[item.id] !== 'ok' ? LEFT_OUT_COLOR : SOURCE_COLOR,
                                                  label: item.street,
                                                  legendLabel: t('map.source_point'),
                                              })),
                                      ),
                            onPick: (key) => {
                                if (walking) return;
                                if (municipality === null) {
                                    router.visit(routes.index({ query: { municipality: key } }));
                                    return;
                                }
                                const item = rows.find((row) => row.points.some((point) => String(point.id) === key));
                                if (item) router.visit(routes.index({ query: { ...query, proposal: item.id, point: key } }));
                            },
                        }}
                    >
                        {walking ? (
                            <DuplicateWalk
                                rows={onMapRows}
                                walk={walk}
                                reasonLabel={duplicateLabel}
                                closing={closing}
                                onAnswer={answer}
                                onPrevious={() => setWalk((current) => current && { ...current, index: Math.max(0, current.index - 1) })}
                                onRestart={() => setWalk({ index: 0, answers: {} })}
                                onStop={() => setWalk(null)}
                                onClose={closeConfirmed}
                            />
                        ) : (
                            <>
                                <PanelNav
                                    back={t(municipality === null ? 'queue.label' : 'proposals.municipality_overview')}
                                    onBack={() => router.visit(municipality === null ? app.moderation.index() : overview)}
                                />
                                <div className="min-h-0 flex-1 overflow-y-auto">
                                    {proposals === null ? (
                                        <>
                                            <h2 className="px-5 pt-4 pb-2 text-lg font-semibold">{t('proposals.municipality_overview')}</h2>
                                            {municipalities.length === 0 && (
                                                <p className="px-5 py-2 text-sm text-muted-foreground">{t('proposals.no_open')}</p>
                                            )}
                                            <ul className="divide-y">
                                                {municipalities.map((item) => (
                                                    <li key={item.id}>
                                                        <Link
                                                            href={routes.index({ query: { municipality: item.id } })}
                                                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                                        >
                                                            <span className="font-medium">{item.name}</span>
                                                            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                                                {t('proposals.open_count', { count: item.open_count })}
                                                            </span>
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex flex-col gap-3 px-5 pt-4 pb-2">
                                                <h2 className="text-lg font-semibold">{municipalityName}</h2>
                                                <nav aria-label={t('proposals.views_label')} className="flex rounded-[10px] bg-muted p-1">
                                                    {(['open', 'closed'] as const).map((option) => (
                                                        <Link
                                                            key={option}
                                                            href={routes.index({
                                                                query: { municipality, ...(option === 'closed' ? { view: 'closed' } : {}) },
                                                            })}
                                                            aria-current={view === option ? 'page' : undefined}
                                                            className={cn(
                                                                'flex h-9 flex-1 items-center justify-center rounded-[7px] text-sm focus-visible:outline-2 focus-visible:outline-ring',
                                                                view === option
                                                                    ? 'bg-background font-semibold shadow-sm'
                                                                    : 'font-medium text-stone-600 hover:text-foreground dark:text-muted-foreground',
                                                            )}
                                                        >
                                                            {t(`proposals.view_${option}`)}
                                                        </Link>
                                                    ))}
                                                </nav>
                                            </div>
                                            {view === 'open' && recentlyClosed.length > 0 && (
                                                <div
                                                    role="status"
                                                    className="mx-5 my-2 flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2 text-sm"
                                                >
                                                    <CircleCheck className="size-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden />
                                                    <span className="flex-1">{t('proposals.closed_recently', { count: recentlyClosed.length })}</span>
                                                    <Button variant="ghost" size="sm" className="h-9" onClick={undo}>
                                                        <Undo2 aria-hidden />
                                                        {t('proposals.undo')}
                                                    </Button>
                                                </div>
                                            )}
                                            {view === 'closed' ? (
                                                closedRows.length === 0 ? (
                                                    <p className="px-5 py-3 text-sm text-muted-foreground">{t('proposals.closed_empty')}</p>
                                                ) : (
                                                    <>
                                                        <p className="px-5 pt-1 pb-2 text-[13px] text-muted-foreground">
                                                            {t('proposals.closed_list_hint')}
                                                        </p>
                                                        <ul className="flex flex-col">
                                                            {closedRows.map((row) => (
                                                                <li key={row.id} className="border-t border-muted">
                                                                    <Link
                                                                        href={routes.index({
                                                                            query: { municipality, view: 'closed', proposal: row.id },
                                                                        })}
                                                                        className="flex items-center gap-3 py-2.5 pr-4 pl-[18px] hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                                                    >
                                                                        <span
                                                                            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted"
                                                                            aria-hidden
                                                                        >
                                                                            <CircleCheck className="size-[18px] text-stone-600 dark:text-muted-foreground" />
                                                                        </span>
                                                                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                                                                            <span className="truncate text-[15px] font-medium">
                                                                                {toLocationProposal(row).street}
                                                                            </span>
                                                                            <span className="text-[13px] text-muted-foreground">
                                                                                {row.existing ? (
                                                                                    <ExistingLine
                                                                                        source={row.existing.source}
                                                                                        distance={row.existing.distance_metres}
                                                                                    />
                                                                                ) : (
                                                                                    duplicateLabel
                                                                                )}
                                                                            </span>
                                                                        </span>
                                                                        <span className="shrink-0 text-[13px] text-muted-foreground">
                                                                            {new Intl.DateTimeFormat(undefined, {
                                                                                day: 'numeric',
                                                                                month: 'short',
                                                                            }).format(new Date(row.decidedAt))}
                                                                        </span>
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )
                                            ) : rows.length === 0 ? (
                                                <p className="px-5 py-3 text-sm text-muted-foreground">{t('proposals.no_open')}</p>
                                            ) : (
                                                <>
                                                    {onMapRows.length > 0 && (
                                                        <LocationProposals
                                                            title={t('proposals.group_on_map')}
                                                            total={onMapCount}
                                                            proposals={onMapRows.map(toLocationProposal)}
                                                            action={
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-9"
                                                                    onClick={() => setWalk({ index: 0, answers: {} })}
                                                                >
                                                                    {t('proposals.walk_start')}
                                                                </Button>
                                                            }
                                                            onOpen={({ proposal, point }) =>
                                                                router.visit(
                                                                    routes.index({ query: { ...query, proposal: proposal.id, point: point.id } }),
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    {todoRows.length > 0 && (
                                                        <LocationProposals
                                                            title={t('proposals.group_todo')}
                                                            total={proposals.total - onMapCount}
                                                            proposals={todoRows.map(toLocationProposal)}
                                                            onOpen={({ proposal, point }) =>
                                                                router.visit(
                                                                    routes.index({ query: { ...query, proposal: proposal.id, point: point.id } }),
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                                {(next || proposals?.prev_page_url || proposals?.next_page_url) && (
                                    <div className="flex shrink-0 flex-wrap gap-2 border-t px-5 py-4">
                                        {next && (
                                            <Button asChild>
                                                <Link href={next}>
                                                    {t('proposals.next_proposal')} <ArrowRight aria-hidden />
                                                </Link>
                                            </Button>
                                        )}
                                        {proposals?.prev_page_url && (
                                            <Button variant="outline" asChild>
                                                <Link href={proposals.prev_page_url}>{t('proposals.previous')}</Link>
                                            </Button>
                                        )}
                                        {proposals?.next_page_url && (
                                            <Button variant="outline" asChild>
                                                <Link href={proposals.next_page_url}>{t('proposals.next')}</Link>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </Workspace>
                )}
            </div>
        </AppLayout>
    );
}
