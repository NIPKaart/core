import type { OrientationOption } from '@/components/contribute/types';
import Heading from '@/components/heading';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { PaginatedResponse, RestrictionDay } from '@/types';
import { Form, Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapPoint } from './geo';
import { ProposalBayEditor } from './proposal-bay-editor';

type Point = {
    id: number;
    proposal_id: number;
    external_id: string;
    latitude: number;
    longitude: number;
    source: string;
    source_last_seen_on: string | null;
    under_sign_types: string[];
};

type NearbyPlace = { street: string | null; distance_metres: number; latitude: number; longitude: number };
type Props = {
    proposals: PaginatedResponse<{ id: number; municipality: string; points: Point[]; status: 'open' | 'added'; bayCount: number | null }>;
    municipalities: { id: number; name: string }[];
    municipality: string | number | null;
    bayOptions: { orientations: OrientationOption[]; restrictionDays: RestrictionDay[]; maxBays: number };
    selected: {
        id: number;
        points: Point[];
        candidates: Point[];
        published: boolean;
        publishedBays: MapPoint[];
        imagery: AerialLayer[];
        community: NearbyPlace | null;
        municipal: NearbyPlace | null;
    } | null;
};

export default function LocationProposals({ proposals, municipalities, municipality, selected, bayOptions }: Props) {
    const { t } = useTranslation('backend/moderation');
    const routes = app.moderation.proposals;
    const query = municipality ? { municipality } : {};
    const anchor = selected?.points[0];
    const [grouping, setGrouping] = useState<{ proposal: number; candidate: string } | null>(null);
    const candidate =
        grouping?.proposal === selected?.id ? selected?.candidates.find((point) => String(point.proposal_id) === grouping?.candidate) : undefined;

    return (
        <AppLayout
            breadcrumbs={[
                { title: t('queue.label'), href: app.moderation.index.url() },
                { title: t('proposals.title'), href: routes.index.url() },
            ]}
        >
            <Head title={t('proposals.title')} />
            <div className="space-y-4 p-4 md:p-6">
                <Heading title={t('proposals.title')} description={t('proposals.description')} />
                <Button variant="outline" asChild>
                    <Link href={app.moderation.index()}>{t('queue.label')}</Link>
                </Button>
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,25rem)_minmax(0,1fr)]">
                    <section className="space-y-3 rounded-xl border bg-card p-4">
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
                        <p className="text-sm text-muted-foreground">{t('proposals.count', { count: proposals.total })}</p>
                        <ul className="divide-y">
                            {proposals.data.map((item) => (
                                <li key={item.id}>
                                    <Link
                                        href={routes.index({ query: { ...query, page: proposals.current_page, proposal: item.id } })}
                                        aria-current={selected?.id === item.id ? 'true' : undefined}
                                        className="block rounded-md px-2 py-2.5 hover:bg-muted aria-[current=true]:bg-muted"
                                    >
                                        <span className="block text-sm font-semibold">
                                            {item.municipality} · #{item.id}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {item.points[0]?.source} · {t(`proposals.${item.status}`)} ·{' '}
                                            {t('proposals.points', { count: item.points.length })}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-2">
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
                    </section>
                    {selected && anchor && (
                        <section className="space-y-4 rounded-xl border bg-card p-4">
                            <h2 className="text-lg font-semibold">
                                {t('proposals.title')} · #{selected.id}
                            </h2>
                            <ProposalBayEditor
                                key={selected.id}
                                proposal={selected.id}
                                points={selected.points}
                                comparison={candidate}
                                community={selected.community ?? undefined}
                                municipal={selected.municipal ?? undefined}
                                aerial={selected.imagery[0]}
                                published={selected.published}
                                publishedBays={selected.publishedBays}
                                query={{ ...query, page: proposals.current_page }}
                                {...bayOptions}
                            />
                            <ul className="space-y-2 text-sm">
                                {selected.points.map((point) => (
                                    <li key={point.id}>
                                        <p className="font-medium">
                                            {point.source} · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {point.external_id}
                                            {point.source_last_seen_on && ` · ${point.source_last_seen_on}`}
                                            {point.under_sign_types.length > 0 && ` · ${point.under_sign_types.join(', ')}`}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <div className="space-y-2 text-sm">
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
                                {!selected.community && !selected.municipal && <p className="text-muted-foreground">{t('proposals.none_nearby')}</p>}
                            </div>
                            <details className="space-y-2">
                                <summary className="cursor-pointer text-sm font-semibold">Street View</summary>
                                <StreetViewCard latitude={anchor.latitude} longitude={anchor.longitude} />
                            </details>
                            {selected.candidates.length > 0 && (
                                <Form action={routes.group(selected.id, { query })} className="space-y-2">
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
                                                value={candidate ? String(candidate.proposal_id) : ''}
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
                                                <p className="text-sm text-destructive" role="alert">
                                                    {errors.with}
                                                </p>
                                            )}
                                            <Button type="submit" disabled={processing}>
                                                {t('proposals.group')}
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
