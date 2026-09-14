import { enable, index, show, store } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, ChevronDown, ExternalLink, FileUp, Inbox } from 'lucide-react';
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

type Props = { datasets: Dataset[]; imports: { data: Import[]; prev_page_url: string | null; next_page_url: string | null } };

export default function Index({ datasets, imports }: Props) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: index() }]}>
            <Head title={t('title')} />
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 sm:p-6">
                <header className="max-w-2xl space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
                </header>
                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <section className="min-w-0" aria-labelledby="deliveries-heading">
                        <div className="mb-4 space-y-1">
                            <h2 id="deliveries-heading" className="text-lg font-semibold">
                                {t('deliveries')}
                            </h2>
                            <p className="text-sm text-muted-foreground">{t('deliveries_hint')}</p>
                        </div>
                        {imports.data.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center" role="status">
                                <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
                                <p className="font-medium">{t('no_deliveries')}</p>
                                <p className="max-w-sm text-sm text-muted-foreground">{t('no_deliveries_hint')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y overflow-hidden rounded-xl border">
                                {imports.data.map((item) => (
                                    <li key={item.id}>
                                        <Link
                                            className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-ring sm:p-5"
                                            href={show(item.id)}
                                        >
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold">{item.dataset_source?.name}</span>
                                                    <span className="text-sm text-muted-foreground">#{item.id}</span>
                                                    <Badge variant={item.state === 'pending' ? 'secondary' : 'outline'}>
                                                        {t(`states.${item.state}`)}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('retrieved')}{' '}
                                                    <time dateTime={item.retrieved_at}>
                                                        {new Date(item.retrieved_at).toLocaleString(i18n.language)}
                                                    </time>
                                                </p>
                                            </div>
                                            <ArrowRight
                                                className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                                                aria-hidden="true"
                                            />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {(imports.prev_page_url || imports.next_page_url) && (
                            <nav className="mt-4 flex justify-between gap-4" aria-label={t('pages')}>
                                {imports.prev_page_url && (
                                    <Button asChild variant="outline">
                                        <Link href={imports.prev_page_url}>{t('previous')}</Link>
                                    </Button>
                                )}
                                {imports.next_page_url && (
                                    <Button asChild variant="outline" className="ml-auto">
                                        <Link href={imports.next_page_url}>{t('next')}</Link>
                                    </Button>
                                )}
                            </nav>
                        )}
                    </section>
                    <aside className="flex min-w-0 flex-col gap-6" aria-label={t('intake')}>
                        <section className="rounded-xl border p-5">
                            <div className="mb-2 flex items-center gap-2">
                                <FileUp className="size-5 text-muted-foreground" aria-hidden="true" />
                                <h2 className="font-semibold">{t('upload')}</h2>
                            </div>
                            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{t('upload_hint')}</p>
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
                        </section>
                        <section className="space-y-3" aria-labelledby="sources-heading">
                            <h2 id="sources-heading" className="text-sm font-semibold">
                                {t('connected_sources')}
                            </h2>
                            {datasets.length === 0 && (
                                <p className="text-sm text-muted-foreground" role="status">
                                    {t('no_datasets')}
                                </p>
                            )}
                            {datasets.map((dataset) => (
                                <details key={dataset.id} className="group rounded-xl border" open={!dataset.publication_enabled}>
                                    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                                        <div className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{dataset.name}</span>
                                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                {dataset.publication_enabled && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                                                {t(dataset.publication_enabled ? 'terms_ready' : 'terms_needed')}
                                            </span>
                                        </div>
                                        <ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" />
                                    </summary>
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
                                            <p className="text-muted-foreground">{t('terms_enabled')}</p>
                                        ) : (
                                            <Form {...enable.form(dataset.id)} className="flex flex-col gap-3">
                                                {({ errors, processing }) => (
                                                    <>
                                                        <Label className="flex items-start gap-2 leading-relaxed">
                                                            <input
                                                                type="checkbox"
                                                                name="terms_confirmed"
                                                                value="1"
                                                                required
                                                                className="mt-1 size-4 shrink-0 accent-primary"
                                                            />
                                                            <span>{t('terms_confirm')}</span>
                                                        </Label>
                                                        <Label htmlFor={`reason-${dataset.id}`}>{t('terms_reason')}</Label>
                                                        <Input id={`reason-${dataset.id}`} name="reason" required maxLength={2000} />
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
                                </details>
                            ))}
                        </section>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
