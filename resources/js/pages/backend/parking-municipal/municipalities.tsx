import MunicipalNavigation from '@/components/municipal-navigation';
import { Head, Link } from '@inertiajs/react';
import { ArrowUpRight, Building2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import parkingMunicipal from '@/routes/app/parking-municipal';
import { BreadcrumbItem } from '@/types';

type Municipality = {
    id: number;
    name: string;
    visible_spaces: number;
    hidden_spaces: number;
    total_spaces: number;
    last_updated: string | null;
};

type PageProps = {
    municipalities: Municipality[];
};

export default function MunicipalitiesPage({ municipalities }: PageProps) {
    const { t, i18n } = useTranslation('backend/parking-municipal');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return municipalities;
        const s = search.toLowerCase();
        return municipalities.filter((m) => m.name.toLowerCase().includes(s));
    }, [municipalities, search]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: parkingMunicipal.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.index')} />
            <div className="w-full space-y-6 px-4 py-6 sm:px-8 sm:py-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{t('head.index')}</h1>
                    <p className="text-sm text-muted-foreground">{t('description')}</p>
                </header>

                <MunicipalNavigation active="locations" />
                <div className="relative w-full sm:max-w-sm">
                    <Input
                        className="w-full pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('search.placeholder')}
                        aria-label={t('search.placeholder')}
                    />
                    <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                </div>

                {filtered.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center text-muted-foreground">
                        <Building2 className="h-10 w-10 text-primary" />
                        <p className="text-lg font-semibold">{t('empty.title')}</p>
                        <p className="text-sm">{t('empty.description')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((municipality) => (
                            <Link
                                key={municipality.id}
                                href={app.parkingMunicipal.municipality({ municipality: municipality.id })}
                                className="group flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted/50">
                                        <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
                                    </div>
                                    <h2 className="flex-1 text-lg font-semibold">{municipality.name}</h2>
                                    <ArrowUpRight
                                        className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-semibold tabular-nums">
                                        {municipality.total_spaces.toLocaleString(i18n.language)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{t('card.locations')}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge
                                        variant="outline"
                                        className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    >
                                        {t('card.visible', { count: municipality.visible_spaces })}
                                    </Badge>
                                    {municipality.hidden_spaces > 0 && (
                                        <Badge variant="secondary">{t('card.hidden', { count: municipality.hidden_spaces })}</Badge>
                                    )}
                                </div>
                                {municipality.last_updated && (
                                    <p className="border-t pt-4 text-xs text-muted-foreground">
                                        {t('card.updated_value', { date: new Date(municipality.last_updated) })}
                                    </p>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
