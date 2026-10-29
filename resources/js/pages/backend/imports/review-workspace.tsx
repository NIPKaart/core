import { index, show, update } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import InputError from '@/components/input-error';
import type { MapStyle } from '@/components/map/map-display-controls';
import ZoomControl from '@/components/map/zoom-control';
import MunicipalDateTime from '@/components/municipal-date-time';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Form, Link, router } from '@inertiajs/react';
import type { Geometry } from 'geojson';
import { geoJSON, latLngBounds } from 'leaflet';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Link2, LocateFixed, Map as MapIcon, MapPin, Satellite, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, GeoJSON, MapContainer, ScaleControl, Tooltip, useMap } from 'react-leaflet';
import type { Import } from './index';
import ReviewTiles from './review-map-tiles';
import SourceComparison, { MissingSourceNotice } from './source-comparison';
import { claimCapacity, claimTitle, reviewGeometries, type Row } from './source-record';

export type MapPoint = {
    external_id: string;
    title: string;
    status: Row['status'];
    point: { latitude: number; longitude: number };
    review_required: boolean;
};

export function DeliveryOverview({
    delivery,
    points,
    derivations,
    identities,
    recordCount,
    completed,
    onStart,
    onDecision,
    onSelect,
    onRecords,
}: {
    delivery: Import;
    points: MapPoint[];
    derivations: number;
    identities: number;
    recordCount: number;
    completed: number;
    onStart: (filter: string) => void;
    onDecision: () => void;
    onSelect: (id: string) => void;
    onRecords: () => void;
}) {
    const { t, i18n } = useTranslation('backend/imports');
    const pending = delivery.state === 'pending' && !delivery.superseded;
    return (
        <section className="space-y-5" aria-label={t('workspace.overview')}>
            <div className="grid divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                    { icon: MapPin, count: recordCount, label: t('workspace.source_records') },
                    { icon: TriangleAlert, count: derivations, label: t('workspace.geometry_tasks') },
                    { icon: Link2, count: identities, label: t('workspace.identity_tasks') },
                ].map(({ icon: Icon, count, label }) => (
                    <div key={label} className="flex items-center gap-3 px-5 py-4">
                        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                        <div>
                            <p className="text-xl font-semibold tabular-nums">{count.toLocaleString(i18n.language)}</p>
                            <p className="text-sm text-muted-foreground">{label}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 bg-muted/20">
                    <OverviewMap points={points} onSelect={onSelect} />
                </div>
                <aside className="flex flex-col gap-5 border-t p-5 lg:border-t-0 lg:border-l">
                    <div>
                        <h2 className="font-semibold">{t(pending ? 'workspace.to_review' : 'workspace.overview')}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(pending ? 'workspace.intro' : 'current_comparison')}</p>
                    </div>
                    {pending && (
                        <div className="divide-y">
                            <Button
                                variant="ghost"
                                onClick={() => onStart('geometry')}
                                disabled={!derivations}
                                className="h-auto w-full justify-start gap-3 rounded-none py-4 text-left whitespace-normal"
                            >
                                <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                                <span className="flex-1">{t('workspace.geometry_progress', { completed, total: derivations })}</span>
                                <ChevronRight className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => onStart('identity')}
                                disabled={!identities}
                                className="h-auto w-full justify-start gap-3 rounded-none py-4 text-left whitespace-normal"
                            >
                                <Link2 className="size-4 shrink-0" aria-hidden="true" />
                                <span className="flex-1">{t('workspace.identity_remaining', { count: identities })}</span>
                                <ChevronRight className="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                    {pending && derivations > 0 && (
                        <Progress
                            value={(completed / derivations) * 100}
                            aria-label={t('workspace.geometry_tasks')}
                            aria-valuetext={t('workspace.geometry_progress', { completed, total: derivations })}
                        />
                    )}
                    <div className="mt-auto space-y-3">
                        {pending && (
                            <Button
                                className="w-full"
                                onClick={() => (derivations > completed ? onStart('geometry') : identities ? onStart('identity') : onDecision())}
                            >
                                {t(derivations > completed || identities ? 'workspace.start' : 'make_decision')}
                                <ArrowRight aria-hidden="true" />
                            </Button>
                        )}
                        <Button variant="outline" className="w-full" onClick={onRecords}>
                            {t('all_records')}
                        </Button>
                    </div>
                </aside>
            </div>
        </section>
    );
}

