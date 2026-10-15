import Destinations from '@/components/map/destinations';
import Favorites from '@/components/map/favorites';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMediaQuery } from '@/hooks/use-media-query';
import { destinationMapUrl, favoriteMapUrl, favoriteParkingResult } from '@/lib/saved-places';
import type { Favorite } from '@/types';
import type { DestinationResult, ParkingResult } from '@/types/destination';
import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SavedMapContext = {
    destination: DestinationResult | null;
    onDestinationSelect: (destination: DestinationResult) => void;
    onFavoriteSelect: (place: ParkingResult) => void;
};

type SavedDialogProps = { open: boolean; onClose: () => void; onReturnFocus?: () => void; mapContext?: SavedMapContext };

export default function SavedDialog({ open, onClose, onReturnFocus, mapContext }: SavedDialogProps) {
    const { t } = useTranslation('frontend/map/saved');
    const { t: tGlobal } = useTranslation('global/common');
    const desktop = useMediaQuery('(min-width: 768px)');
    const [tab, setTab] = useState('destinations');
    const openingDetail = useRef(false);
    const restoreFocus = (event: Event) => {
        event.preventDefault();
        if (!openingDetail.current) onReturnFocus?.();
        openingDetail.current = false;
    };

    const selectDestination = (destination: DestinationResult) => {
        onClose();
        if (mapContext) mapContext.onDestinationSelect(destination);
        else router.visit(destinationMapUrl(destination), { preserveState: false });
    };

    const selectFavorite = (favorite: Favorite) => {
        const place = favoriteParkingResult(favorite);
        if (!place) return;
        onClose();
        if (mapContext) {
            openingDetail.current = true;
            mapContext.onFavoriteSelect(place);
        } else router.visit(favoriteMapUrl(place), { preserveState: false });
    };

    const content = (
        <Tabs value={tab} onValueChange={setTab} className="min-h-0">
            <TabsList className="h-11 w-full shrink-0" aria-label={t('title')}>
                <TabsTrigger value="destinations">{t('destinations')}</TabsTrigger>
                <TabsTrigger value="favorites">{t('favorites')}</TabsTrigger>
            </TabsList>
            <div className="min-h-0 overflow-y-auto overscroll-contain py-2">
                <TabsContent value="destinations">
                    <Destinations open={open && tab === 'destinations'} destination={mapContext?.destination ?? null} onSelect={selectDestination} />
                </TabsContent>
                <TabsContent value="favorites">
                    <Favorites open={open && tab === 'favorites'} onSelect={selectFavorite} />
                </TabsContent>
            </div>
        </Tabs>
    );
    const close = (
        <Button variant="secondary" className="w-full" onClick={onClose}>
            {tGlobal('common.close')}
        </Button>
    );

    if (desktop)
        return (
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!value) onClose();
                }}
            >
                <DialogContent onCloseAutoFocus={restoreFocus} className="flex max-h-[85dvh] flex-col sm:max-w-lg">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{t('title')}</DialogTitle>
                        <DialogDescription>{t('description')}</DialogDescription>
                    </DialogHeader>
                    {content}
                    <DialogFooter className="shrink-0">{close}</DialogFooter>
                </DialogContent>
            </Dialog>
        );
    return (
        <Drawer
            open={open}
            onOpenChange={(value) => {
                if (!value) onClose();
            }}
        >
            <DrawerContent onCloseAutoFocus={restoreFocus} className="mx-auto max-h-[85dvh] max-w-lg">
                <DrawerHeader className="shrink-0">
                    <DrawerTitle>{t('title')}</DrawerTitle>
                    <DrawerDescription>{t('description')}</DrawerDescription>
                </DrawerHeader>
                <div className="flex min-h-0 flex-col px-4">{content}</div>
                <DrawerFooter className="shrink-0">{close}</DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
