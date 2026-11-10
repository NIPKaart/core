import type { OrientationOption } from '@/components/contribute/types';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { PaginatedResponse, RestrictionDay } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, CircleCheck, Undo2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { candidatePins, chosenPin, DuplicateWalk, pinKey, walkTarget, type ConfirmedMatch, type Walk, type WalkAnswer } from './duplicate-walk';
import type { MapPoint } from './geo';
import type { PublishedBay } from './location-proposal-draft';
import {
    EXISTING_COLOR,
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
import { PanelNav, SharedWorkspace, Workspace } from './workspace';

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
    parking: { community: MapPoint[]; municipal: MapPoint[] } | null;
    hasNext: boolean;
    fromQueue: boolean;
    view: 'open' | 'closed';
    /** Open proposals in the municipality with parking already on the map within 3 m, across all pages. */
    onMapCount: number;
    /** Proposals just closed as already on the map, so the moderator can undo it. */
    recentlyClosed: number[];
    failedMatches: number[];
    bayOptions: {
        orientations: OrientationOption[];
        restrictionDays: RestrictionDay[];
        maxBays: number;
        rejectionReasons: EnumOption[];
    };
    selected: {
        id: number;
        pointId: number;
        municipality: string;
        points: Point[];
        published: boolean;
        revision: number;
        canReject: boolean;
        publishedBays: PublishedBay[];
        imagery: AerialLayer[];
        community: NearbyPlace[];
        municipal: NearbyPlace[];
        decision: ClosedDecision | null;
    } | null;
};

/** While going over signs: answered complete, answered missing bays, and still to answer, on the map and in its legend. */
const WALK_COLOR = { ok: '#171717', missing: '#c2410c', open: SOURCE_COLOR } as const;
/** Close enough on the aerial photo to count the bays at one sign, with neighbouring signs still in view. */
const WALK_ZOOM = 19;

