import { Head, Link } from '@inertiajs/react';
import { Building2, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
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
    const { t } = useTranslation('backend/parking-municipal');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return municipalities;
        const s = search.toLowerCase();
        return municipalities.filter((m) => m.name.toLowerCase().includes(s));
    }, [municipalities, search]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: route('app.parking-municipal.municipalities') }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.index')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-1">
                    <Heading title={t('head.index')} description={t('description')} />
                </div>

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
                                href={route('app.parking-municipal.municipalities.index', { municipality: municipality.id })}
                                className={cn(
                                    'group relative overflow-hidden rounded-2xl border border-border/70 bg-background p-5 shadow-sm transition-all hover:shadow-md',
                                )}
                            >
                                {/* Background Icon */}
                                <Building2 className="absolute top-3 right-3 h-20 w-20 text-muted-foreground/10 transition-transform group-hover:scale-105" />

                                {/* Content */}
                                <div className="relative z-10 flex flex-col gap-3">
                                    <div className="text-lg font-semibold text-foreground">{municipality.name}</div>

                                    <div className="flex flex-wrap gap-2 text-sm">
                                        <Badge variant="outline" className="text-muted-foreground">
                                            <MapPin className="mr-1 h-3.5 w-3.5" />
                                            {t('card.total', { count: municipality.total_spaces })}
                                        </Badge>

                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                            {t('card.visible', { count: municipality.visible_spaces })}
                                        </Badge>

                                        {municipality.hidden_spaces > 0 && (
                                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                                                {t('card.hidden', { count: municipality.hidden_spaces })}
                                            </Badge>
                                        )}

                                        {municipality.last_updated && (
                                            <Badge variant="secondary" className="text-muted-foreground">
                                                {t('card.updated_value', {
                                                    date: new Date(municipality.last_updated),
                                                })}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
