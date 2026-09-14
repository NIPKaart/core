import { enable, index, show, store } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Form, Head, Link } from '@inertiajs/react';
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
    const { t } = useTranslation('backend/municipal-imports');
    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: index() }]}>
            <Head title={t('title')} />
            <div className="flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">{t('title')}</h1>
                    <p className="mt-2 text-muted-foreground">{t('intro')}</p>
                </div>
                {datasets.length === 0 && <p role="status">{t('no_datasets')}</p>}
                {datasets.map((dataset) => (
                    <section key={dataset.id} className="rounded-lg border p-4">
                        <h2 className="text-lg font-semibold">{dataset.name}</h2>
                        <p className="my-2">{dataset.attribution}</p>
                        <div className="flex gap-4">
                            <a className="underline" href={dataset.source_url} target="_blank" rel="noreferrer">
                                {t('source')}
                            </a>
                            <a className="underline" href={dataset.terms_url} target="_blank" rel="noreferrer">
                                {t('terms')}
                            </a>
                        </div>
                        {dataset.publication_enabled ? (
                            <p className="mt-3">{t('terms_enabled')}</p>
                        ) : (
                            <Form {...enable.form(dataset.id)} className="mt-4 flex flex-col gap-3">
                                {({ errors, processing }) => (
                                    <>
                                        <Label>
                                            <input type="checkbox" name="terms_confirmed" value="1" required className="mr-2" />
                                            {t('terms_confirm')}
                                        </Label>
                                        <Label htmlFor={`reason-${dataset.id}`}>{t('terms_reason')}</Label>
                                        <Input id={`reason-${dataset.id}`} name="reason" required maxLength={2000} />
                                        {Object.entries(errors).map(([field, message]) => (
                                            <InputError key={field} message={message} />
                                        ))}
                                        <Button type="submit" disabled={processing} className="self-start">
                                            {t('enable')}
                                        </Button>
                                    </>
                                )}
                            </Form>
                        )}
                    </section>
                ))}
                <section className="rounded-lg border p-4">
                    <h2 className="mb-4 text-lg font-semibold">{t('upload')}</h2>
                    <Form {...store.form()} className="flex flex-col gap-3">
                        {({ errors, processing }) => (
                            <>
                                <Label htmlFor="file">{t('file')}</Label>
                                <Input id="file" type="file" name="file" accept=".json,application/json" required />
                                {Object.entries(errors).map(([field, message]) => (
                                    <InputError key={field} message={`${field}: ${message}`} />
                                ))}
                                <Button type="submit" disabled={processing || datasets.length === 0} className="self-start">
                                    {processing ? t('checking') : t('check')}
                                </Button>
                            </>
                        )}
                    </Form>
                </section>
                <section>
                    <h2 className="mb-3 text-lg font-semibold">{t('deliveries')}</h2>
                    <ul className="divide-y rounded-lg border">
                        {imports.data.map((item) => (
                            <li key={item.id} className="p-4">
                                <Link className="font-medium underline" href={show(item.id)}>
                                    {item.dataset_source?.name} · #{item.id}
                                </Link>
                                <p className="text-sm text-muted-foreground">
                                    {t(`states.${item.state}`)} · {new Date(item.retrieved_at).toLocaleString()}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <nav className="mt-4 flex gap-4" aria-label={t('pages')}>
                        {imports.prev_page_url && <Link href={imports.prev_page_url}>{t('previous')}</Link>}
                        {imports.next_page_url && <Link href={imports.next_page_url}>{t('next')}</Link>}
                    </nav>
                </section>
            </div>
        </AppLayout>
    );
}