export default function Proposals({
    proposals,
    municipalities,
    municipality,
    municipalityName,
    parking,
    hasNext,
    selected,
    bayOptions,
    fromQueue,
    view,
    onMapCount,
    recentlyClosed,
    failedMatches,
}: Props) {
    const { t } = useTranslation('backend/moderation');
    const routes = app.moderation.proposals;
    const query = { ...(municipality ? { municipality } : {}), page: proposals?.current_page };
    const [walk, setWalk] = useState<Walk | null>(null);
    const [closing, setClosing] = useState(false);
    const loadedQueue = useRef<typeof proposals>(null);

    const reviewQuery = { ...query, ...(selected ? { point: selected.pointId } : {}), ...(fromQueue ? { from: 'queue' as const } : {}) };
    const rows = proposals?.data.map(toLocationProposal) ?? [];
    const onMapRows = view === 'open' ? (proposals?.data ?? []).filter((row) => row.points.some((point) => point.overlap)) : [];
    const todoRows = view === 'open' ? (proposals?.data ?? []).filter((row) => !onMapRows.includes(row)) : [];
    const closedRows = view === 'closed' ? ((proposals?.data ?? []) as ClosedRow[]) : [];
    const bulkRows = onMapRows.filter((row) => row.points.length === 1);
    const walking = walk !== null && bulkRows.length > 0;
    const walkRow = walking ? (bulkRows[walk.index] ?? null) : null;
    const walkPoint = walkRow ? walkTarget(walkRow) : null;
    const walkPin = walkRow && walk ? chosenPin(walkRow, walk) : undefined;
    const walkCandidates = candidatePins(walkPoint);
    const walkCenter =
        walkPoint && walkPin
            ? {
                  latitude: (walkPoint.point.latitude + walkPin.latitude) / 2,
                  longitude: (walkPoint.point.longitude + walkPin.longitude) / 2,
              }
            : walkPoint?.point;
    const walkDistance = walkPin?.distance_metres ?? 0;
    const walkZoom = walkDistance > 120 ? 16 : walkDistance > 40 ? 17 : WALK_ZOOM;
    const choosePin = (row: ProposalRow, pin: ProposalOverlap) =>
        setWalk((current) => current && { ...current, choices: { ...current.choices, [row.id]: pin } });
    const walkTo = (index: number) => setWalk((current) => current && { ...current, index });
    const duplicateLabel = bayOptions.rejectionReasons.find((option) => option.value === 'duplicate')?.label;

    const closeConfirmed = (matches: ConfirmedMatch[]) => {
        if (matches.length === 0 || closing) return;
        setClosing(true);
        router.post(
            routes.duplicates.close.url(),
            { matches, municipality },
            { preserveScroll: true, onSuccess: () => setWalk(null), onFinish: () => setClosing(false) },
        );
    };
    const undo = () => router.post(routes.duplicates.reopen.url(), { proposals: recentlyClosed, municipality }, { preserveScroll: true });
    const answer = useCallback(
        (row: ProposalRow, value: WalkAnswer) =>
            setWalk((current) => current && { ...current, index: current.index + 1, answers: { ...current.answers, [row.id]: value } }),
        [],
    );
    const overview = routes.index({ query: { overview: 1 } });
    const next = hasNext && municipality !== null ? routes.index({ query: { municipality, after: selected?.id ?? 0 } }) : undefined;
    const review = selected
        ? toLocationProposal({
              id: selected.id,
              municipality: selected.municipality,
              revision: selected.revision,
              status: selected.published ? 'added' : 'open',
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
    const proposalPins = rows.flatMap((item) =>
        item.points.map((point) => ({
            key: String(point.id),
            point,
            color: SOURCE_COLOR,
            label: item.street,
            legendLabel: t('map.source_point'),
        })),
    );
    const pickProposal = (key: string) => {
        const item = rows.find((row) => row.points.some((point) => String(point.id) === key));
        if (item) {
            if (!selected) loadedQueue.current = view === 'open' ? proposals : null;
            router.visit(routes.index({ query: { ...query, proposal: item.id, point: key } }), {
                preserveState: true,
                preserveScroll: true,
                only: view === 'open' ? ['selected'] : undefined,
                showProgress: false,
            });
        }
    };
    const backToQueue = () => {
        const destination = fromQueue
            ? app.moderation.index()
            : routes.index({ query: { ...query, ...(selected?.decision ? { view: 'closed' } : {}) } });
        if (!fromQueue && !selected?.decision && proposals && loadedQueue.current === proposals) {
            router.push({
                url: destination.url,
                props: (props) => ({ ...props, selected: null }),
                preserveState: true,
                preserveScroll: true,
            });
            return;
        }

        router.visit(destination, { preserveState: !fromQueue, preserveScroll: true, showProgress: fromQueue });
    };
    const selectedPoint = review?.points.find((point) => point.id === selected?.pointId);

    return (
        <AppLayout
            breadcrumbs={[
                { title: t('title'), href: app.moderation.index.url() },
                { title: t('proposals.title'), href: overview.url },
            ]}
        >
            <Head title={t('proposals.title')} />
            <SharedWorkspace className="flex h-[calc(100svh-4rem)] min-h-0 md:h-[calc(100svh-5rem)] md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(100svh-4rem)]">
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
                        query={reviewQuery}
                        nextUrl={next?.url}
                        proposalPins={fromQueue || selected.decision ? undefined : proposalPins.filter((pin) => pin.key !== String(selected.pointId))}
                        onPickProposal={pickProposal}
                        parking={parking}
                        onPointChange={(point) =>
                            router.visit(routes.index({ query: { ...reviewQuery, proposal: selected.id, point } }), {
                                preserveState: true,
                                preserveScroll: true,
                                only: ['selected'],
                                showProgress: false,
                            })
                        }
                        onBack={backToQueue}
                    />
                ) : (
                    <Workspace
                        scope={walkPoint ? 'item' : 'overview'}
                        label={t(walking ? 'proposals.walk_label' : 'proposals.title')}
                        streetView={walkPoint?.point}
                        map={{
                            center: walkCenter ??
                                rows[0]?.points[0] ??
                                municipalityPins[0]?.point ??
                                parking?.community[0] ??
                                parking?.municipal[0] ?? { latitude: 52.2, longitude: 5.3 },
                            zoom: walkPoint ? walkZoom : municipality === null ? 7 : 12,
                            nearby: walking ? [] : parking?.community,
                            municipal: walking ? [] : parking?.municipal,
                            fitParking: parking !== null,
                            fitQueue: !walkPoint,
                            overviewKey: walking || municipality === null ? undefined : String(municipality),
                            highlighted: walkPin ? pinKey(walkPin) : undefined,
                            queue:
                                municipality === null
                                    ? municipalityPins
                                    : walking
                                      ? [
                                            ...bulkRows.flatMap((row) => {
                                                const state = (walk.answers[row.id] as WalkAnswer | undefined) ?? 'open';
                                                return row.points.map((point) => ({
                                                    key: String(point.id),
                                                    point,
                                                    color: WALK_COLOR[state],
                                                    label: toLocationProposal(row).street,
                                                    legendLabel: state === 'open' ? t('map.source_point') : t(`proposals.walk_status_${state}`),
                                                }));
                                            }),
                                            ...walkCandidates.map((pin) => ({
                                                key: pinKey(pin),
                                                point: pin,
                                                color: EXISTING_COLOR[pin.source],
                                                label: pin.street ?? t('proposals.unknown_street'),
                                                legendLabel: t(`proposals.${pin.source}`),
                                            })),
                                        ]
                                      : proposalPins,
                            onPick: (key) => {
                                if (walking) {
                                    if (closing) return;
                                    const pin = walkCandidates.find((candidate) => pinKey(candidate) === key);
                                    if (pin && walkRow) {
                                        choosePin(walkRow, pin);
                                        return;
                                    }
                                    const index = bulkRows.findIndex((row) => row.points.some((point) => String(point.id) === key));
                                    if (index >= 0) walkTo(index);
                                    return;
                                }
                                if (municipality === null) {
                                    router.visit(routes.index({ query: { municipality: key } }));
                                    return;
                                }
                                pickProposal(key);
                            },
                        }}
                    >
                        {walking ? (
                            <DuplicateWalk
                                rows={bulkRows}
                                walk={walk}
                                reasonLabel={duplicateLabel}
                                closing={closing}
                                onAnswer={answer}
                                onChoose={choosePin}
                                onToggle={(row, checked) =>
                                    setWalk(
                                        (current) => current && { ...current, answers: { ...current.answers, [row.id]: checked ? 'ok' : 'missing' } },
                                    )
                                }
                                onToggleAll={(checked) =>
                                    setWalk(
                                        (current) =>
                                            current && {
                                                ...current,
                                                answers: checked ? Object.fromEntries(bulkRows.map((row) => [row.id, 'ok' as const])) : {},
                                            },
                                    )
                                }
                                onPrevious={() => walkTo(Math.max(0, walk.index - 1))}
                                onJump={walkTo}
                                onRestart={() => setWalk({ index: 0, answers: {}, choices: {} })}
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
                                                            preserveState
                                                            preserveScroll
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
                                            {view === 'open' && failedMatches.length > 0 && (
                                                <p role="status" className="mx-5 my-2 rounded-xl bg-muted px-3 py-2 text-sm">
                                                    {t('proposals.bulk_failed', { signs: failedMatches.map((id) => `#${id}`).join(', ') })}
                                                </p>
                                            )}
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
                                                                        preserveState
                                                                        preserveScroll
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
                                                                bulkRows.length > 0 && (
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-10 w-full"
                                                                        onClick={() => setWalk({ index: 0, answers: {}, choices: {} })}
                                                                    >
                                                                        {t('proposals.walk_start')}
                                                                    </Button>
                                                                )
                                                            }
                                                            onOpen={({ point }) => pickProposal(String(point.id))}
                                                        />
                                                    )}
                                                    {todoRows.length > 0 && (
                                                        <LocationProposals
                                                            title={t('proposals.group_todo')}
                                                            total={proposals.total - onMapCount}
                                                            proposals={todoRows.map(toLocationProposal)}
                                                            onOpen={({ point }) => pickProposal(String(point.id))}
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
                                                <Link href={next} preserveState preserveScroll>
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
            </SharedWorkspace>
        </AppLayout>
    );
}
