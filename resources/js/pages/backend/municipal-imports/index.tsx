import { index, show, store } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import MunicipalDateTime from '@/components/municipal-date-time';
import MunicipalNavigation from '@/components/municipal-navigation';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import parkingMunicipal from '@/routes/app/parking-municipal';
import type { PaginatedResponse } from '@/types';
import { Form, Head, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpRight, Database, ExternalLink, FileUp, MapPin, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type Dataset = { id: number; name: string; attribution: string; terms_url: string; source_url: string };
export type Import = {
    id: number;
    state: string;
    superseded?: boolean;
    delivery_id: string;
    retrieved_at: string;
    reviewed_at: string | null;
    review_reason: string | null;
    dataset_source?: Dataset;
};

type Source = Dataset & {
    municipality_id: number;
    latest_import: Pick<Import, 'id' | 'state' | 'retrieved_at'> | null;
    latest_delivery: { state: string; error_code: string | null } | null;
    last_published_retrieved_at: string | null;
    visible_locations_count: number;
    needs_review: boolean;
    stale: boolean;
    delivery_status: 'current' | 'awaiting' | 'overdue' | 'unknown';
};
type Props = { datasets: Source[]; imports: PaginatedResponse<Import>; filters: { q: string; state: string; dataset: number | null; tab: string } };

export default function Index({ datasets, imports, filters }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    const columns: ColumnDef<Import>[] = [
        {
            id: 'delivery',
            header: t('source'),
            cell: ({ row: { original: item } }) => (
                <div className="min-w-48 py-1">
                    <Link
                        href={show(item.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="block font-medium whitespace-normal hover:underline"
                    >
                        {item.dataset_source?.name}
                    </Link>
                    <span className="mt-1 block text-xs text-muted-foreground">{t('delivery_number', { number: item.id })}</span>
                </div>
            ),
        },
        {
            accessorKey: 'retrieved_at',
            header: t('retrieved'),
            cell: ({ row: { original: item } }) => <MunicipalDateTime value={item.retrieved_at} />,
        },
        {
            accessorKey: 'state',
            header: t('status'),
            cell: ({ row: { original: item } }) => (
                <Badge variant={item.state === 'pending' && !item.superseded ? 'secondary' : 'outline'}>
                    {t(`states.${item.superseded ? 'superseded' : item.state}`)}
                </Badge>
            ),
        },
    ];
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: index() }]}>
            <Head title={t('title')} />
            <div className="flex w-full min-w-0 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('intro')}</p>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <FileUp aria-hidden="true" />
                                {t('manual_upload')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>{t('upload')}</DialogTitle>
                                <DialogDescription>{t('upload_hint')}</DialogDescription>
                            </DialogHeader>
                            <Form {...store.form()} className="flex flex-col gap-4">
                                {({ errors, processing, progress }) => (
                                    <>
                                        <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm">
                                            <FileUp className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            <p className="leading-relaxed">{t('upload_process')}</p>
                                        </div>
                                        <Label htmlFor="file">{t('file')}</Label>
                                        <Input
                                            id="file"
                                            className="h-auto cursor-pointer bg-muted/20 p-3 file:mr-3 file:rounded-md file:bg-background file:px-3"
                                            type="file"
                                            name="file"
                                            accept=".json,application/json"
                                            required
                                            aria-invalid={!!errors.file}
                                            aria-describedby={errors.file ? 'file-error' : undefined}
                                        />
                                        {Object.entries(errors).map(([field, message]) => (
                                            <InputError key={field} id={`${field}-error`} message={message} />
                                        ))}
                                        {progress && (
                                            <progress className="w-full" value={progress.percentage} max={100} aria-label={t('upload_progress')} />
                                        )}
                                        <Button type="submit" disabled={processing || datasets.length === 0} className="mt-1 w-full">
                                            {processing ? t('checking') : t('check')}
                                        </Button>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </header>
                <MunicipalNavigation active={filters.tab === 'deliveries' ? 'deliveries' : 'sources'} />
                {filters.tab === 'deliveries' ? (
                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="font-semibold">{datasets.find((source) => source.id === filters.dataset)?.name ?? t('all_deliveries')}</h2>
                            {filters.dataset && (
                                <Link href={index({ query: { tab: 'deliveries' } })} className="text-sm underline">
                                    {t('all_deliveries')}
                                </Link>
                            )}
                        </div>
                        <DataTable
                            columns={columns}
                            data={imports.data}
                            emptyState={
                                <div className="space-y-2 px-4 py-6">
                                    <p className="font-medium">{t('no_deliveries')}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t(filters.q || filters.state !== 'all' ? 'history_no_matches' : 'no_deliveries_hint')}
                                    </p>
                                    {(filters.q || filters.state !== 'all') && (
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={index({ query: { tab: 'deliveries', dataset: filters.dataset } })}>{t('clear_filters')}</Link>
                                        </Button>
                                    )}
                                </div>
                            }
                            enableSorting={false}
                            onRowClick={(item) => router.visit(show(item.id))}
                            search={
                                <Form
                                    action={index.url()}
                                    method="get"
                                    options={{ preserveState: true, preserveScroll: true }}
                                    className="relative w-full sm:max-w-sm"
                                >
                                    <input type="hidden" name="state" value={filters.state} />
                                    <input type="hidden" name="tab" value="deliveries" />
                                    {filters.dataset && <input type="hidden" name="dataset" value={filters.dataset} />}
                                    <Input
                                        key={filters.q}
                                        className="w-full pl-9"
                                        name="q"
                                        defaultValue={filters.q}
                                        maxLength={200}
                                        placeholder={t('search_sources')}
                                        aria-label={t('search_sources')}
                                    />
                                    <button
                                        type="submit"
                                        className="absolute inset-y-0 left-0 flex w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                        aria-label={t('search')}
                                    >
                                        <Search className="size-4" aria-hidden="true" />
                                    </button>
                                </Form>
                            }
                            filters={
                                <Select
                                    value={filters.state}
                                    onValueChange={(state) =>
                                        router.get(
                                            index.url(),
                                            { q: filters.q, state, dataset: filters.dataset, tab: 'deliveries' },
                                            { preserveState: true, preserveScroll: true },
                                        )
                                    }
                                >
                                    <SelectTrigger aria-label={t('status')} className="w-full sm:w-[200px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('all_deliveries')}</SelectItem>
                                        {['pending', 'published', 'rejected', 'superseded'].map((state) => (
                                            <SelectItem key={state} value={state}>
                                                {t(`states.${state}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            }
                        />
                        {imports.total > 0 && <DataTablePagination pagination={imports} />}
                    </div>
                ) : (
                    <div>
                        {datasets.length === 0 && (
                            <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">{t('no_datasets')}</p>
                        )}
                        <div className="space-y-4">
                            {datasets.map((dataset) => (
                                <section key={dataset.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                                    <div className="flex flex-col gap-6 p-5 sm:p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40 sm:flex">
                                                <Database className="size-5 text-muted-foreground" aria-hidden="true" />
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                                <h2 className="max-w-2xl text-base leading-relaxed font-semibold">{dataset.name}</h2>
                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Badge
                                                        variant={dataset.needs_review ? 'secondary' : 'outline'}
                                                        className={
                                                            dataset.last_published_retrieved_at &&
                                                            !dataset.needs_review &&
                                                            dataset.latest_import?.state !== 'rejected'
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                : undefined
                                                        }
                                                    >
                                                        {t(
                                                            dataset.needs_review
                                                                ? 'states.pending'
                                                                : dataset.latest_import?.state === 'rejected'
                                                                  ? 'states.rejected'
                                                                  : dataset.last_published_retrieved_at
                                                                    ? 'states.published'
                                                                    : 'no_deliveries',
                                                        )}
                                                    </Badge>
                                                    {dataset.stale && <Badge variant="destructive">{t('source_stale')}</Badge>}
                                                    {dataset.delivery_status === 'unknown' && (
                                                        <Badge variant="outline">{t('freshness_unknown')}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <dl className="grid gap-5 rounded-lg bg-muted/30 p-4 sm:grid-cols-3 sm:gap-6">
                                            <div>
                                                <dt className="text-xs font-medium text-muted-foreground">{t('on_map')}</dt>
                                                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                                                    {dataset.visible_locations_count.toLocaleString(i18n.language)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-medium text-muted-foreground">{t('last_retrieved')}</dt>
                                                <dd className="mt-2 text-sm font-medium">
                                                    {dataset.latest_import ? <MunicipalDateTime value={dataset.latest_import.retrieved_at} /> : '—'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-medium text-muted-foreground">{t('published_source_date')}</dt>
                                                <dd className="mt-2 text-sm font-medium">
                                                    {dataset.last_published_retrieved_at ? (
                                                        <MunicipalDateTime value={dataset.last_published_retrieved_at} />
                                                    ) : (
                                                        '—'
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                        {dataset.stale && <p className="text-sm text-muted-foreground">{t('overdue_note')}</p>}
                                        {(dataset.latest_delivery?.error_code || dataset.latest_delivery?.state === 'rejected') && (
                                            <p role="status" className="text-sm text-destructive">
                                                {t('intake_problem')}
                                            </p>
                                        )}
                                        {dataset.latest_delivery?.state === 'pending' && !dataset.latest_delivery.error_code && (
                                            <p className="text-sm text-muted-foreground">{t('intake_pending')}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {dataset.needs_review && dataset.latest_import && (
                                                <Button asChild>
                                                    <Link href={show(dataset.latest_import.id)}>
                                                        {t('review_changes')}
                                                        <ArrowUpRight aria-hidden="true" />
                                                    </Link>
                                                </Button>
                                            )}
                                            <Button variant="outline" asChild>
                                                <Link href={parkingMunicipal.municipality(dataset.municipality_id)}>
                                                    <MapPin aria-hidden="true" />
                                                    {t('locations')}
                                                </Link>
                                            </Button>
                                            <Button variant="ghost" asChild>
                                                <Link href={index({ query: { tab: 'deliveries', dataset: dataset.id } })}>{t('history')}</Link>
                                            </Button>
                                        </div>
                                    </div>
                                    <details className="border-t px-5 py-4 text-sm sm:px-6">
                                        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
                                            {t('source_information')}
                                        </summary>
                                        <div className="mt-4 space-y-3">
                                            <p className="text-muted-foreground">{dataset.attribution}</p>
                                            <div className="flex flex-wrap gap-4">
                                                <a
                                                    className="inline-flex items-center gap-1 underline underline-offset-4"
                                                    href={dataset.source_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {t('source')}
                                                    <ExternalLink className="size-3" aria-hidden="true" />
                                                </a>
                                                <a
                                                    className="inline-flex items-center gap-1 underline underline-offset-4"
                                                    href={dataset.terms_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {t('terms')}
                                                    <ExternalLink className="size-3" aria-hidden="true" />
                                                </a>
                                            </div>
                                        </div>
                                    </details>
                                </section>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
