import { index, show, update } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import MunicipalDateTime from '@/components/municipal-date-time';
import MunicipalNavigation from '@/components/municipal-navigation';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import type { MultiPolygon, Polygon } from 'geojson';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GeoJSON } from 'react-leaflet';
import type { Dataset, Import } from './index';

type Claim = { external_id: string; street: string | null; number: number | null; geometry: Polygon; source_attributes: Record<string, unknown> };
type Derivation = { geometry: Polygon | MultiPolygon; reason: string; method: string; engine: string };
type Row = {
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
    import: Import;
    dataset: Dataset;
    municipalityName: string;
    review: { derivations: number; counts: Record<string, number>; blockers: string[]; rows: Row[]; token: string };
    page: number;
    pages: number;
    total: number;
    filters: { q: string; filter: string };
};

export default function Show({ import: delivery, dataset, municipalityName, review, page, pages, total, filters }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
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
            <div className="flex w-full min-w-0 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
                <header className="space-y-4">
                    <Link
                        href={index({ query: { tab: 'deliveries', dataset: dataset.id } })}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        {t('back_to_source_history')}
                    </Link>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-semibold tracking-tight">{dataset.name}</h1>
                                <Badge variant={delivery.state === 'pending' ? 'secondary' : 'outline'}>
                                    {t(`states.${delivery.superseded ? 'superseded' : delivery.state}`)}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('delivery_number', { number: delivery.id })} · {t('retrieved')} <MunicipalDateTime value={delivery.retrieved_at} />
                            </p>
                        </div>
                        {delivery.state === 'pending' && !delivery.superseded && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant={review.blockers.length ? 'outline' : 'default'}>
                                        {t(review.blockers.length ? 'decision' : 'review')}
                                    </Button>
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
                </header>
                <MunicipalNavigation active="deliveries" />
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
                <nav aria-label={t('filter_records')} className="grid grid-cols-6 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
                    {Object.entries(review.counts).map(([kind, count]) => (
                        <div
                            key={kind}
                            className={`bg-background sm:col-span-1 ${kind === 'missing' || kind === 'conflict' ? 'col-span-3' : 'col-span-2'}`}
                        >
                            <Link
                                href={show(delivery.id, { query: { filter: kind } })}
                                preserveScroll
                                aria-current={filters.filter === kind ? 'true' : undefined}
                                className={`block h-full p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-4 ${filters.filter === kind ? 'bg-muted ring-2 ring-primary ring-inset' : ''}`}
                            >
                                <span className="block text-xs text-muted-foreground sm:text-sm">{t(`counts.${kind}`)}</span>
                                <span className="mt-1 block text-xl font-semibold tabular-nums sm:text-2xl">
                                    {count.toLocaleString(i18n.language)}
                                </span>
                            </Link>
                        </div>
                    ))}
                </nav>
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
                                        {t('records')}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">{t('records_hint')}</p>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {t('result_count', { count: total, total: total.toLocaleString(i18n.language) })}
                                </span>
                            </div>
                            <DataTable
                                key={`${delivery.id}-${page}`}
                                columns={columns}
                                enableSorting={false}
                                search={
                                    <Form
                                        action={show.url(delivery.id)}
                                        method="get"
                                        options={{ preserveState: true, preserveScroll: true }}
                                        className="flex min-w-0 flex-1 gap-2"
                                    >
                                        <input type="hidden" name="filter" value={filters.filter} />
                                        <Input
                                            key={filters.q}
                                            name="q"
                                            defaultValue={filters.q}
                                            placeholder={t('search_records')}
                                            aria-label={t('search_records')}
                                            maxLength={200}
                                        />
                                        <Button type="submit" variant="outline" size="icon" aria-label={t('search')}>
                                            <Search aria-hidden="true" />
                                        </Button>
                                    </Form>
                                }
                                filters={
                                    <select
                                        aria-label={t('filter_records')}
                                        value={filters.filter}
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                        onChange={(event) =>
                                            router.get(
                                                show.url(delivery.id),
                                                { q: filters.q, filter: event.target.value },
                                                { preserveState: true, preserveScroll: true },
                                            )
                                        }
                                    >
                                        <option value="changes">{t('changes_only')}</option>
                                        <option value="all">{t('all_records')}</option>
                                        <option value="geometry">
                                            {t('geometry_review')} ({review.derivations})
                                        </option>
                                        {Object.entries(review.counts).map(([status, count]) => (
                                            <option key={status} value={status}>
                                                {t(`counts.${status}`)} ({count})
                                            </option>
                                        ))}
                                    </select>
                                }
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
            </div>
        </AppLayout>
    );
}

function RecordDetails({ row }: { row: Row }) {
    const { t } = useTranslation('backend/municipal-imports');
    const [showOriginal, setShowOriginal] = useState(true);
    const [showDerived, setShowDerived] = useState(true);
    const hasMap = Boolean(row.point && row.after);
    return (
        <div className="space-y-5">
            <DialogHeader className="pr-7 text-left">
                <DialogTitle>{row.after?.street ?? row.before?.street ?? t('unknown_street')}</DialogTitle>
                <DialogDescription className="break-all">
                    {row.external_id} · {t(`counts.${row.status}`)}
                </DialogDescription>
            </DialogHeader>
            <Tabs
                defaultValue={hasMap && (row.geometry_review_required || row.fields.includes('geometry') || row.status === 'new') ? 'map' : 'source'}
                className="gap-4"
            >
                <TabsList>
                    <TabsTrigger value="map" disabled={!hasMap}>
                        {t('map_tab')}
                    </TabsTrigger>
                    <TabsTrigger value="source">{t('source_tab')}</TabsTrigger>
                </TabsList>
                <TabsContent value="map" className="space-y-4">
                    {row.point && row.after && (
                        <>
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
                                {row.geometry_derivation && (
                                    <Button
                                        variant={showDerived ? 'secondary' : 'outline'}
                                        size="sm"
                                        aria-pressed={showDerived}
                                        onClick={() => setShowDerived(!showDerived)}
                                    >
                                        <span className="size-3 rounded-sm border border-sky-500 bg-sky-500/30" aria-hidden="true" />
                                        {t('proposed_geometry')}
                                    </Button>
                                )}
                            </div>
                            <LocationMarkerCard {...row.point} draggable={false} scrollWheelZoom={false}>
                                {showDerived && row.geometry_derivation && (
                                    <GeoJSON data={row.geometry_derivation.geometry} style={{ color: '#38bdf8' }} />
                                )}
                                {showOriginal && <GeoJSON data={row.after.geometry} style={{ color: '#f97316', dashArray: '8 6', fill: false }} />}
                            </LocationMarkerCard>
                            <p className="text-xs leading-relaxed text-muted-foreground">{t('map_note')}</p>
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
                    <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-2">
                        {(['before', 'after'] as const).map((side) => (
                            <div key={side}>
                                <h3 className="font-medium">{t(side)}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {row[side] ? `${t('capacity')}: ${row[side]?.number ?? t('unknown')}` : t('no_source_value')}
                                </p>
                                <details className="mt-2">
                                    <summary className="cursor-pointer">{t('source_details')}</summary>
                                    <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs break-all whitespace-pre-wrap">
                                        {JSON.stringify(row[side], null, 2)}
                                    </pre>
                                </details>
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
