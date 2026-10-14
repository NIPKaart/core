import { RemoveFavoriteButton } from '@/components/frontend/button/remove-favorite';
import { Button } from '@/components/ui/button';
import profile from '@/routes/profile';
import type { Favorite } from '@/types';
import { HeartCrack, Landmark, MapPin, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const iconMap = {
    Community: MapPin,
    Municipal: Landmark,
    Offstreet: Warehouse,
    Unknown: HeartCrack,
};

export default function Favorites({ open, onSelect }: { open: boolean; onSelect: (favorite: Favorite) => void }) {
    const { t } = useTranslation('frontend/map/favorites');
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!open) return;
        const request = new AbortController();
        setLoading(true);
        setFailed(false);
        fetch(profile.favorites.list.url(), { headers: { Accept: 'application/json' }, cache: 'no-store', signal: request.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Favorites unavailable');
                const data = await response.json();
                if (!request.signal.aborted) setFavorites(data.favorites ?? []);
            })
            .catch(() => {
                if (!request.signal.aborted) setFailed(true);
            })
            .finally(() => {
                if (!request.signal.aborted) setLoading(false);
            });
        return () => request.abort();
    }, [open, retry]);

    const handleFavoriteClick = (fav: Favorite) => {
        if (!fav.available) return;
        onSelect(fav);
    };

    const EmptyState = (
        <div className="mt-8 mb-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <HeartCrack className="h-10 w-10 text-red-500" />
            <div className="font-semibold text-muted-foreground">{t('empty.title')}</div>
            <div className="text-sm text-zinc-500">{t('empty.description')}</div>
        </div>
    );

    const List = (
        <div className="grid grid-cols-1 gap-3">
            {favorites.map((fav) => {
                const Icon = iconMap[fav.type] || MapPin;
                return (
                    <div key={fav.favorite_id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-center rounded-lg bg-red-50 p-2">
                            <Icon className="h-5 w-5 text-red-500" />
                        </div>
                        <button
                            type="button"
                            className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                            disabled={!fav.available}
                            onClick={() => handleFavoriteClick(fav)}
                            aria-label={fav.available ? t('goToLocation', { title: fav.title }) : t('unavailable')}
                        >
                            <div className="truncate font-medium">
                                {fav.available ? fav.title : t('unavailable')}
                                {(fav.city || fav.municipality?.name) && (
                                    <span className="font-normal text-muted-foreground">
                                        {' — '}
                                        {fav.city || fav.municipality?.name}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-zinc-500 capitalize">{fav.type.toLowerCase()}</div>
                        </button>
                        <RemoveFavoriteButton
                            favoriteId={fav.favorite_id}
                            onRemoved={() => setFavorites((items) => items.filter((item) => item.favorite_id !== fav.favorite_id))}
                        />
                    </div>
                );
            })}
        </div>
    );

    if (loading) return <p role="status">{t('loading')}</p>;
    if (failed)
        return (
            <div role="alert">
                <p>{t('load_error')}</p>
                <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                    {t('retry')}
                </Button>
            </div>
        );
    return favorites.length === 0 ? EmptyState : List;
}
