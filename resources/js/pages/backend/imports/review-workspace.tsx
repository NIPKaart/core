import { index, show, update } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import InputError from '@/components/input-error';
import type { MapStyle } from '@/components/map/map-display-controls';
import ZoomControl from '@/components/map/zoom-control';
import MunicipalDateTime from '@/components/municipal-date-time';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { pinSvg } from '@/lib/pin-svg';
import { cn } from '@/lib/utils';
import type { Page } from '@inertiajs/core';
import { Form, Link, router } from '@inertiajs/react';
import type { Geometry } from 'geojson';
import { divIcon, geoJSON, latLngBounds } from 'leaflet';
import {
    ArrowRight,
    Check,
    ChevronLeft,
    ChevronRight,
    Circle,
    CircleDot,
    Expand,
    Link2,
    LocateFixed,
    Map as MapIcon,
    MapPin,
    Satellite,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, GeoJSON, MapContainer, Marker, ScaleControl, Tooltip, useMap } from 'react-leaflet';
import type { Import } from './index';
import ReviewTiles from './review-map-tiles';
import SourceComparison, { MissingSourceNotice } from './source-comparison';
import { claimCapacity, claimTitle, reviewGeometries, type Row } from './source-record';

export type MapPoint = {
    external_id: string;
    selectionKey?: string;
    title: string;
    status: Row['status'];
    point: { latitude: number; longitude: number };
    review_required: boolean;
};

