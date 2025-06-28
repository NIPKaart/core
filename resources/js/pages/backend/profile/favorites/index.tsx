import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { Favorite } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Heart, Landmark, MapPin, Warehouse } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type PageProps = {
    favorites?: Favorite[];
};

const iconMap = {
    Community: MapPin,
    Municipal: Landmark,
    Offstreet: Warehouse,
};

export default function FavoritesPage({ favorites = [] }: PageProps) {
    const { t } = useTranslation('profile');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return favorites;
        const s = search.toLowerCase();
        return favorites.filter(
            (fav) =>
                fav.title?.toLowerCase().includes(s) ||
                (fav.municipality && fav.municipality.name.toLowerCase().includes(s)) ||
                (fav.city && fav.city.toLowerCase().includes(s)),
        );
    }, [favorites, search]);

    const breadcrumbs = [{ title: t('favorites.breadcrumbs.index'), href: route('profile.favorites.index') }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('favorites.head.title')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold">{t('favorites.heading')}</h1>
                <p className="text-muted-foreground">{t('favorites.subheading')}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        className="w-full sm:max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('favorites.search.placeholder')}
                        autoFocus
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
                        <Heart className="mb-2 h-10 w-10 text-red-500" fill="#ef4444" />
                        <span className="text-lg font-semibold text-muted-foreground">{t('favorites.empty.title')}</span>
                        <span className="text-sm text-muted-foreground">{t('favorites.empty.subtitle')}</span>
                        <Button asChild size="lg" className="mt-2 bg-orange-600 hover:bg-orange-500">
                            <Link href={route('map')}>
                                <MapPin className="h-5 w-5" />
                                {t('favorites.actions.go_to_map')}
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((fav) => {
                            const Icon = iconMap[fav.type] || MapPin;
                            return (
                                <Card
                                    key={`${fav.type}-${fav.id}`}
                                    className="rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-150 hover:shadow-md"
                                >
                                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                        <div className="flex items-center justify-center rounded-xl bg-red-50 p-3">
                                            <Icon className="h-6 w-6 text-red-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <CardTitle className="truncate text-base leading-tight font-semibold lg:text-lg">
                                                {fav.title}
                                                {(fav.city || fav.municipality) && (
                                                    <span className="font-normal text-muted-foreground">
                                                        {' — '}
                                                        {fav.city || fav.municipality?.name}
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="mt-0.5 text-xs capitalize">{t(`favorites.types.${fav.type.toLowerCase()}`)}</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardFooter className="mt-2 flex items-center justify-between border-t pt-4">
                                        <div className="flex flex-col text-xs text-zinc-500">
                                            {fav.country && <span>{t('favorites.fields.country')}: {fav.country}</span>}
                                        </div>
                                        <Button asChild size="sm" variant="outline" className="ml-auto" title="View on map">
                                            <a href={`/map#18/${fav.latitude}/${fav.longitude}`} rel="noopener noreferrer">
                                                <MapPin className="mr-1 h-4 w-4" />
                                                {t('favorites.actions.view_on_map')}
                                            </a>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
