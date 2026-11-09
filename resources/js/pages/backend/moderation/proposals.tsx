import type { OrientationOption } from '@/components/contribute/types';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { PaginatedResponse, RestrictionDay } from '@/types';
import { Form, Head, Link, router } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapPoint } from './geo';
import type { PublishedBay } from './location-proposal-draft';
import { LocationProposalReview, LocationProposals, SOURCE_COLOR, toLocationProposal, type ProposalRow } from './location-proposals';
import type { EnumOption } from './values';
import { PanelNav, Workspace } from './workspace';

type Point = ProposalRow['points'][number];
type NearbyPlace = MapPoint & { id: string; street: string | null; distance_metres: number; possible_duplicate: boolean };
type OverlapFilter = 'possible' | 'none' | 'sample';
type Props = {
    proposals: PaginatedResponse<ProposalRow> | null;
    municipalities: { id: number; name: string; open_count: number; point: MapPoint | null }[];
    municipality: number | null;
    municipalityName: string | null;
    hasNext: boolean;
    fromQueue: boolean;
    overlap: OverlapFilter | null;
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
    } | null;
};

export default function Proposals({
    proposals,
    municipalities,
    municipality,
    municipalityName,
    hasNext,
    selected,
    bayOptions,
    fromQueue,
    overlap,
}: Props) {
    const { t } = useTranslation('backend/moderation');
    const routes = app.moderation.proposals;
    const query = { ...(municipality ? { municipality } : {}), overlap: overlap ?? undefined, page: proposals?.current_page };
    const [grouping, setGrouping] = useState<{ proposal: number; candidate: string } | null>(null);
    const candidate =
        grouping?.proposal === selected?.id ? selected?.candidates.find((point) => String(point.proposal_id) === grouping?.candidate) : undefined;

    const reviewQuery = { ...query, ...(selected ? { point: selected.pointId } : {}), ...(fromQueue ? { from: 'queue' as const } : {}) };
    const rows = proposals?.data.map(toLocationProposal) ?? [];
    const overview = routes.index({ query: { overview: 1 } });
    const next =
        hasNext && municipality !== null
            ? routes.index({ query: { municipality, overlap: overlap ?? undefined, after: selected?.id ?? 0 } })
            : undefined;
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
            <section className="space-y-1 text-sm">
                <h3 className="font-semibold">{t('proposals.nearby')}</h3>
                {[...selected.community, ...selected.municipal].some((place) => place.possible_duplicate) && (
                    <p className="font-medium">{t('proposals.possible_duplicate')}</p>
                )}
                {selected.community.length === 0 && selected.municipal.length === 0 && <p>{t('proposals.none_nearby')}</p>}
                {(
                    [
                        ['community', selected.community, 'bg-[#16a34a]'],
                        ['municipal', selected.municipal, 'bg-[#7c3aed]'],
                    ] as const
                ).map(
                    ([kind, places, color]) =>
                        places.length > 0 && (
                            <p key={kind} className="flex items-center gap-2">
                                <span className={`size-3 shrink-0 rounded-full ${color}`} aria-hidden />
                                <span>
                                    {t(`proposals.${kind}`)} · {places.length} · {places[0].street ?? t('proposals.unknown_street')} ·{' '}
                                    {places[0].distance_metres} m
                                </span>
                            </p>
                        ),
                )}
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
                        key={`${selected.id}:${selected.revision}`}
                        selection={{ proposal: review, point: selectedPoint }}
                        imagery={selected.imagery}
                        options={bayOptions}
                        publishedBays={selected.publishedBays}
                        revision={selected.revision}
                        canReject={selected.canReject}
                        community={selected.community}
                        municipal={selected.municipal}
                        comparison={candidate}
                        group={groups}
                        query={reviewQuery}
                        nextUrl={next?.url}
                        onBack={() => router.visit(fromQueue ? app.moderation.index() : routes.index({ query }))}
                    />
                ) : (
                    <Workspace
                        scope="overview"
                        label={t('proposals.title')}
                        map={{
                            center: rows[0]?.points[0] ?? municipalityPins[0]?.point ?? { latitude: 52.2, longitude: 5.3 },
                            zoom: municipality === null ? 7 : 12,
                            queue:
                                municipality === null
                                    ? municipalityPins
                                    : rows.flatMap((item) =>
                                          item.points.map((point) => ({
                                              key: String(point.id),
                                              point,
                                              color: SOURCE_COLOR,
                                              label: item.street,
                                              legendLabel: t('map.source_point'),
                                          })),
                                      ),
                            onPick: (key) => {
                                if (municipality === null) {
                                    router.visit(routes.index({ query: { municipality: key } }));
                                    return;
                                }
                                const item = rows.find((row) => row.points.some((point) => String(point.id) === key));
                                if (item) router.visit(routes.index({ query: { ...query, proposal: item.id, point: key } }));
                            },
                        }}
                    >
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
                                    <h2 className="px-5 pt-4 text-lg font-semibold">{municipalityName}</h2>
                                    <div className="flex flex-wrap gap-2 px-5 py-3" role="group" aria-label={t('proposals.overlap_filter')}>
                                        {([null, 'none', 'possible', 'sample'] as const).map((filter) => (
                                            <Button key={filter ?? 'all'} variant={filter === overlap ? 'default' : 'outline'} size="sm" asChild>
                                                <Link
                                                    href={routes.index({ query: { municipality, overlap: filter ?? undefined } })}
                                                    aria-current={filter === overlap ? 'page' : undefined}
                                                >
                                                    {t(`proposals.overlap_${filter ?? 'all'}`)}
                                                </Link>
                                            </Button>
                                        ))}
                                    </div>
                                    {rows.length === 0 ? (
                                        <p className="px-5 py-3 text-sm text-muted-foreground">{t('proposals.no_open')}</p>
                                    ) : (
                                        <LocationProposals
                                            proposals={rows}
                                            total={proposals.total}
                                            onOpen={({ proposal, point }) =>
                                                router.visit(routes.index({ query: { ...query, proposal: proposal.id, point: point.id } }))
                                            }
                                        />
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
                    </Workspace>
                )}
            </div>
        </AppLayout>
    );
}
