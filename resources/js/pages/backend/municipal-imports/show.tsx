import { index, show, update } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import MunicipalDateTime from '@/components/municipal-date-time';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import type { MultiPolygon, Polygon } from 'geojson';
import { geoJSON, latLngBounds } from 'leaflet';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Dataset, Import } from './index';
import SourceComparison, { MissingSourceNotice } from './source-comparison';

export type Claim = {
    source_updated_at?: string | null;
    external_id: string;
    street: string | null;
    number: number | null;
    geometry: Polygon;
    source_attributes: Record<string, unknown>;
};
type Derivation = { geometry: Polygon | MultiPolygon; reason: string; method: string; engine: string };
export type Row = {
    external_id: string;
    status: string;
    fields: string[];
    conflicts: string[];
    before: Claim | null;
    after: Claim | null;
    current: Record<string, unknown> | null;
    geometry_derivation?: Derivation | null;
    geometry_review_required?: boolean;
    previous_geometry_derivation?: Derivation | null;
    point?: { latitude: number; longitude: number };
};
type Props = {
    times: Record<'fetched_at' | 'received_at' | 'validated_at' | 'staged_at' | 'published_at', string | null>;
    import: Import;
    dataset: Dataset;
    municipalityName: string;
    review: { derivations: number; counts: Record<string, number>; blockers: string[]; rows: Row[]; token: string };
    page: number;
    pages: number;
    total: number;
    filters: { q: string; filter: string };
};