function OverviewMap({ points, onSelect }: { points: MapPoint[]; onSelect: (id: string) => void }) {
    const { t } = useTranslation('backend/imports');
    const [style, setStyle] = useState<MapStyle>('streets');
    const [fit, setFit] = useState(0);
    if (!points.length)
        return (
            <p className="p-6 text-sm text-muted-foreground" role="status">
                {t('no_map_locations')}
            </p>
        );
    return (
        <div className="relative">
            <MapToolbar style={style} onStyleChange={setStyle} onFit={() => setFit((value) => value + 1)} />
            <MapContainer
                center={[points[0].point.latitude, points[0].point.longitude]}
                zoom={12}
                scrollWheelZoom={false}
                zoomControl={false}
                className="parking-discovery-map relative z-0 h-[28rem] w-full xl:h-[34rem]"
            >
                <ReviewTiles style={style} />
                <ZoomControl position="bottomright" />
                <ScaleControl position="bottomleft" imperial={false} />
                <PointBounds points={points} fit={fit} />
                {points.map((point) => (
                    <CircleMarker
                        key={`${point.status}:${point.external_id}`}
                        center={[point.point.latitude, point.point.longitude]}
                        radius={point.review_required ? 6 : 3}
                        pathOptions={{
                            color: point.review_required ? '#d97706' : point.status === 'missing' ? '#64748b' : '#2563eb',
                            fillOpacity: 0.8,
                            weight: 1,
                        }}
                        eventHandlers={{ click: () => onSelect(point.external_id) }}
                    >
                        <Tooltip>
                            {point.title} · {point.external_id}
                        </Tooltip>
                    </CircleMarker>
                ))}
            </MapContainer>
            <div className="flex flex-wrap gap-4 border-t bg-background px-4 py-3 text-xs">
                <span className="inline-flex items-center gap-2">
                    <MapPin className="size-3 text-blue-600" aria-hidden="true" />
                    {t('workspace.source_records')}
                </span>
                <span className="inline-flex items-center gap-2">
                    <TriangleAlert className="size-3 text-amber-600" aria-hidden="true" />
                    {t('workspace.geometry_tasks')}
                </span>
            </div>
        </div>
    );
}

function PointBounds({ points, fit }: { points: MapPoint[]; fit: number }) {
    const map = useMap();
    useEffect(() => {
        const bounds = latLngBounds(points.map(({ point }) => [point.latitude, point.longitude]));
        map.invalidateSize();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18 });
    }, [map, points, fit]);
    return null;
}

export function MapToolbar({ style, onStyleChange, onFit }: { style: MapStyle; onStyleChange: (style: MapStyle) => void; onFit: () => void }) {
    const { t: tMap } = useTranslation('frontend/map/main');
    const { t } = useTranslation('backend/imports');
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
            <ToggleGroup
                type="single"
                value={style}
                onValueChange={(value) => {
                    if (value === 'streets' || value === 'satellite') onStyleChange(value);
                }}
                variant="outline"
                size="sm"
                aria-label={tMap('controls.layers')}
            >
                <ToggleGroupItem value="streets">
                    <MapIcon className="size-4" aria-hidden />
                    {tMap('controls.streets')}
                </ToggleGroupItem>
                <ToggleGroupItem value="satellite">
                    <Satellite className="size-4" aria-hidden />
                    {tMap('controls.satellite')}
                </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="sm" onClick={onFit}>
                <LocateFixed className="size-4" aria-hidden />
                {t('workspace.fit_map')}
            </Button>
        </div>
    );
}