export function DeliverySummary({ recordCount, derivations, identities }: { recordCount: number; derivations: number; identities: number }) {
    const { t, i18n } = useTranslation('backend/imports');
    return (
        <div className="grid shrink-0 grid-cols-3 divide-x rounded-xl border bg-background">
            {[
                { icon: MapPin, count: recordCount, label: t('workspace.source_records') },
                { icon: TriangleAlert, count: derivations, label: t('workspace.geometry_tasks') },
                { icon: Link2, count: identities, label: t('workspace.identity_tasks') },
            ].map(({ icon: Icon, count, label }) => (
                <div key={label} className="flex items-center gap-3 px-3 py-3 sm:px-5">
                    <Icon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                    <div>
                        <p className="text-xl font-semibold tabular-nums">{count.toLocaleString(i18n.language)}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

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
    counts,
    loading = false,
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
    counts?: Partial<Record<Row['status'], number>>;
    loading?: boolean;
}) {
    const { t } = useTranslation('backend/imports');
    const pending = delivery.state === 'pending' && !delivery.superseded;
    return (
        <section
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden"
            aria-label={t('workspace.overview')}
            aria-busy={loading}
        >
            <DeliverySummary recordCount={recordCount} derivations={derivations} identities={identities} />
            <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="h-[36svh] min-h-0 lg:h-auto">
                    <OverviewMap points={points} onSelect={onSelect} />
                </div>
                <aside className="flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
                    <div className="shrink-0 border-b px-5 py-4">
                        <h2 className="font-semibold">{t(pending ? 'workspace.to_review' : 'workspace.overview')}</h2>
                    </div>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-2">
                        {loading ? (
                            <p role="status" className="animate-pulse py-4 text-sm text-muted-foreground">
                                {t('workspace.loading')}
                            </p>
                        ) : (
                            <>
                                {pending && (
                                    <div className="divide-y">
                                        {derivations > 0 && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => onStart('geometry')}
                                                className="h-auto w-full justify-start gap-3 rounded-none px-0 py-4 text-left whitespace-normal"
                                            >
                                                <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
                                                <span className="flex-1">{t('workspace.geometry_progress', { completed, total: derivations })}</span>
                                                <ChevronRight className="size-4 shrink-0" aria-hidden />
                                            </Button>
                                        )}
                                        {identities > 0 && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => onStart('identity')}
                                                className="h-auto w-full justify-start gap-3 rounded-none px-0 py-4 text-left whitespace-normal"
                                            >
                                                <Link2 className="size-4 shrink-0" aria-hidden />
                                                <span className="flex-1">{t('workspace.identity_remaining', { count: identities })}</span>
                                                <ChevronRight className="size-4 shrink-0" aria-hidden />
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {pending && derivations > 0 && (
                                    <Progress
                                        value={(completed / derivations) * 100}
                                        aria-label={t('workspace.geometry_tasks')}
                                        aria-valuetext={t('workspace.geometry_progress', { completed, total: derivations })}
                                    />
                                )}
                                {counts && (['new', 'changed', 'missing', 'conflict'] as const).some((status) => (counts[status] ?? 0) > 0) && (
                                    <div className="border-t pt-3">
                                        <h3 className="mb-1 text-xs font-medium text-muted-foreground">{t('workspace.changes')}</h3>
                                        {(['new', 'changed', 'missing', 'conflict'] as const)
                                            .filter((status) => (counts[status] ?? 0) > 0)
                                            .map((status) => (
                                                <Button
                                                    key={status}
                                                    variant="ghost"
                                                    className="h-10 w-full justify-between px-0 text-sm"
                                                    onClick={() => onStart(status)}
                                                >
                                                    <span>{t(`counts.${status}`)}</span>
                                                    <span className="flex items-center gap-2 text-muted-foreground">
                                                        {counts[status]?.toLocaleString()}
                                                        <ChevronRight className="size-4" />
                                                    </span>
                                                </Button>
                                            ))}
                                    </div>
                                )}
                                {delivery.review_reason && <p className="py-3 text-sm whitespace-pre-wrap">{delivery.review_reason}</p>}
                            </>
                        )}
                    </div>
                    <div className="shrink-0 space-y-2 border-t p-4">
                        {pending && (
                            <Button
                                className="w-full"
                                disabled={loading}
                                onClick={() => (derivations > completed ? onStart('geometry') : identities ? onStart('identity') : onDecision())}
                            >
                                {t(derivations > completed || identities ? 'workspace.start' : 'make_decision')}
                                <ArrowRight aria-hidden />
                            </Button>
                        )}
                        <Button variant="outline" className="w-full" disabled={loading} onClick={onRecords}>
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
        <div className="relative h-full">
            <MapToolbar style={style} onStyleChange={setStyle} onFit={() => setFit((value) => value + 1)} />
            <MapContainer
                center={[points[0].point.latitude, points[0].point.longitude]}
                zoom={12}
                scrollWheelZoom={false}
                zoomControl={false}
                className="parking-discovery-map relative z-0 h-full w-full"
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
                        eventHandlers={{ click: () => onSelect(point.selectionKey ?? point.external_id) }}
                    >
                        <Tooltip>
                            {point.title} · {point.external_id}
                        </Tooltip>
                    </CircleMarker>
                ))}
            </MapContainer>
            <div className="absolute right-20 bottom-3 z-400 hidden max-w-sm flex-wrap gap-3 rounded-lg bg-background/95 px-3 py-2 text-xs lg:flex">
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
        if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [32, 64], paddingBottomRight: [72, 48], maxZoom: 18 });
    }, [map, points, fit]);
    return null;
}