export default function Show({ import: delivery, dataset, municipalityName, review, page, pages, filters, times }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    const [showComparisonMap, setShowComparisonMap] = useState(false);
    const [geometryReviewedForToken, setGeometryReviewedForToken] = useState<string | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<Row | null>(null);
    const selectedIndex = review.rows.findIndex((row) => row.external_id === selectedRecord?.external_id);
    const recordTrigger = useRef<HTMLElement | null>(null);
    const columns: ColumnDef<Row>[] = [
        {
            id: 'street',
            header: t('fields.street'),
            cell: ({ row: { original: row } }) => (
                <div className="min-w-40 py-1">
                    <span className="font-medium">{row.after?.street ?? row.before?.street ?? t('unknown_street')}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{row.external_id}</span>
                </div>
            ),
        },
        {
            id: 'capacity',
            accessorFn: (row) => (row.after ?? row.before)?.number,
            header: t('capacity'),
            cell: ({ getValue }) => getValue<number | null>() ?? t('unknown'),
        },
        {
            accessorKey: 'status',
            header: t('status'),
            cell: ({ row }) => (
                <div className="max-w-64 space-y-1">
                    <Badge variant={row.original.status === 'conflict' ? 'destructive' : 'outline'}>{t(`counts.${row.original.status}`)}</Badge>
                    {row.original.fields.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {row.original.fields.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
                        </p>
                    )}
                </div>
            ),
        },
        {
            id: 'geometry',
            header: t('fields.geometry'),
            accessorFn: (row) => (row.geometry_derivation ? t('geometry_review') : ''),
            cell: ({ row }) =>
                row.original.geometry_derivation ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300">
                        <TriangleAlert aria-hidden="true" />
                        {t(delivery.state === 'pending' && row.original.geometry_review_required ? 'geometry_review' : 'derived')}
                    </Badge>
                ) : (
                    '—'
                ),
        },
    ];
    return (
        <AppLayout
            breadcrumbs={[
                { title: t('title'), href: index() },
                { title: `${municipalityName} · ${t('delivery_number', { number: delivery.id })}`, href: show(delivery.id) },
            ]}
        >
            <Head title={`${t('review')} #${delivery.id}`} />
            <div className="flex w-full min-w-0 flex-col gap-6 px-4 py-6 sm:px-6">
                <header className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 basis-64 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    {municipalityName} · {t('delivery_number', { number: delivery.id })}
                                </h1>
                                <Badge variant={delivery.state === 'pending' ? 'secondary' : 'outline'}>
                                    {t(`states.${delivery.superseded ? 'superseded' : delivery.state}`)}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{dataset.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {t('retrieved')} <MunicipalDateTime value={delivery.retrieved_at} />
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline">
                                <Link href={index({ query: { tab: 'deliveries', dataset: dataset.id } })}>
                                    <ArrowLeft className="size-4" aria-hidden="true" />
                                    {t('back_to_history')}
                                </Link>
                            </Button>
                            {delivery.state === 'pending' && !delivery.superseded && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant={review.blockers.length ? 'outline' : 'default'}>{t('make_decision')}</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                                        <DialogHeader>
                                            <DialogTitle>{t('decision')}</DialogTitle>
                                            <DialogDescription>{t('decision_hint')}</DialogDescription>
                                        </DialogHeader>
                                        <div className="mb-5">
                                            <details className="text-sm text-muted-foreground">
                                                <summary className="w-fit cursor-pointer font-medium">{t('review_guidance')}</summary>
                                                <div className="mt-2 max-w-3xl space-y-2 leading-relaxed">
                                                    <p>{t('restrictions')}</p>
                                                    <p>{t('missing_note')}</p>
                                                </div>
                                            </details>
                                        </div>
                                        {delivery.state === 'pending' && review.blockers.length > 0 && (
                                            <ul
                                                role="alert"
                                                className="mb-4 space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive dark:text-red-300"
                                            >
                                                {review.blockers.map((message) => (
                                                    <li key={message}>{message}</li>
                                                ))}
                                            </ul>
                                        )}

                                        <Form
                                            key={review.token}
                                            {...update.form(delivery.id)}
                                            options={{ preserveScroll: 'errors' }}
                                            className="flex max-w-2xl flex-col gap-4"
                                        >
                                            {({ errors, processing }) => (
                                                <>
                                                    <input type="hidden" name="review_token" value={review.token} />
                                                    <details>
                                                        <summary className="cursor-pointer text-sm font-medium">{t('reason')}</summary>
                                                        <Textarea
                                                            className="mt-3"
                                                            aria-label={t('reason')}
                                                            id="reason"
                                                            name="reason"
                                                            maxLength={2000}
                                                            rows={3}
                                                            placeholder={t('reason_placeholder')}
                                                            aria-invalid={!!errors.reason}
                                                            aria-describedby={errors.reason ? 'reason-error' : undefined}
                                                        />
                                                    </details>
                                                    {review.derivations > 0 && (
                                                        <Label className="flex items-start gap-3 rounded-lg border bg-background p-4 leading-relaxed">
                                                            <input
                                                                type="checkbox"
                                                                name="geometry_reviewed"
                                                                checked={geometryReviewedForToken === review.token}
                                                                onChange={(event) =>
                                                                    setGeometryReviewedForToken(event.target.checked ? review.token : null)
                                                                }
                                                                value="1"
                                                                aria-invalid={!!errors.geometry_reviewed}
                                                                aria-describedby={errors.geometry_reviewed ? 'geometry_reviewed-error' : undefined}
                                                                className="mt-1 size-4 shrink-0 accent-primary"
                                                            />
                                                            <span>{t('geometry_confirm', { count: review.derivations })}</span>
                                                        </Label>
                                                    )}
                                                    {Object.entries(errors).map(([field, message]) => (
                                                        <InputError key={field} id={`${field}-error`} message={message} />
                                                    ))}
                                                    <div className="flex flex-wrap gap-3">
                                                        <Button
                                                            type="submit"
                                                            name="decision"
                                                            value="publish"
                                                            disabled={
                                                                processing ||
                                                                review.blockers.length > 0 ||
                                                                (review.derivations > 0 && geometryReviewedForToken !== review.token)
                                                            }
                                                        >
                                                            {processing ? t('saving') : t('publish')}
                                                        </Button>
                                                        <Button type="submit" name="decision" value="reject" variant="outline" disabled={processing}>
                                                            {t('reject')}
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </Form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </header>
                {delivery.superseded ? (
                    <section role="status" className="rounded-xl border bg-muted/30 p-5">
                        <h2 className="font-semibold">{t('superseded_title')}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{t('superseded_hint')}</p>
                    </section>
                ) : delivery.state === 'pending' && review.blockers.length > 0 ? (
                    <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                        <h2 className="font-semibold">{t('publication_blocked')}</h2>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                            {review.blockers.map((message) => (
                                <li key={message}>{message}</li>
                            ))}
                        </ul>
                    </section>
                ) : null}
                {delivery.state === 'pending' && review.derivations > 0 && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                    >
                        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
                            <div>
                                <p className="font-semibold">{t('attention')}</p>
                                <p className="mt-1 leading-relaxed">{t('derivations_notice', { count: review.derivations })}</p>
                            </div>
                            <Link
                                className="inline-flex font-medium underline underline-offset-4"
                                href={show(delivery.id, { query: { filter: 'geometry' } })}
                                preserveState
                                preserveScroll
                            >
                                {t('review_geometries')}
                            </Link>
                        </div>
                    </div>
                )}

                {delivery.state !== 'pending' && <p className="text-sm text-muted-foreground">{t('current_comparison')}</p>}
                {delivery.review_reason && (
                    <section className="space-y-2 rounded-xl border bg-muted/20 p-5">
                        <h2 className="font-semibold">{t('decision_reason')}</h2>
                        {delivery.reviewed_at && (
                            <p className="text-sm text-muted-foreground">
                                <MunicipalDateTime value={delivery.reviewed_at} />
                            </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{delivery.review_reason}</p>
                    </section>
                )}
                <div>
                    <div className="min-w-0 space-y-4">
                        <section id="records" aria-labelledby="records-heading" className="min-w-0 scroll-mt-6">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 id="records-heading" className="text-lg font-semibold">
                                        {t('navigation.locations')}
                                    </h2>
                                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                        {['new', 'changed', 'missing', 'conflict', 'unchanged']
                                            .map((kind) => [kind, review.counts[kind]] as const)
                                            .filter(([, count]) => count > 0)
                                            .map(([kind, count]) => (
                                                <span key={kind}>
                                                    <span className="font-medium text-foreground tabular-nums">
                                                        {count.toLocaleString(i18n.language)}
                                                    </span>{' '}
                                                    {t(`counts.${kind}`)}
                                                </span>
                                            ))}
                                    </p>
                                </div>
                            </div>
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <Form
                                    action={show.url(delivery.id)}
                                    method="get"
                                    options={{ preserveState: true, preserveScroll: true }}
                                    className="relative min-w-0 basis-full sm:max-w-md sm:flex-1 sm:basis-auto"
                                >
                                    <input type="hidden" name="filter" value={filters.filter} />
                                    <Input
                                        key={filters.q}
                                        className="pl-9"
                                        name="q"
                                        defaultValue={filters.q}
                                        placeholder={t('search_records')}
                                        aria-label={t('search_records')}
                                        maxLength={200}
                                    />
                                    <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden="true" />
                                </Form>
                                <Select
                                    value={filters.filter}
                                    onValueChange={(filter) =>
                                        router.get(show.url(delivery.id), { q: filters.q, filter }, { preserveState: true, preserveScroll: true })
                                    }
                                >
                                    <SelectTrigger aria-label={t('filter_records')} className="w-full min-w-0 flex-1 sm:w-52 sm:flex-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="changes">{t('changes_only')}</SelectItem>
                                        <SelectItem value="all">{t('all_records')}</SelectItem>
                                        <SelectItem value="geometry">
                                            {t('geometry_review')} ({review.derivations})
                                        </SelectItem>
                                        {Object.entries(review.counts).map(([status, count]) => (
                                            <SelectItem key={status} value={status}>
                                                {t(`counts.${status}`)} ({count})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" aria-expanded={showComparisonMap} onClick={() => setShowComparisonMap(!showComparisonMap)}>
                                    {t(showComparisonMap ? 'hide_map' : 'compare_on_map')}
                                </Button>
                            </div>
                            {showComparisonMap && <ChangesMap rows={review.rows} onSelect={setSelectedRecord} />}
                            <DataTable
                                key={`${delivery.id}-${page}`}
                                columns={
                                    review.rows.some((row) => row.geometry_derivation)
                                        ? columns
                                        : columns.filter((column) => column.id !== 'geometry')
                                }
                                enableSorting={false}
                                toolbar={null}
                                emptyState={
                                    <div className="space-y-3 px-4 py-6">
                                        <p className="font-medium">
                                            {t(filters.filter === 'changes' && !filters.q ? 'no_changes_title' : 'no_matching_records')}
                                        </p>
                                        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                                            {t(filters.filter === 'changes' && !filters.q ? 'no_changes' : 'try_other_filter')}
                                        </p>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={show(delivery.id, { query: { filter: 'all' } })} preserveScroll>
                                                {t('all_records')}
                                            </Link>
                                        </Button>
                                    </div>
                                }
                                data={review.rows}
                                onRowClick={(row) => {
                                    recordTrigger.current = document.activeElement as HTMLElement;
                                    setSelectedRecord(row);
                                }}
                            />
                            <Dialog
                                open={selectedRecord !== null}
                                onOpenChange={(open) => {
                                    if (!open) setSelectedRecord(null);
                                }}
                            >
                                <DialogContent
                                    className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[min(64rem,calc(100%-2rem))]"
                                    onCloseAutoFocus={(event) => {
                                        event.preventDefault();
                                        recordTrigger.current?.focus();
                                    }}
                                >
                                    {selectedRecord && (
                                        <>
                                            <div key={selectedRecord.external_id} className="max-h-[calc(92dvh-4.5rem)] overflow-y-auto p-4 sm:p-6">
                                                <RecordDetails key={selectedRecord.external_id} row={selectedRecord} />
                                            </div>
                                            <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 sm:px-6">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={selectedIndex <= 0}
                                                    onClick={() => setSelectedRecord(review.rows[selectedIndex - 1])}
                                                >
                                                    <ChevronLeft aria-hidden="true" />
                                                    {t('previous')}
                                                </Button>
                                                <span className="text-center text-xs text-muted-foreground">
                                                    {t('record_position', { position: selectedIndex + 1, total: review.rows.length })}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={selectedIndex >= review.rows.length - 1}
                                                    onClick={() => setSelectedRecord(review.rows[selectedIndex + 1])}
                                                >
                                                    {t('next')}
                                                    <ChevronRight aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </section>
                        {pages > 1 && (
                            <nav className="flex items-center justify-between gap-4" aria-label={t('pages')}>
                                <Button asChild={page > 1} variant="outline" disabled={page <= 1}>
                                    {page > 1 ? (
                                        <Link href={show(delivery.id, { query: { ...filters, page: page - 1 } })}>{t('previous')}</Link>
                                    ) : (
                                        t('previous')
                                    )}
                                </Button>
                                <span>
                                    {page} / {pages}
                                </span>
                                <Button asChild={page < pages} variant="outline" disabled={page >= pages}>
                                    {page < pages ? (
                                        <Link href={show(delivery.id, { query: { ...filters, page: page + 1 } })}>{t('next')}</Link>
                                    ) : (
                                        t('next')
                                    )}
                                </Button>
                            </nav>
                        )}
                    </div>
                </div>
                <details className="text-sm text-muted-foreground">
                    <summary className="w-fit cursor-pointer hover:text-foreground">{t('timeline')}</summary>
                    <p className="mt-2 text-sm text-muted-foreground">{t('timeline_note')}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(times).map(([key, value]) => (
                            <div key={key}>
                                <dt className="text-xs text-muted-foreground">{t(`times.${key}`)}</dt>
                                <dd className="mt-1 text-sm">{value ? <MunicipalDateTime value={value} /> : t('unknown')}</dd>
                            </div>
                        ))}
                    </dl>
                </details>
            </div>
        </AppLayout>
    );
}

function RecordDetails({ row }: { row: Row }) {
    const { t } = useTranslation('backend/municipal-imports');
    const [showOriginal, setShowOriginal] = useState(true);
    const [showDerived, setShowDerived] = useState(true);
    const mapSource = row.after ?? row.before;
    const hasMap = Boolean(row.point && mapSource);
    const [activeTab, setActiveTab] = useState(
        hasMap && (row.geometry_review_required || row.fields.includes('geometry') || row.status === 'new' || row.status === 'missing')
            ? 'map'
            : 'source',
    );
    return (
        <div className="space-y-5">
            <DialogHeader className="pr-7 text-left">
                <DialogTitle>{row.after?.street ?? row.before?.street ?? t('unknown_street')}</DialogTitle>
                <DialogDescription className="break-all">
                    {row.external_id} · {t(`counts.${row.status}`)}
                </DialogDescription>
            </DialogHeader>
            <MissingSourceNotice row={row} />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
                <TabsList>
                    <TabsTrigger value="map" disabled={!hasMap}>
                        {t('map_tab')}
                    </TabsTrigger>
                    <TabsTrigger value="source">{t('source_tab')}</TabsTrigger>
                </TabsList>
                <TabsContent value="map" className="space-y-4">
                    {row.point && mapSource && (
                        <>
                            {row.geometry_derivation && (
                                <div className="flex flex-wrap items-center gap-2" aria-label={t('geometry_layers')}>
                                    <Button
                                        variant={showOriginal ? 'secondary' : 'outline'}
                                        size="sm"
                                        aria-pressed={showOriginal}
                                        onClick={() => setShowOriginal(!showOriginal)}
                                    >
                                        <span className="w-5 border-t-2 border-dashed border-orange-500" aria-hidden="true" />
                                        {t('original_geometry')}
                                    </Button>
                                    <Button
                                        variant={showDerived ? 'secondary' : 'outline'}
                                        size="sm"
                                        aria-pressed={showDerived}
                                        onClick={() => setShowDerived(!showDerived)}
                                    >
                                        <span className="size-3 rounded-sm border border-sky-500 bg-sky-500/30" aria-hidden="true" />
                                        {t('proposed_geometry')}
                                    </Button>
                                </div>
                            )}
                            <LocationMarkerCard {...row.point} draggable={false} scrollWheelZoom={false}>
                                {showDerived && row.geometry_derivation && (
                                    <GeoJSON data={row.geometry_derivation.geometry} style={{ color: '#38bdf8' }} />
                                )}
                                {showOriginal && <GeoJSON data={mapSource.geometry} style={{ color: '#f97316', dashArray: '8 6', fill: false }} />}
                            </LocationMarkerCard>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">{t('map_note')}</p>
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href={`https://www.google.com/maps?q=&layer=c&cbll=${row.point.latitude},${row.point.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {t('open_street_view')}
                                        <ExternalLink aria-hidden="true" />
                                    </a>
                                </Button>
                            </div>
                            {row.geometry_derivation && (
                                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                                    <div className="min-w-0 space-y-1">
                                        <p className="font-medium">{t('geometry_review')}</p>
                                        <p className="leading-relaxed">{t('geometry_help')}</p>
                                        <p className="text-xs break-words text-muted-foreground">{row.geometry_derivation.reason}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>
                <TabsContent value="source" className="space-y-4 text-sm">
                    {row.geometry_derivation && (
                        <div className="rounded-lg border bg-background p-4">
                            <p className="font-medium">{t('derived')}</p>
                            <p className="text-sm">{t('derived_note')}</p>
                            <details className="mt-2">
                                <summary className="cursor-pointer">{t('derivation_details')}</summary>
                                <pre className="mt-2 max-h-80 overflow-auto text-xs break-all whitespace-pre-wrap">
                                    {JSON.stringify(row.geometry_derivation, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                    {row.fields.length > 0 && (
                        <p className="mt-2">
                            {t('changed_fields')}: {row.fields.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
                        </p>
                    )}
                    {row.conflicts.length > 0 && (
                        <p className="mt-2 text-destructive">
                            {t('protected_fields')}: {row.conflicts.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
                        </p>
                    )}
                    <SourceComparison row={row} onShowMap={() => setActiveTab('map')} />
                    <details className="rounded-lg border p-4">
                        <summary className="cursor-pointer text-muted-foreground">{t('technical_details')}</summary>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            {(['before', 'after'] as const)
                                .filter((side) => row[side])
                                .map((side) => (
                                    <div key={side}>
                                        <h3 className="mb-2 font-medium">{t(side)}</h3>
                                        <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs break-all whitespace-pre-wrap">
                                            {JSON.stringify(row[side], null, 2)}
                                        </pre>
                                    </div>
                                ))}
                        </div>
                        {row.previous_geometry_derivation && (
                            <details className="mt-3">
                                <summary className="cursor-pointer">{t('previous_derivation')}</summary>
                                <pre className="mt-2 max-h-80 overflow-auto text-xs break-all whitespace-pre-wrap">
                                    {JSON.stringify(row.previous_geometry_derivation, null, 2)}
                                </pre>
                            </details>
                        )}
                        {row.current && (
                            <details className="mt-3">
                                <summary className="cursor-pointer">{t('current')}</summary>
                                <pre className="mt-2 overflow-auto text-xs break-all whitespace-pre-wrap">{JSON.stringify(row.current, null, 2)}</pre>
                            </details>
                        )}
                    </details>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export function ChangesMap({ rows, onSelect }: { rows: Row[]; onSelect: (row: Row) => void }) {
    const { t } = useTranslation('backend/municipal-imports');
    const changes = useMemo(() => rows.filter((row) => (row.after ?? row.before)?.geometry), [rows]);
    if (changes.length === 0) {
        return (
            <p role="status" className="mb-4 rounded-md border p-4 text-sm text-muted-foreground">
                {t('no_map_locations')}
            </p>
        );
    }

    return (
        <section className="mb-5 overflow-hidden rounded-xl border" aria-label={t('changes_map')}>
            <div className="space-y-2 p-4">
                <p className="text-sm text-muted-foreground">{t('changes_map_hint')}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {Array.from(new Set(changes.map((row) => row.status))).map((status) => (
                        <span key={status} className="inline-flex items-center gap-2">
                            <span
                                className="size-3 rounded-sm border-2"
                                style={{ borderColor: changeColor(status), borderStyle: status === 'missing' ? 'dashed' : 'solid' }}
                                aria-hidden="true"
                            />
                            {t(`counts.${status}`)}
                        </span>
                    ))}
                </div>
            </div>
            <MapContainer center={[52.37, 4.9]} zoom={13} scrollWheelZoom={false} className="relative z-0 h-72 w-full sm:h-96">
                <TileLayer
                    attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                    url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    maxZoom={22}
                />
                <ChangesMapBounds rows={changes} />
                {changes.map((row) => (
                    <GeoJSON
                        key={row.external_id}
                        data={(row.after ?? row.before)!.geometry}
                        style={{
                            color: changeColor(row.status),
                            weight: 3,
                            fillOpacity: 0.25,
                            dashArray: row.status === 'missing' ? '6 5' : undefined,
                        }}
                        eventHandlers={{ click: () => onSelect(row) }}
                    >
                        <Tooltip permanent direction="top" className="max-w-40 text-center whitespace-normal">
                            <span className="block font-medium">{t(`counts.${row.status}`)}</span>
                            <span className="block text-xs">{row.external_id}</span>
                        </Tooltip>
                    </GeoJSON>
                ))}
            </MapContainer>
            <p className="px-4 py-3 text-sm text-muted-foreground">{t('missing_map_note')}</p>
        </section>
    );
}

function changeColor(status: string): string {
    return status === 'unchanged' ? '#64748b' : status === 'new' ? '#15803d' : status === 'missing' ? '#c2410c' : '#2563eb';
}

function ChangesMapBounds({ rows }: { rows: Row[] }) {
    const map = useMap();
    useEffect(() => {
        const bounds = latLngBounds([]);
        for (const row of rows) {
            bounds.extend(geoJSON((row.after ?? row.before)!.geometry).getBounds());
        }
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 20 });
    }, [map, rows]);
    return null;
}