export function ReviewWorkspace({
    rows,
    delivery,
    token,
    filter,
    reviewedIds,
    onReviewed,
    onFinish,
    page,
    pages,
    total,
    query,
}: {
    rows: Row[];
    delivery: Import;
    token: string;
    filter: string;
    reviewedIds: string[];
    onReviewed: (id: string) => void;
    onFinish: () => void;
    page: number;
    pages: number;
    total: number;
    query: string;
}) {
    const { t } = useTranslation('backend/imports');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const row = rows.find((item) => `${item.status}:${item.external_id}` === selectedId) ?? rows[0];
    const position = row ? rows.indexOf(row) : -1;
    const rowKey = row ? `${row.status}:${row.external_id}` : '';
    const [candidateChoice, setCandidateChoice] = useState({ key: '', id: '' });
    const candidateId = candidateChoice.key === rowKey ? candidateChoice.id : (row?.identity?.facility_id ?? '');
    const editable = delivery.state === 'pending' && !delivery.superseded;
    const next = () => {
        if (position < rows.length - 1) setSelectedId(`${rows[position + 1].status}:${rows[position + 1].external_id}`);
        else if (page < pages) windowNext();
        else onFinish();
    };
    const windowNext = () => routerVisit(show.url(delivery.id), { q: query, filter, page: page + 1 });
    return (
        <section className="overflow-hidden rounded-lg border" aria-label={t('workspace.workspace')}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="font-semibold">
                    {t(
                        filter === 'geometry'
                            ? 'workspace.geometry_tasks'
                            : filter === 'identity'
                              ? 'workspace.identity_tasks'
                              : 'navigation.locations',
                    )}
                </h2>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                    {t('workspace.position', { position: row ? (page - 1) * 25 + position + 1 : 0, total })}
                </span>
            </div>
            {row ? (
                <div className="grid min-w-0 xl:grid-cols-[13rem_minmax(0,1fr)_21rem]">
                    <nav className="max-h-48 overflow-y-auto border-b xl:max-h-[38rem] xl:border-r xl:border-b-0" aria-label={t('workspace.queue')}>
                        {rows.map((item) => (
                            <Button
                                variant="ghost"
                                key={`${item.status}:${item.external_id}`}
                                aria-current={item === row ? 'true' : undefined}
                                onClick={() => setSelectedId(`${item.status}:${item.external_id}`)}
                                className={cn(
                                    'h-auto w-full justify-start gap-2 rounded-none border-b px-4 py-3 text-left whitespace-normal',
                                    item === row && 'bg-blue-50 dark:bg-blue-950/30',
                                )}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{claimTitle(item.after ?? item.before) ?? t('unknown_street')}</span>
                                    <span className="mt-1 block truncate text-xs text-muted-foreground">{item.external_id}</span>
                                </span>
                                {reviewedIds.includes(item.external_id) && (
                                    <Check className="size-4 shrink-0 text-green-600" aria-label={t('workspace.checked')} />
                                )}
                            </Button>
                        ))}
                    </nav>
                    <div className="min-w-0 border-b xl:border-r xl:border-b-0">
                        <ReviewMap row={row} candidateId={candidateId} />
                    </div>
                    <aside className="flex min-w-0 flex-col p-5">
                        <div className="space-y-4 xl:max-h-[29rem] xl:overflow-y-auto">
                            <div>
                                <h3 className="font-semibold">{claimTitle(row.after ?? row.before) ?? t('unknown_street')}</h3>
                                <p className="mt-1 text-xs break-all text-muted-foreground">
                                    {t('record_id')} · {row.external_id}
                                </p>
                            </div>
                            <MissingSourceNotice row={row} />
                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                <dt className="text-muted-foreground">{t('status')}</dt>
                                <dd>{t(`counts.${row.status}`)}</dd>
                                {!(row.after ?? row.before)?.facility_type && (
                                    <>
                                        <dt className="text-muted-foreground">{t('capacity')}</dt>
                                        <dd>{claimCapacity(row.after ?? row.before) ?? t('unknown')}</dd>
                                    </>
                                )}
                            </dl>
                            {row.geometry_derivation && (
                                <div className="space-y-2 border-t pt-4 text-sm">
                                    <p>{t('geometry_help')}</p>
                                    <p className="text-xs text-muted-foreground">{row.geometry_derivation.reason}</p>
                                </div>
                            )}
                            {editable && row.identity && ['review', 'manual'].includes(row.identity.method) && (
                                <IdentityDecision
                                    key={`${row.external_id}-${token}`}
                                    row={row}
                                    delivery={delivery}
                                    token={token}
                                    target={candidateId}
                                    onTargetChange={(id) => setCandidateChoice({ key: rowKey, id })}
                                />
                            )}
                            <Accordion type="single" collapsible className="border-t text-sm">
                                <AccordionItem value="source" className="border-0">
                                    <AccordionTrigger>{t('source_tab')}</AccordionTrigger>
                                    <AccordionContent>
                                        <SourceComparison
                                            row={row}
                                            onShowMap={() =>
                                                document.getElementById('review-map')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                                            }
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                        <div className="mt-auto flex flex-col gap-2 pt-5">
                            {editable && row.geometry_review_required && (
                                <Button
                                    onClick={() => {
                                        onReviewed(row.external_id);
                                        next();
                                    }}
                                >
                                    <Check aria-hidden="true" />
                                    {t('workspace.check_next')}
                                </Button>
                            )}
                            {(!editable || !row.geometry_review_required) && (
                                <Button onClick={next}>
                                    {t(position === rows.length - 1 && page === pages ? 'workspace.finish' : 'next')}
                                    <ChevronRight aria-hidden="true" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                disabled={position <= 0}
                                onClick={() => setSelectedId(`${rows[position - 1].status}:${rows[position - 1].external_id}`)}
                            >
                                <ChevronLeft aria-hidden="true" />
                                {t('previous')}
                            </Button>
                        </div>
                    </aside>
                </div>
            ) : (
                <p className="p-8 text-sm text-muted-foreground" role="status">
                    {t('no_matching_records')}
                </p>
            )}
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onFinish}>
                    {t('workspace.overview')}
                </Button>
                <nav aria-label={t('pages')} className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => routerVisit(show.url(delivery.id), { q: query, filter, page: page - 1 })}
                    >
                        {t('previous')}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        {page} / {pages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={windowNext}>
                        {t('next')}
                    </Button>
                </nav>
            </div>
        </section>
    );
}

function routerVisit(url: string, data: Record<string, string | number>) {
    router.get(url, data, { preserveState: true, preserveScroll: true });
}

export function IdentityReview({ row, delivery, token }: { row: Row; delivery: Import; token: string }) {
    const [target, setTarget] = useState(row.identity?.facility_id ?? '');
    return <IdentityDecision row={row} delivery={delivery} token={token} target={target} onTargetChange={setTarget} />;
}

export function IdentityDecision({
    row,
    delivery,
    token,
    target,
    onTargetChange,
}: {
    row: Row;
    delivery: Import;
    token: string;
    target: string;
    onTargetChange: (id: string) => void;
}) {
    const { t } = useTranslation('backend/imports');
    const identity = row.identity!;
    const candidate = identity.candidates.find((item) => item.id === target);
    return (
        <Form {...update.form(delivery.id)} options={{ preserveScroll: true }} className="space-y-3 border-t pt-4 text-sm">
            {({ errors, processing }) => (
                <>
                    <input type="hidden" name="decision" value="resolve_identity" />
                    <input type="hidden" name="external_id" value={row.external_id} />
                    <input type="hidden" name="review_token" value={token} />
                    <p className="font-medium">{t('identity.title')}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{t('identity.hint')}</p>
                    <div className="space-y-2">
                        <Label htmlFor="identity-target">{t('identity.target')}</Label>
                        <input type="hidden" name="facility_id" value={target} />
                        <Select value={target || 'new'} onValueChange={(value) => onTargetChange(value === 'new' ? '' : value)} disabled={processing}>
                            <SelectTrigger
                                id="identity-target"
                                aria-invalid={!!errors.facility_id}
                                className="text-left [&>span]:block [&>span]:min-w-0 [&>span]:truncate"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">{t('identity.new')}</SelectItem>
                                {identity.candidates.map((candidate) => (
                                    <SelectItem key={candidate.id} value={candidate.id}>
                                        {candidate.name} · {Math.round(candidate.distance_metres)} m
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {candidate?.source && (
                        <dl className="space-y-2 rounded-md bg-muted/40 p-3 text-xs">
                            <dt className="font-medium">{t('workspace.existing')}</dt>
                            <dd>
                                {candidate.name} · {Math.round(candidate.distance_metres)} m
                            </dd>
                            <dt className="text-muted-foreground">{t('record_id')}</dt>
                            <dd className="break-all">{candidate.source.external_id}</dd>
                            {!candidate.source.facility_type && (
                                <>
                                    <dt className="text-muted-foreground">{t('capacity')}</dt>
                                    <dd>{candidate.source.number ?? t('unknown')}</dd>
                                </>
                            )}
                        </dl>
                    )}
                    <Label className="flex-col items-start gap-2">
                        {t('workspace.identity_reason')}
                        <Textarea name="reason" required maxLength={2000} defaultValue={identity.decision?.reason ?? ''} />
                    </Label>
                    {Object.entries(errors).map(([field, message]) => (
                        <InputError key={field} message={message} />
                    ))}
                    <Button type="submit" variant="outline" disabled={processing} className="w-full">
                        {t('identity.save')}
                    </Button>
                </>
            )}
        </Form>
    );
}

export function ReviewMap({ row, candidateId }: { row: Row; candidateId: string }) {
    const { t } = useTranslation('backend/imports');
    const claim = row.after ?? row.before;
    const [style, setStyle] = useState<MapStyle>('streets');
    const [fit, setFit] = useState(0);
    const [layers, setLayers] = useState(['source', 'proposed']);
    const geometries = useMemo(() => reviewGeometries(row, candidateId), [row, candidateId]);
    const candidate = row.identity?.candidates.find((item) => item.id === candidateId);
    if (!claim || !row.point)
        return (
            <p role="status" className="p-6 text-sm text-muted-foreground">
                {t('no_map_locations')}
            </p>
        );
    return (
        <div id="review-map" className="h-full">
            <MapToolbar style={style} onStyleChange={setStyle} onFit={() => setFit((value) => value + 1)} />
            {row.geometry_derivation && (
                <ToggleGroup
                    type="multiple"
                    value={layers}
                    onValueChange={setLayers}
                    variant="outline"
                    size="sm"
                    className="justify-start rounded-none border-b p-2"
                    aria-label={t('geometry_layers')}
                >
                    <ToggleGroupItem value="source">{t('original_geometry')}</ToggleGroupItem>
                    <ToggleGroupItem value="proposed">{t('proposed_geometry')}</ToggleGroupItem>
                </ToggleGroup>
            )}
            <MapContainer
                center={[row.point.latitude, row.point.longitude]}
                zoom={19}
                scrollWheelZoom={false}
                zoomControl={false}
                className="parking-discovery-map relative z-0 h-96 w-full xl:h-[34rem]"
            >
                <ReviewTiles style={style} />
                <ZoomControl position="bottomright" focus={[row.point.latitude, row.point.longitude]} />
                <ScaleControl position="bottomleft" imperial={false} />
                <GeometryBounds geometries={geometries} fit={fit} />
                {layers.includes('source') && claim.geometry.type !== 'Point' && (
                    <GeoJSON
                        key={`source-${JSON.stringify(claim.geometry)}`}
                        data={claim.geometry}
                        style={{
                            color: row.geometry_derivation ? '#f97316' : '#2563eb',
                            dashArray: row.geometry_derivation ? '6 5' : undefined,
                            fillOpacity: 0.1,
                            weight: 3,
                        }}
                    />
                )}
                {layers.includes('proposed') && row.geometry_derivation && (
                    <GeoJSON
                        key={`proposed-${JSON.stringify(row.geometry_derivation.geometry)}`}
                        data={row.geometry_derivation.geometry}
                        style={{ color: '#2563eb', fillOpacity: 0.2, weight: 3 }}
                    />
                )}
                <CircleMarker center={[row.point.latitude, row.point.longitude]} radius={5} pathOptions={{ color: '#2563eb', fillOpacity: 1 }}>
                    <Tooltip>{t('workspace.incoming')}</Tooltip>
                </CircleMarker>
                {[candidate].map((candidate) => {
                    if (!candidate?.source) return null;
                    const geometry = candidate.source.geometry;
                    const label = (
                        <Tooltip>
                            {candidate.name} · {Math.round(candidate.distance_metres)} m · {candidate.id}
                        </Tooltip>
                    );
                    return geometry.type === 'Point' ? (
                        <CircleMarker
                            key={candidate.id}
                            center={[geometry.coordinates[1], geometry.coordinates[0]]}
                            radius={7}
                            pathOptions={{ color: '#d97706', fillOpacity: 0.5, weight: 2 }}
                        >
                            {label}
                        </CircleMarker>
                    ) : (
                        <GeoJSON key={candidate.id} data={geometry} style={{ color: '#d97706', fillOpacity: 0.15, weight: 3 }}>
                            {label}
                        </GeoJSON>
                    );
                })}
            </MapContainer>
            <div className="space-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
                <p>{t(row.geometry_derivation ? 'geometry_legend' : 'map_note')}</p>
                {!!candidate?.source && <p>{t('workspace.candidate_legend')}</p>}
            </div>
        </div>
    );
}

function GeometryBounds({ geometries, fit }: { geometries: Geometry[]; fit: number }) {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        const bounds = latLngBounds([]);
        for (const geometry of geometries) bounds.extend(geoJSON(geometry).getBounds());
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
    }, [map, geometries, fit]);
    return null;
}

export function PublishedNotice({ delivery }: { delivery: Import }) {
    const { t } = useTranslation('backend/imports');
    if (delivery.state !== 'published') return null;
    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/20"
        >
            <Check className="size-5 text-green-700 dark:text-green-400" aria-hidden="true" />
            <div className="flex-1 text-sm">
                <p className="font-semibold">{t('workspace.published')}</p>
                {delivery.reviewed_at && <MunicipalDateTime value={delivery.reviewed_at} />}
            </div>
            <Link href={index()} className="text-sm underline underline-offset-4">
                {t('back')}
            </Link>
        </div>
    );
}