export function MapToolbar({
    style,
    onStyleChange,
    onFit,
    onOverview,
    disabled = false,
}: {
    style: MapStyle;
    onStyleChange: (style: MapStyle) => void;
    onFit: () => void;
    onOverview?: () => void;
    disabled?: boolean;
}) {
    const { t: tMap } = useTranslation('frontend/map/main');
    const { t } = useTranslation('backend/imports');
    return (
        <div className="pointer-events-none absolute inset-0 z-500">
            {onOverview && (
                <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={onOverview}
                    className="pointer-events-auto absolute top-3 left-3 h-11 rounded-xl border-0 bg-background shadow-md lg:top-4 lg:left-4"
                >
                    <Expand className="size-4" />
                    {t('workspace.whole_set')}
                </Button>
            )}
            <ToggleGroup
                type="single"
                value={style}
                onValueChange={(value) => {
                    if (value === 'streets' || value === 'satellite') onStyleChange(value);
                }}
                className="pointer-events-auto absolute top-3 right-3 gap-1 rounded-xl bg-background p-1 shadow-[0_2px_10px_rgba(0,0,0,0.14)] lg:top-4 lg:right-4"
                aria-label={tMap('controls.layers')}
            >
                <ToggleGroupItem
                    value="streets"
                    className="h-9 rounded-[9px] px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                    <MapIcon className="size-4" aria-hidden />
                    {tMap('controls.streets')}
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="satellite"
                    className="h-9 rounded-[9px] px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                    <Satellite className="size-4" aria-hidden />
                    {tMap('controls.satellite')}
                </ToggleGroupItem>
            </ToggleGroup>
            <Button
                variant="outline"
                size="icon"
                className="pointer-events-auto absolute right-3 bottom-32 size-11 rounded-xl border-0 bg-background shadow-[0_2px_10px_rgba(0,0,0,0.14)] lg:right-4"
                aria-label={t('workspace.fit_map')}
                onClick={onFit}
            >
                <LocateFixed className="size-4" aria-hidden />
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
    summary,
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
    summary?: ReactNode;
}) {
    const { t } = useTranslation('backend/imports');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const row = rows.find((item) => `${item.status}:${item.external_id}` === selectedId) ?? rows[0];
    const position = row ? rows.indexOf(row) : -1;
    const rowKey = row ? `${row.status}:${row.external_id}` : '';
    const [saving, setSaving] = useState(false);
    const [queueOpen, setQueueOpen] = useState(false);
    const [candidateChoice, setCandidateChoice] = useState({ key: '', id: '' });
    const candidateId = candidateChoice.key === rowKey ? candidateChoice.id : (row?.identity?.facility_id ?? row?.identity?.candidates[0]?.id ?? '');
    const editable = delivery.state === 'pending' && !delivery.superseded;
    const identityFormId = `delivery-identity-${delivery.id}`;
    const needsIdentity = editable && row?.identity && ['review', 'manual'].includes(row.identity.method);
    const next = () => {
        if (saving) return;
        if (position < rows.length - 1) setSelectedId(`${rows[position + 1].status}:${rows[position + 1].external_id}`);
        else if (page < pages) windowNext();
        else onFinish();
    };
    const windowNext = () => routerVisit(show.url(delivery.id), { q: query, filter, page: page + 1 });
    const saved = (response: Page) => {
        const updated = (response.props.review as { rows: Row[] }).rows;
        const successor = rows
            .slice(position + 1)
            .find((item) => updated.some((other) => other.status === item.status && other.external_id === item.external_id));
        if (successor) setSelectedId(`${successor.status}:${successor.external_id}`);
        else if (filter === 'identity') {
            if (updated.length) setSelectedId(`${updated[0].status}:${updated[0].external_id}`);
            else onFinish();
        } else if (page < pages) windowNext();
        else onFinish();
    };
    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden" aria-label={t('workspace.workspace')}>
            {summary}
            <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_24rem]">
                {row && (
                    <div className="h-[36svh] min-h-0 lg:h-auto">
                        <div className={queueOpen ? 'hidden' : 'h-full'}>
                            <ReviewMap row={row} candidateId={candidateId} workspace onOverview={onFinish} disabled={saving} />
                        </div>
                        {queueOpen && (
                            <OverviewMap
                                points={rows.flatMap((item) =>
                                    item.point
                                        ? [
                                              {
                                                  external_id: item.external_id,
                                                  selectionKey: `${item.status}:${item.external_id}`,
                                                  title: claimTitle(item.after ?? item.before) ?? t('unknown_street'),
                                                  status: item.status,
                                                  point: item.point,
                                                  review_required: !!item.geometry_review_required,
                                              },
                                          ]
                                        : [],
                                )}
                                onSelect={(key) => {
                                    setSelectedId(key);
                                    setQueueOpen(false);
                                }}
                            />
                        )}
                    </div>
                )}
                <aside className="flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
                    <nav
                        className="flex h-[52px] shrink-0 items-center gap-1 border-b pr-3 pl-2"
                        aria-label={t('workspace.position', { position: row ? (page - 1) * 25 + position + 1 : 0, total })}
                    >
                        <Button
                            variant="ghost"
                            disabled={saving}
                            aria-label={t(queueOpen ? 'workspace.overview' : 'workspace.to_review')}
                            className="h-9 max-w-[55%] min-w-0 gap-1 px-2"
                            onClick={() => (queueOpen ? onFinish() : setQueueOpen(true))}
                        >
                            <ChevronLeft className="size-4" />
                            <span className="truncate">{t(queueOpen ? 'workspace.overview' : 'workspace.to_review')}</span>
                        </Button>
                        <span className="flex-1 text-center text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
                            {t('workspace.position', { position: row ? (page - 1) * 25 + position + 1 : 0, total })}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('previous')}
                            disabled={saving || position <= 0}
                            onClick={() => setSelectedId(`${rows[position - 1].status}:${rows[position - 1].external_id}`)}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t('next')} disabled={saving} onClick={next}>
                            <ChevronRight className="size-4" />
                        </Button>
                    </nav>
                    {row ? (
                        queueOpen ? (
                            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label={t('workspace.queue')}>
                                {rows.map((item) => (
                                    <Button
                                        variant="ghost"
                                        key={`${item.status}:${item.external_id}`}
                                        aria-current={item === row ? 'true' : undefined}
                                        onClick={() => {
                                            setSelectedId(`${item.status}:${item.external_id}`);
                                            setQueueOpen(false);
                                        }}
                                        className={cn(
                                            'h-auto w-full justify-start gap-2 rounded-none border-b px-4 py-3 text-left whitespace-normal',
                                            item === row && 'bg-blue-50 dark:bg-blue-950/30',
                                        )}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">
                                                {claimTitle(item.after ?? item.before) ?? t('unknown_street')}
                                            </span>
                                            <span className="mt-1 block truncate text-xs text-muted-foreground">{item.external_id}</span>
                                        </span>
                                        {reviewedIds.includes(item.external_id) && (
                                            <Check className="size-4 shrink-0 text-green-600" aria-label={t('workspace.checked')} />
                                        )}
                                    </Button>
                                ))}
                            </nav>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col">
                                <div className="min-h-0 flex-1 [scrollbar-width:thin] space-y-4 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">
                                    <div>
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <h3 className="text-lg font-semibold tracking-tight">
                                                {claimTitle(row.after ?? row.before) ?? t('unknown_street')}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    needsIdentity
                                                        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                                                        : undefined
                                                }
                                            >
                                                {t(row.identity?.method === 'review' ? 'workspace.uncertain_link' : `counts.${row.status}`)}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs break-all text-muted-foreground">
                                            {t('record_id')} · {row.external_id}
                                        </p>
                                    </div>
                                    <MissingSourceNotice row={row} />
                                    {!needsIdentity && (
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
                                    )}
                                    {row.geometry_derivation && (
                                        <div className="space-y-2 border-t pt-4 text-sm">
                                            <p className="text-xs text-muted-foreground">{row.geometry_derivation.reason}</p>
                                        </div>
                                    )}
                                    {needsIdentity && (
                                        <IdentityDecision
                                            formId={identityFormId}
                                            onSaved={saved}
                                            onBusyChange={setSaving}
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
                                                {row.geometry_derivation && (
                                                    <p className="mb-3 text-xs text-muted-foreground">{t('geometry_help')}</p>
                                                )}
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
                                <div className="shrink-0 space-y-2 border-t p-4">
                                    {needsIdentity && (
                                        <>
                                            <Button type="submit" form={identityFormId} disabled={saving} className="w-full">
                                                {t(saving ? 'saving' : 'workspace.save_next')}
                                                <ArrowRight className="size-4" />
                                            </Button>
                                            <Button variant="outline" disabled={saving} onClick={next} className="w-full">
                                                {t('workspace.skip')}
                                            </Button>
                                        </>
                                    )}

                                    {!needsIdentity && editable && row.geometry_review_required && (
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
                                    {!needsIdentity && (!editable || !row.geometry_review_required) && (
                                        <Button onClick={next}>
                                            {t(position === rows.length - 1 && page === pages ? 'workspace.finish' : 'next')}
                                            <ChevronRight aria-hidden="true" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    ) : (
                        <p className="p-8 text-sm text-muted-foreground" role="status">
                            {t('no_matching_records')}
                        </p>
                    )}
                    {queueOpen && (
                        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2">
                            <Button variant="ghost" size="sm" onClick={onFinish}>
                                {t('workspace.overview')}
                            </Button>
                            {pages > 1 && (
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
                            )}
                        </div>
                    )}
                </aside>
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
    formId,
    onSaved,
    onBusyChange,
}: {
    row: Row;
    delivery: Import;
    token: string;
    target: string;
    onTargetChange: (id: string) => void;
    formId?: string;
    onSaved?: (page: Page) => void;
    onBusyChange?: (saving: boolean) => void;
}) {
    const { t } = useTranslation('backend/imports');
    const identity = row.identity!;
    const candidate = identity.candidates.find((item) => item.id === target);
    return (
        <Form
            id={formId}
            {...update.form(delivery.id)}
            options={{ preserveScroll: true }}
            onSuccess={onSaved}
            onStart={() => onBusyChange?.(true)}
            onFinish={() => onBusyChange?.(false)}
            className="space-y-4 text-sm"
        >
            {({ errors, processing }) => (
                <>
                    <input type="hidden" name="decision" value="resolve_identity" />
                    <input type="hidden" name="external_id" value={row.external_id} />
                    <input type="hidden" name="review_token" value={token} />
                    {candidate?.source && (
                        <div className="space-y-3">
                            <table className="w-full table-fixed text-left text-xs">
                                <caption className="sr-only">{t('identity.title')}</caption>
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="w-1/4 p-2" />
                                        <th className="p-2 font-medium" scope="col">
                                            {t('workspace.source')}
                                        </th>
                                        <th className="p-2 font-medium" scope="col">
                                            {t('workspace.existing')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claimTitle(row.after ?? row.before) !== candidate.name && (
                                        <tr className="border-b">
                                            <th scope="row" className="py-3 font-normal text-muted-foreground">
                                                {t('workspace.location')}
                                            </th>
                                            <td className="p-2 break-words">{claimTitle(row.after ?? row.before) ?? t('unknown')}</td>
                                            <td className="p-2 break-words">{candidate.name}</td>
                                        </tr>
                                    )}
                                    {!candidate.source.facility_type && (
                                        <tr className="border-b">
                                            <th scope="row" className="py-3 font-normal text-muted-foreground">
                                                {t('workspace.capacity')}
                                            </th>
                                            <td className="p-2">{claimCapacity(row.after ?? row.before) ?? t('unknown')}</td>
                                            <td className="p-2">{claimCapacity(candidate.source) ?? t('unknown')}</td>
                                        </tr>
                                    )}
                                    <tr className="border-b">
                                        <th scope="row" className="py-3 font-normal text-muted-foreground">
                                            {t('record_id')}
                                        </th>
                                        <td className="p-2 break-all">{row.external_id}</td>
                                        <td className="p-2 break-all">{candidate.source.external_id}</td>
                                    </tr>
                                </tbody>
                            </table>
                            {candidate.same_type === false && (
                                <Badge variant="outline" className="border-amber-200 text-amber-800 dark:border-amber-800 dark:text-amber-200">
                                    {t('workspace.type_differs')}
                                </Badge>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{t('workspace.distance')}</span>
                                <span>{Math.round(candidate.distance_metres)} m</span>
                            </div>
                        </div>
                    )}
                    <input type="hidden" name="facility_id" value={target} />
                    <ToggleGroup
                        type="single"
                        value={target ? 'existing' : 'new'}
                        disabled={processing}
                        onValueChange={(value) => {
                            if (value === 'new') onTargetChange('');
                            else if (value === 'existing') onTargetChange(identity.facility_id ?? identity.candidates[0]?.id ?? '');
                        }}
                        variant="outline"
                        className="grid w-full grid-cols-2"
                        aria-label={t('identity.target')}
                    >
                        <ToggleGroupItem value="existing" disabled={!identity.candidates.length} className="px-2 text-xs">
                            {target ? <CircleDot className="size-3.5" /> : <Circle className="size-3.5" />}
                            {t('workspace.existing')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="new" className="px-2 text-xs">
                            {!target ? <CircleDot className="size-3.5" /> : <Circle className="size-3.5" />}
                            {t('workspace.new_location')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                    {target && identity.candidates.length > 1 && (
                        <Select value={target} onValueChange={onTargetChange} disabled={processing}>
                            <SelectTrigger
                                className="text-left [&>span]:block [&>span]:min-w-0 [&>span]:truncate"
                                aria-label={t('identity.target')}
                                aria-invalid={!!errors.facility_id}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {identity.candidates.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name} · {Math.round(item.distance_metres)} m
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Label htmlFor={`${formId ?? 'identity'}-reason`} className="flex-col items-start gap-2">
                        <span>
                            {t('workspace.reason')}{' '}
                            <span aria-hidden className="text-destructive">
                                *
                            </span>
                        </span>
                        <Textarea
                            id={`${formId ?? 'identity'}-reason`}
                            name="reason"
                            aria-invalid={!!errors.reason}
                            aria-describedby={errors.reason ? `${formId ?? 'identity'}-reason-error` : undefined}
                            required
                            rows={2}
                            maxLength={2000}
                            defaultValue={identity.decision?.reason ?? ''}
                        />
                    </Label>
                    {Object.entries(errors).map(([field, message]) => (
                        <InputError key={field} id={`${formId ?? 'identity'}-${field}-error`} message={message} />
                    ))}
                    {!formId && (
                        <Button type="submit" variant="outline" disabled={processing} className="w-full">
                            {t('identity.save')}
                        </Button>
                    )}
                </>
            )}
        </Form>
    );
}

export function ReviewMap({
    row,
    candidateId,
    workspace = false,
    onOverview,
    disabled,
}: {
    row: Row;
    candidateId: string;
    workspace?: boolean;
    onOverview?: () => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation('backend/imports');
    const claim = row.after ?? row.before;
    const [style, setStyle] = useState<MapStyle>(workspace ? 'satellite' : 'streets');
    const [fit, setFit] = useState(0);
    const [layers, setLayers] = useState(['source', 'proposed']);
    const geometries = useMemo(() => reviewGeometries(row, candidateId), [row, candidateId]);
    const candidate = row.identity?.candidates.find((item) => item.id === candidateId);
    const icon = useMemo(
        () =>
            divIcon({
                html: pinSvg(!!claim?.facility_type, null),
                className: 'drop-shadow-[0_0_3px_white]',
                iconSize: [36, 48],
                iconAnchor: [18, 46],
            }),
        [claim?.facility_type],
    );
    if (!claim || !row.point)
        return (
            <p role="status" className="p-6 text-sm text-muted-foreground">
                {t('no_map_locations')}
            </p>
        );
    return (
        <div id="review-map" className={cn('relative', workspace ? 'h-full' : 'h-96 lg:h-[34rem]')}>
            <MapToolbar
                style={style}
                onStyleChange={setStyle}
                onFit={() => setFit((value) => value + 1)}
                onOverview={onOverview}
                disabled={disabled}
            />
            {row.geometry_derivation && (
                <ToggleGroup
                    type="multiple"
                    value={layers}
                    onValueChange={setLayers}
                    variant="outline"
                    size="sm"
                    className="absolute top-16 right-3 z-500 flex-wrap justify-end rounded-xl bg-background p-1 shadow-md lg:right-4"
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
                className="parking-discovery-map relative z-0 h-full w-full"
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
                <Marker
                    position={[row.point.latitude, row.point.longitude]}
                    icon={icon}
                    title={t('workspace.incoming')}
                    alt={t('workspace.incoming')}
                >
                    <Tooltip>{t('workspace.incoming')}</Tooltip>
                </Marker>
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
            {!!candidate?.source && (
                <div className="absolute right-20 bottom-3 z-400 flex max-w-[calc(100%-6rem)] flex-wrap gap-3 rounded-lg bg-background/95 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-blue-600" />
                        {t('workspace.incoming')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-600" />
                        {t('workspace.existing')}
                    </span>
                </div>
            )}
        </div>
    );
}

function GeometryBounds({ geometries, fit }: { geometries: Geometry[]; fit: number }) {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        const bounds = latLngBounds([]);
        for (const geometry of geometries) bounds.extend(geoJSON(geometry).getBounds());
        if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [40, 112], paddingBottomRight: [72, 64], maxZoom: 20 });
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
