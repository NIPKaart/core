import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Favorite } from '@/types';
import { Heart, Landmark, MapPin, Warehouse, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type FavoritesDialogProps = {
    open: boolean;
    onClose: () => void;
    onGotoLocation?: () => void;
};

const iconMap = {
    Community: MapPin,
    Municipal: Landmark,
    Offstreet: Warehouse,
};

export default function FavoritesDialog({ open, onClose, onGotoLocation }: FavoritesDialogProps) {
    const { t } = useTranslation('frontend/map/favorites');
    const { t: tGlobal } = useTranslation('frontend/global');
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetch(route('profile.favorites.list'))
            .then((res) => res.json())
            .then((data) => setFavorites(data.favorites ?? []))
            .catch(() => setFavorites([]))
            .finally(() => setLoading(false));
    }, [open]);

    const handleFavoriteClick = (fav: Favorite) => {
        window.location.href = `/map#18/${fav.latitude}/${fav.longitude}`;
        onClose();
        onGotoLocation?.();
    };

    const EmptyState = (
        <div className="mt-8 mb-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Heart className="h-10 w-10 text-red-500" fill="#ef4444" />
            <div className="font-semibold text-muted-foreground">{t('empty.title')}</div>
            <div className="text-sm text-zinc-500">{t('empty.description')}</div>
        </div>
    );

    const List = (
        <div className="mt-2 grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto">
            {favorites.map((fav) => {
                const Icon = iconMap[fav.type] || MapPin;
                return (
                    <div
                        key={`${fav.type}-${fav.id}`}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition hover:bg-orange-50 dark:hover:bg-orange-900"
                        onClick={() => handleFavoriteClick(fav)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Go to ${fav.title} on map`}
                    >
                        <div className="flex items-center justify-center rounded-lg bg-red-50 p-2">
                            <Icon className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                                {fav.title}
                                {(fav.city || fav.municipality?.name) && (
                                    <span className="font-normal text-muted-foreground">
                                        {' — '}
                                        {fav.city || fav.municipality?.name}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-zinc-500 capitalize">{fav.type.toLowerCase()}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const content = loading ? <div className="py-10 text-center">{t('loading')}</div> : favorites.length === 0 ? EmptyState : List;

    // ---- Desktop Dialog ----
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
                <DialogContent showClose={false} className="max-w-lg bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Heart className="h-6 w-6 text-red-500" fill="#ef4444" />
                                <DialogTitle className="text-lg font-semibold">{t('title')}</DialogTitle>
                            </div>
                            <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </DialogHeader>
                    <DialogDescription className="mt-1 mb-0 text-center">{t('description')}</DialogDescription>
                    <Separator />
                    <div className="mt-2">{content}</div>
                    <DialogFooter>
                        <Button className="w-full cursor-pointer" variant="secondary" onClick={onClose}>
                            {tGlobal('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // ---- Mobile Drawer ----
    return (
        <Drawer open={open} onOpenChange={(value) => !value && onClose()} modal={false}>
            <DrawerContent className="mx-auto max-w-lg bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500" fill="#ef4444" />
                        <DrawerTitle className="text-lg font-semibold">{t('title')}</DrawerTitle>
                    </div>
                    <DrawerDescription className="mt-1 mb-0 text-center text-sm text-muted-foreground">{t('description')}</DrawerDescription>
                </DrawerHeader>
                <Separator />
                <div className="mt-2 px-2">{content}</div>
                <DrawerFooter>
                    <DrawerClose asChild>
                        <Button className="w-full" variant="secondary">
                            {tGlobal('common.close')}
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
