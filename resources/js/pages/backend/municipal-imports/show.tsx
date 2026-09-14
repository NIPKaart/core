import { index, show, update } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link } from '@inertiajs/react';
import type { MultiPolygon, Polygon } from 'geojson';
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
    const { t } = useTranslation('backend/municipal-imports');
    const [mapRecord, setMapRecord] = useState<string | null>(null);
    return (
        <AppLayout
            breadcrumbs={[
                { title: t('title'), href: index() },
                { title: `#${delivery.id}`, href: show(delivery.id) },
            ]}
        >
            <Head title={`${t('review')} #${delivery.id}`} />
            <div className="flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">{dataset.name}</h1>
                    <p className="mt-2">
                        {t(`states.${delivery.state}`)} · {new Date(delivery.retrieved_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-muted-foreground">{t('restrictions')}</p>
                </div>
                <dl className="flex flex-wrap gap-6 rounded-lg border p-4">
                    {Object.entries(review.counts).map(([kind, count]) => (
                        <div key={kind}>
                            <dt className="text-sm text-muted-foreground">{t(`counts.${kind}`)}</dt>
                            <dd className="text-2xl font-semibold">{count}</dd>
                        </div>
                    ))}
                </dl>
                {review.derivations > 0 && (
                    <p role="status" className="rounded-lg border p-4">
                        {t('derivations_notice', { count: review.derivations })}
                    </p>
                )}
                <p className="text-sm text-muted-foreground">{t('missing_note')}</p>
                {delivery.state !== 'pending' && <p className="text-sm text-muted-foreground">{t('current_comparison')}</p>}
                {delivery.state === 'pending' && (
                    <>
                        {review.blockers.length > 0 && (
                            <ul role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
                                {review.blockers.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        )}
                        <Form key={review.token} {...update.form(delivery.id)} className="flex flex-col gap-3 rounded-lg border p-4">
                            {({ errors, processing }) => (
                                <>
                                    <input type="hidden" name="review_token" value={review.token} />
                                    <Label htmlFor="reason">{t('reason')}</Label>
                                    <Textarea id="reason" name="reason" required maxLength={2000} />
                                    {review.derivations > 0 && (
                                        <Label className="flex items-start gap-2 leading-relaxed">
                                            <input type="checkbox" name="geometry_reviewed" value="1" className="mt-1 shrink-0" />
                                            <span>{t('geometry_confirm', { count: review.derivations })}</span>
                                        </Label>
                                    )}
                                    {Object.entries(errors).map(([field, message]) => (
                                        <InputError key={field} message={message} />
                                    ))}
                                    <div className="flex flex-wrap gap-3">
                                        <Button type="submit" name="decision" value="publish" disabled={processing || review.blockers.length > 0}>
                                            {t('publish')}
                                        </Button>
                                        <Button type="submit" name="decision" value="reject" variant="outline" disabled={processing}>
                                            {t('reject')}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </>
                )}
                {delivery.review_reason && (
                    <p>
                        {t('decision_reason')}: {delivery.review_reason}
                    </p>
                )}
                <section aria-label={t('records')} className="flex flex-col gap-3">
                    {review.rows.map((row) => (
                        <article key={row.external_id} className="min-w-0 rounded-lg border p-4">
                            <h2 className="font-semibold">
                                {row.after?.street ?? row.before?.street ?? t('unknown_street')} · {t(`counts.${row.status}`)}
                            </h2>
                            <p className="text-sm break-all text-muted-foreground">{row.external_id}</p>
                            {row.geometry_derivation && (
                                <div className="mt-3 rounded border p-3">
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
                                        onClick={() => setMapRecord(mapRecord === row.external_id ? null : row.external_id)}
                                    >
                                        {t('map')}
                                    </Button>
                                    {mapRecord === row.external_id && (
                                        <div className="mt-3">
                                            <p className="mb-2 text-sm text-muted-foreground">{t('map_note')}</p>
                                            {row.geometry_derivation && <p className="mb-2 text-sm">{t('geometry_legend')}</p>}
                                            <LocationMarkerCard {...row.point} draggable={false}>
                                                {row.geometry_derivation && (
                                                    <GeoJSON data={row.geometry_derivation.geometry} style={{ color: '#38bdf8' }} />
                                                )}
                                                <GeoJSON
                                                    data={row.after.geometry}
                                                    style={row.geometry_derivation ? { color: '#f97316', dashArray: '8 6', fill: false } : undefined}
                                                />
                                            </LocationMarkerCard>
                                        </div>
                                    )}
                                </div>
                            )}
                            {row.fields.length > 0 && (
                                <p className="mt-2">
                                    {t('changed_fields')}: {row.fields.map((field) => t(`fields.${field}`, { defaultValue: field })).join(', ')}
                                </p>
                            )}
                            {row.conflicts.length > 0 && (
                                <p className="mt-2 text-destructive">
                                    {t('protected_fields')}: {row.conflicts.join(', ')}
                                </p>
                            )}
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                {(['before', 'after'] as const).map((side) => (
                                    <div key={side}>
                                        <h3 className="font-medium">{t(side)}</h3>
                                        <p>
                                            {t('capacity')}: {row[side]?.number ?? t('unknown')}
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
                        </article>
                    ))}
                </section>
                <nav className="flex items-center gap-4" aria-label={t('pages')}>
                    {page > 1 && <Link href={show(delivery.id, { query: { page: page - 1 } })}>{t('previous')}</Link>}
                    <span>
                        {page} / {pages}
                    </span>
                    {page < pages && <Link href={show(delivery.id, { query: { page: page + 1 } })}>{t('next')}</Link>}
                </nav>
            </div>
        </AppLayout>
    );
}
