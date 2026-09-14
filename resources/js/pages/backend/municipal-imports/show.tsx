import { index, show, update } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link } from '@inertiajs/react';
import type { MultiPolygon, Polygon } from 'geojson';
import { ArrowDown, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, MapPin, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
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
    previous_geometry_derivation?: Derivation | null;
    point?: { latitude: number; longitude: number };
};
type Props = {
    import: Import;
    dataset: Dataset;
    review: { derivations: number; counts: Record<string, number>; blockers: string[]; rows: Row[]; token: string };
    page: number;
    pages: number;
};

export default function Show({ import: delivery, dataset, review, page, pages }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    const [mapRecord, setMapRecord] = useState<string | null>(null);
    return (
        <AppLayout
            breadcrumbs={[
                { title: t('title'), href: index() },
                { title: `#${delivery.id}`, href: show(delivery.id) },
            ]}
        >
            <Head title={`${t('review')} #${delivery.id}`} />
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
                <header className="space-y-4">
                    <Link href={index()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        {t('back')}
                    </Link>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-semibold tracking-tight">{dataset.name}</h1>
                                <Badge variant={delivery.state === 'pending' ? 'secondary' : 'outline'}>{t(`states.${delivery.state}`)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('delivery_number', { number: delivery.id })} · {t('retrieved')}{' '}
                                <time dateTime={delivery.retrieved_at}>{new Date(delivery.retrieved_at).toLocaleString(i18n.language)}</time>
                            </p>
                        </div>
                        {delivery.state === 'pending' && (
                            <Button asChild variant="outline">
                                <a href="#decision">
                                    {t('go_decision')}
                                    <ArrowDown aria-hidden="true" />
                                </a>
                            </Button>
                        )}
                    </div>
                </header>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-5">
                    {Object.entries(review.counts).map(([kind, count]) => (
                        <div key={kind} className="bg-background p-4 last:col-span-2 lg:last:col-span-1">
                            <dt className="text-sm text-muted-foreground">{t(`counts.${kind}`)}</dt>
                            <dd className="mt-1 text-2xl font-semibold tabular-nums">{count.toLocaleString(i18n.language)}</dd>
                        </div>
                    ))}
                </dl>
                {delivery.state === 'pending' && review.derivations > 0 && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                    >
                        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                        <div className="space-y-1 text-sm">
                            <p className="font-semibold">{t('attention')}</p>
                            <p className="leading-relaxed">{t('derivations_notice', { count: review.derivations })}</p>
                            {page > 1 && (
                                <Link className="inline-flex underline underline-offset-4" href={show(delivery.id)}>
                                    {t('first_records')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}
                {delivery.state === 'pending' && review.blockers.length > 0 && (
                    <ul role="alert" className="mb-5 space-y-1 rounded-lg border border-destructive p-4 text-sm text-destructive">
                        {review.blockers.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                )}
                <details className="text-sm text-muted-foreground">
                    <summary className="w-fit cursor-pointer font-medium">{t('review_guidance')}</summary>
                    <div className="mt-2 max-w-3xl space-y-2 leading-relaxed">
                        <p>{t('restrictions')}</p>
                        <p>{t('missing_note')}</p>
                    </div>
                </details>
                {delivery.state !== 'pending' && <p className="text-sm text-muted-foreground">{t('current_comparison')}</p>}
                {delivery.review_reason && (
                    <section className="space-y-2 rounded-xl border bg-muted/20 p-5">
                        <h2 className="font-semibold">{t('decision_reason')}</h2>
                        {delivery.reviewed_at && (
                            <p className="text-sm text-muted-foreground">
                                <time dateTime={delivery.reviewed_at}>{new Date(delivery.reviewed_at).toLocaleString(i18n.language)}</time>
                            </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{delivery.review_reason}</p>
                    </section>
                )}
                <section id="records" aria-labelledby="records-heading" className="min-w-0 scroll-mt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 id="records-heading" className="text-lg font-semibold">
                                {t('records')}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t('records_hint')}</p>
                        </div>
                        <nav className="flex items-center gap-2" aria-label={t('pages')}>
                            <Button asChild={page > 1} size="icon" variant="outline" disabled={page <= 1} aria-label={t('previous')}>
                                {page > 1 ? (
                                    <Link href={show(delivery.id, { query: { page: page - 1 } })} aria-label={t('previous')}>
                                        <ChevronLeft aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <ChevronLeft aria-hidden="true" />
                                )}
                            </Button>
                            <span className="text-sm text-muted-foreground">{t('page_number', { page, pages })}</span>
                            <Button asChild={page < pages} size="icon" variant="outline" disabled={page >= pages} aria-label={t('next')}>
                                {page < pages ? (
                                    <Link href={show(delivery.id, { query: { page: page + 1 } })} aria-label={t('next')}>
                                        <ChevronRight aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <ChevronRight aria-hidden="true" />
                                )}
                            </Button>
                        </nav>
                    </div>
                    <div className="divide-y rounded-xl border">
                        {review.rows.map((row) => (
                            <details
                                key={`${delivery.id}-${page}-${row.external_id}`}
                                className="group/record min-w-0"
                                onToggle={(event) => {
                                    if (!event.currentTarget.open && mapRecord === row.external_id) {
                                        setMapRecord(null);
                                    }
                                }}
                            >
                                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-muted/40 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                                    <ChevronDown className="size-4 shrink-0 text-muted-foreground group-open/record:rotate-180" aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium">
                                            {row.after?.street ?? row.before?.street ?? t('unknown_street')}
                                        </span>
                                        <span className="mt-1 block text-xs break-all text-muted-foreground">{row.external_id}</span>
                                    </span>
                                    <span className="flex max-w-[45%] flex-wrap justify-end gap-1.5">
                                        <Badge variant={row.status === 'conflict' ? 'destructive' : 'outline'}>{t(`counts.${row.status}`)}</Badge>
                                        {row.geometry_derivation && (
                                            <Badge
                                                variant="outline"
                                                className="max-w-full border-amber-300 whitespace-normal text-amber-800 dark:border-amber-800 dark:text-amber-300"
                                            >
                                                <TriangleAlert aria-hidden="true" />
                                                {t(delivery.state === 'pending' ? 'geometry_review' : 'derived')}
                                            </Badge>
                                        )}
                                    </span>
                                </summary>
                                <div className="space-y-4 border-t bg-muted/10 p-4 sm:p-5">
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
                                    {row.point && row.after && (
                                        <div className="mt-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                aria-expanded={mapRecord === row.external_id}
                                                aria-controls={`map-${row.external_id}`}
                                                onClick={() => setMapRecord(mapRecord === row.external_id ? null : row.external_id)}
                                            >
                                                <MapPin aria-hidden="true" />
                                                {mapRecord === row.external_id ? t('hide_map') : t('map')}
                                            </Button>
                                            {mapRecord === row.external_id && (
                                                <div id={`map-${row.external_id}`} className="mt-3">
                                                    <p className="mb-2 text-sm text-muted-foreground">{t('map_note')}</p>
                                                    {row.geometry_derivation && <p className="mb-2 text-sm">{t('geometry_legend')}</p>}
                                                    <LocationMarkerCard {...row.point} draggable={false} scrollWheelZoom={false}>
                                                        {row.geometry_derivation && (
                                                            <GeoJSON data={row.geometry_derivation.geometry} style={{ color: '#38bdf8' }} />
                                                        )}
                                                        <GeoJSON
                                                            data={row.after.geometry}
                                                            style={
                                                                row.geometry_derivation
                                                                    ? { color: '#f97316', dashArray: '8 6', fill: false }
                                                                    : undefined
                                                            }
                                                        />
                                                    </LocationMarkerCard>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {row.fields.length > 0 && (
                                        <p className="mt-2">
                                            {t('changed_fields')}:{' '}
                                            {row.fields.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
                                        </p>
                                    )}
                                    {row.conflicts.length > 0 && (
                                        <p className="mt-2 text-destructive">
                                            {t('protected_fields')}:{' '}
                                            {row.conflicts.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
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
                                            <pre className="mt-2 overflow-auto text-xs break-all whitespace-pre-wrap">
                                                {JSON.stringify(row.current, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>
                <nav className="flex items-center justify-between gap-4" aria-label={t('pages')}>
                    <Button asChild={page > 1} variant="outline" disabled={page <= 1}>
                        {page > 1 ? <Link href={show(delivery.id, { query: { page: page - 1 } })}>{t('previous')}</Link> : t('previous')}
                    </Button>
                    <span>
                        {page} / {pages}
                    </span>
                    <Button asChild={page < pages} variant="outline" disabled={page >= pages}>
                        {page < pages ? <Link href={show(delivery.id, { query: { page: page + 1 } })}>{t('next')}</Link> : t('next')}
                    </Button>
                </nav>
                {delivery.state === 'pending' && (
                    <section id="decision" aria-labelledby="decision-heading" className="scroll-mt-6 rounded-xl border bg-muted/20 p-4 sm:p-6">
                        <h2 id="decision-heading" className="text-lg font-semibold">
                            {t('decision')}
                        </h2>
                        <p className="mt-1 mb-5 text-sm text-muted-foreground">{t('decision_hint')}</p>
                        <Form
                            key={review.token}
                            {...update.form(delivery.id)}
                            options={{ preserveScroll: 'errors' }}
                            className="flex max-w-2xl flex-col gap-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <input type="hidden" name="review_token" value={review.token} />
                                    <Label htmlFor="reason">{t('reason')}</Label>
                                    <Textarea
                                        id="reason"
                                        name="reason"
                                        required
                                        maxLength={2000}
                                        rows={3}
                                        placeholder={t('reason_placeholder')}
                                        aria-invalid={!!errors.reason}
                                        aria-describedby={errors.reason ? 'reason-error' : undefined}
                                    />
                                    {review.derivations > 0 && (
                                        <Label className="flex items-start gap-3 rounded-lg border bg-background p-4 leading-relaxed">
                                            <input
                                                type="checkbox"
                                                name="geometry_reviewed"
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
                                        <Button type="submit" name="decision" value="publish" disabled={processing || review.blockers.length > 0}>
                                            {processing ? t('saving') : t('publish')}
                                        </Button>
                                        <Button type="submit" name="decision" value="reject" variant="outline" disabled={processing}>
                                            {t('reject')}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
