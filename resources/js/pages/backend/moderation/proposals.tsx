import type { OrientationOption } from '@/components/contribute/types';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { PaginatedResponse, RestrictionDay } from '@/types';
import { Form, Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapPoint } from './geo';
import type { PublishedBay } from './location-proposal-draft';
import { LocationProposalReview, LocationProposals, toLocationProposal, type ProposalRow } from './location-proposals';
import type { EnumOption } from './values';
import { PanelNav, Workspace } from './workspace';

type Point = ProposalRow['points'][number];
type NearbyPlace = MapPoint & { street: string | null; distance_metres: number };
type Props = {
    proposals: PaginatedResponse<ProposalRow>;
    municipalities: { id: number; name: string }[];
    municipality: string | number | null;
    fromQueue: boolean;
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
        duplicates: (MapPoint & { id: string; street: string | null })[];
        publishedBays: PublishedBay[];
        imagery: AerialLayer[];
        community: NearbyPlace | null;
        municipal: NearbyPlace | null;
    } | null;
};

export default function Proposals({ proposals, municipalities, municipality, selected, bayOptions, fromQueue }: Props) {
    const { t } = useTranslation('backend/moderation');
    const routes = app.moderation.proposals;
    const query = { ...(municipality ? { municipality } : {}), page: proposals.current_page };
    const [grouping, setGrouping] = useState<{ proposal: number; candidate: string } | null>(null);
    const candidate =
        grouping?.proposal === selected?.id ? selected?.candidates.find((point) => String(point.proposal_id) === grouping?.candidate) : undefined;

    const reviewQuery = { ...query, ...(selected ? { point: selected.pointId } : {}), ...(fromQueue ? { from: 'queue' as const } : {}) };
    const rows = proposals.data.map(toLocationProposal);
    const review = selected
        ? toLocationProposal({
              id: selected.id,
              municipality: selected.municipality,
              status: selected.published ? 'added' : 'open',
              bayCount: selected.reportedBays,
              points: selected.points,
          })
        : null;
    const selectedPoint = review?.points.find((point) => point.id === selected?.pointId);

    const groups = selected && (
        <>
            {(selected.community || selected.municipal) && (
                <section className="space-y-1 text-sm">
                    <h3 className="font-semibold">{t('proposals.nearby')}</h3>
                    {(
                        [
                            ['community', selected.community],
                            ['municipal', selected.municipal],
                        ] as const
                    ).map(
                        ([kind, place]) =>
                            place && (
                                <p key={kind}>
                                    {t(`proposals.${kind}`)} · {place.street ?? t('proposals.unknown_street')} · {place.distance_metres} m
                                </p>
                            ),
                    )}
                </section>
            )}
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
                { title: t('proposals.title'), href: routes.index.url() },
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
                        duplicates={selected.duplicates}
                        nearby={selected.community ?? undefined}
                        municipal={selected.municipal ?? undefined}
                        comparison={candidate}
                        group={groups}
                        query={reviewQuery}
                        onBack={() => router.visit(fromQueue ? app.moderation.index() : routes.index({ query }))}
                    />
                ) : (
                    <Workspace
                        scope="overview"
                        label={t('proposals.title')}
                        map={{
                            center: rows[0]?.points[0] ?? { latitude: 52.2, longitude: 5.3 },
                            zoom: 7,
                            queue: rows.flatMap((item) =>
                                item.points.map((point) => ({ key: String(point.id), point, color: '#1e3a8a', label: item.street })),
                            ),
                            onPick: (key) => {
                                const item = rows.find((row) => row.points.some((point) => String(point.id) === key));
                                if (item) router.visit(routes.index({ query: { ...query, proposal: item.id, point: key } }));
                            },
                        }}
                    >
                        <PanelNav back={t('queue.label')} onBack={() => router.visit(app.moderation.index())} />
                        <div className="px-4.5 py-3">
                            <Select
                                value={municipality === null ? 'all' : String(municipality)}
                                onValueChange={(value) => router.get(routes.index.url(), value === 'all' ? {} : { municipality: value })}
                            >
                                <SelectTrigger aria-label={t('queue.all_municipalities')}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('queue.all_municipalities')}</SelectItem>
                                    {municipalities.map((item) => (
                                        <SelectItem key={item.id} value={String(item.id)}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <LocationProposals
                                proposals={rows}
                                total={proposals.total}
                                onOpen={({ proposal, point }) =>
                                    router.visit(routes.index({ query: { ...query, proposal: proposal.id, point: point.id } }))
                                }
                            />
                        </div>
                        {(proposals.prev_page_url || proposals.next_page_url) && (
                            <div className="flex shrink-0 gap-2 border-t px-5 py-4">
                                {proposals.prev_page_url && (
                                    <Button variant="outline" asChild>
                                        <Link href={proposals.prev_page_url}>{t('proposals.previous')}</Link>
                                    </Button>
                                )}
                                {proposals.next_page_url && (
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
