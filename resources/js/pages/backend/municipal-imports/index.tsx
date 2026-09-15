import { enable, index, show, store } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import type { PaginatedResponse } from '@/types';
import { Form, Head, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, FileUp, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type Dataset = { id: number; name: string; attribution: string; terms_url: string; source_url: string; publication_enabled: boolean };
export type Import = {
    id: number;
    state: string;
    delivery_id: string;
    retrieved_at: string;
    reviewed_at: string | null;
    review_reason: string | null;
    dataset_source?: Dataset;
};

type Props = { datasets: Dataset[]; imports: PaginatedResponse<Import>; filters: { q: string; state: string } };

export default function Index({ datasets, imports, filters }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    const columns: ColumnDef<Import>[] = [
        {
            id: 'delivery',
            header: t('source'),
            cell: ({ row: { original: item } }) => (
                <div className="min-w-48 py-1">
                    <span className="block font-medium whitespace-normal">{item.dataset_source?.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t('delivery_number', { number: item.id })}</span>
                </div>
            ),
        },
        {
            accessorKey: 'retrieved_at',
            header: t('retrieved'),
            cell: ({ row: { original: item } }) => (
                <time dateTime={item.retrieved_at}>{new Date(item.retrieved_at).toLocaleString(i18n.language)}</time>
            ),
        },
        {
            accessorKey: 'state',
            header: t('status'),
            cell: ({ row: { original: item } }) => (
                <Badge variant={item.state === 'pending' ? 'secondary' : 'outline'}>{t(`states.${item.state}`)}</Badge>
            ),
        },
    ];
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: index() }]}>
            <Head title={t('title')} />
            <div className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-6">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="space-y-2">
                        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('intro')}</p>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <FileUp aria-hidden="true" />
                                {t('manual_upload')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('upload')}</DialogTitle>
                                <DialogDescription>{t('upload_hint')}</DialogDescription>
                            </DialogHeader>
                            <Form {...store.form()} className="flex flex-col gap-3">
                                {({ errors, processing, progress }) => (
                                    <>
                                        <Label htmlFor="file">{t('file')}</Label>
                                        <Input
                                            id="file"
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
                <Tabs defaultValue="deliveries" className="gap-6">
                    <TabsList>
                        <TabsTrigger value="deliveries">{t('deliveries')}</TabsTrigger>
                        <TabsTrigger value="sources">
                            {t('connected_sources')} ({datasets.length})
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="deliveries" className="min-w-0 space-y-4">
                        <DataTable
                            columns={columns}
                            data={imports.data}
                            enableSorting={false}
                            onRowClick={(item) => router.visit(show(item.id))}
                            search={
                                <Form
                                    action={index.url()}
                                    method="get"
                                    options={{ preserveState: true, preserveScroll: true }}
                                    className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
                                >
                                    <input type="hidden" name="state" value={filters.state} />
                                    <Input
                                        key={filters.q}
                                        name="q"
                                        defaultValue={filters.q}
                                        maxLength={200}
                                        placeholder={t('search_sources')}
                                        aria-label={t('search_sources')}
                                    />
                                    <Button type="submit" size="icon" variant="outline" aria-label={t('search')}>
                                        <Search aria-hidden="true" />
                                    </Button>
                                </Form>
                            }
                            filters={
                                <select
                                    aria-label={t('status')}
                                    value={filters.state}
                                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                    onChange={(event) =>
                                        router.get(
                                            index.url(),
                                            { q: filters.q, state: event.target.value },
                                            { preserveState: true, preserveScroll: true },
                                        )
                                    }
                                >
                                    <option value="all">{t('all_deliveries')}</option>
                                    {['pending', 'published', 'rejected'].map((state) => (
                                        <option key={state} value={state}>
                                            {t(`states.${state}`)}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        {imports.total > 0 && <DataTablePagination pagination={imports} />}
                    </TabsContent>
                    <TabsContent value="sources">
                        {datasets.length === 0 && (
                            <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">{t('no_datasets')}</p>
                        )}
                        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {datasets.map((dataset) => (
                                <section key={dataset.id} className="min-w-0 rounded-xl border">
                                    <div className="space-y-3 p-5">
                                        <h2 className="font-semibold">{dataset.name}</h2>
                                        <Badge variant={dataset.publication_enabled ? 'secondary' : 'outline'}>
                                            {t(dataset.publication_enabled ? 'publication_ready' : 'publication_disabled')}
                                        </Badge>
                                    </div>
                                    <div className="space-y-4 border-t p-4 text-sm">
                                        <p className="text-muted-foreground">{dataset.attribution}</p>
                                        <div className="flex flex-wrap gap-3">
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
                                        {dataset.publication_enabled ? (
                                            <p className="text-muted-foreground">{t('publication_enabled')}</p>
                                        ) : (
                                            <Form {...enable.form(dataset.id)} className="flex flex-col gap-3">
                                                {({ errors, processing }) => (
                                                    <>
                                                        {Object.entries(errors).map(([field, message]) => (
                                                            <InputError key={field} message={message} />
                                                        ))}
                                                        <Button type="submit" disabled={processing}>
                                                            {t('enable')}
                                                        </Button>
                                                    </>
                                                )}
                                            </Form>
                                        )}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
