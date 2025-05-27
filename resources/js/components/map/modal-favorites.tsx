import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Favorite } from '@/types';
import { Heart, Landmark, MapPin, Warehouse, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type FavoritesDialogProps = {
    open: boolean;
    onClose: () => void;
    onGotoLocation?: () => void;
};

const iconMap = {
    ParkingSpot: MapPin,
    ParkingMunicipal: Landmark,
    ParkingOffstreet: Warehouse,
};

export default function FavoritesDialog({ open, onClose, onGotoLocation }: FavoritesDialogProps) {
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetch(route('user.favorites.list'))
            .then((res) => res.json())
            .then((data) => setFavorites(data.favorites ?? []))
            .catch(() => setFavorites([]))
            .finally(() => setLoading(false));
    }, [open]);

    const handleFavoriteClick = (fav: Favorite) => {
        window.location.hash = `18/${fav.latitude}/${fav.longitude}`;
        onClose();
        onGotoLocation?.();
    };

    const EmptyState = (
        <div className="mt-8 mb-10 flex flex-col items-center justify-center gap-3 text-center">
            <Heart className="h-10 w-10 text-red-500" fill="#ef4444" />
            <div className="text-muted-foreground font-semibold">No favorites yet</div>
            <div className="text-sm text-zinc-500">Browse the map and click the heart icon to favorite locations.</div>
        </div>
    );

    const List = (
        <div className="mt-4 grid max-h-[60vh] grid-cols-1 gap-5 overflow-y-auto">
            {favorites.map((fav) => {
                const Icon = iconMap[fav.type] || MapPin;
                return (
                    <div
                        key={`${fav.type}-${fav.id}`}
                        className="bg-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition hover:bg-orange-50 dark:hover:bg-orange-900"
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
                                {(fav.city || fav.municipality) && (
                                    <span className="text-muted-foreground font-normal"> — {fav.city || fav.municipality}</span>
                                )}
                            </div>
                            <div className="text-xs text-zinc-500 capitalize">{fav.type.toLowerCase()}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const content = loading ? <div className="py-10 text-center">Loading...</div> : favorites.length === 0 ? EmptyState : List;

    // ---- Desktop Dialog ----
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-lg bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Heart className="h-6 w-6 text-red-500" fill="#ef4444" />
                                <DialogTitle className="text-lg font-semibold">Your Favorites</DialogTitle>
                            </div>
                            <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <DialogDescription className="text-muted-foreground mt-1 mb-0 text-center text-sm">
                            Quickly access all your favorite locations here.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2">{content}</div>
                    <DialogFooter>
                        <Button className="w-full cursor-pointer" variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // ---- Mobile Drawer ----
    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="mx-auto max-w-lg bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500" fill="#ef4444" />
                        <DrawerTitle className="text-lg font-semibold">Your Favorites</DrawerTitle>
                    </div>
                    <DrawerDescription className="text-muted-foreground mt-1 mb-0 text-center text-sm">
                        Quickly access all your favorite locations here.
                    </DrawerDescription>
                </DrawerHeader>
                <div className="mt-2 px-2">{content}</div>
                <DrawerFooter>
                    <DrawerClose asChild>
                        <Button className="w-full" variant="secondary">
                            Close
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
