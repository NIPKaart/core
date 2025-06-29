import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Navigation, ParkingSquare, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyUrl, ErrorBlock, LoadingSkeleton } from '../modal-shared/modal-parts';
import { OffstreetParkingDetail } from '../modal-shared/types';
import { OffstreetModalContent } from './modal-parts';

export type ParkingOffstreetModalProps = {
    spaceId: string;
    open: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
};

export default function ParkingOffstreetModal({ spaceId, open, onClose, latitude, longitude }: ParkingOffstreetModalProps) {
    const { t } = useTranslation('map-parking');
    const { t: tGlobal } = useTranslation('global');

    // Authorization and media query hooks
    const { user } = useAuthorization();
    const isLoggedIn = !!user;
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = useState<OffstreetParkingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedSpaceId, setCopiedSpaceId] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    useEffect(() => {
        if (open && spaceId) {
            setLoading(true);
            setError(null);
            fetch(`/api/parking-offstreet/${spaceId}`)
                .then((res) => {
                    if (!res.ok) throw new Error('Not found');
                    return res.json();
                })
                .then(setData)
                .catch(() => setError('Could not load location details'))
                .finally(() => setLoading(false));
        } else {
            setData(null);
            setError(null);
        }
    }, [spaceId, open]);

    useEffect(() => {
        if (open) {
            setCopiedSpaceId(false);
            setCopiedShare(false);
        }
    }, [open, spaceId]);

    const descriptionText = t('offstreet.modal.description');

    // Desktop - Dialog variant
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <ParkingSquare className="h-6 w-6 text-orange-400" />
                                {data?.name}
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_offstreet" />}
                                <TooltipProvider>
                                    <Tooltip open={copiedShare} onOpenChange={() => setCopiedShare(false)} delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                className="cursor-pointer"
                                                size="icon"
                                                variant="ghost"
                                                aria-label="Share"
                                                onClick={() => data && copyUrl(data, latitude, longitude, setCopiedShare)}
                                            >
                                                <Share2 className="h-5 w-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center">
                                            {t('common.table.copied')}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogDescription className="mb-0 text-center">{descriptionText}</DialogDescription>
                    <div className="overflow-y-auto">
                        {loading ? (
                            <LoadingSkeleton />
                        ) : error ? (
                            <ErrorBlock />
                        ) : (
                            <>
                                {data && (
                                    <OffstreetModalContent
                                        data={data}
                                        latitude={latitude}
                                        longitude={longitude}
                                        isLoggedIn={isLoggedIn}
                                        copiedSpaceId={copiedSpaceId}
                                        setCopiedSpaceId={setCopiedSpaceId}
                                    />
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter className="flex flex-row justify-between gap-2">
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
                            target="_blank"
                            rel="noopener"
                            tabIndex={0}
                            aria-disabled={false}
                        >
                            <Button
                                className="flex cursor-pointer items-center gap-2 bg-orange-500 text-white hover:bg-orange-600"
                                title="Go to Google Maps"
                            >
                                <Navigation className="mr-1 h-4 w-4" />
                                {t('common.buttons.navigate')}
                            </Button>
                        </a>
                        <Button className="cursor-pointer" variant="secondary" onClick={onClose}>
                            {tGlobal('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile - Drawer variant
    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="mx-auto max-w-xl bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex w-full items-center justify-between gap-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                            <ParkingSquare className="h-6 w-6 text-orange-400" />
                            {data?.name}
                        </DrawerTitle>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_offstreet" />}
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Share"
                                onClick={() => data && copyUrl(data, latitude, longitude, setCopiedShare)}
                            >
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DrawerHeader>
                <div className="overflow-y-auto">
                    <DrawerDescription className="mb-0 text-center text-sm text-muted-foreground">{descriptionText}</DrawerDescription>
                    <div className="px-4 sm:px-6">
                        {loading ? (
                            <LoadingSkeleton />
                        ) : error ? (
                            <ErrorBlock />
                        ) : (
                            <>
                                {data && (
                                    <OffstreetModalContent
                                        data={data}
                                        latitude={latitude}
                                        longitude={longitude}
                                        isLoggedIn={isLoggedIn}
                                        copiedSpaceId={copiedSpaceId}
                                        setCopiedSpaceId={setCopiedSpaceId}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
                <DrawerFooter className="flex flex-row gap-2">
                    <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
                        target="_blank"
                        rel="noopener"
                        tabIndex={0}
                        aria-disabled={false}
                        className="flex-1"
                    >
                        <Button
                            className="flex w-full cursor-pointer items-center gap-2 bg-orange-500 text-white hover:bg-orange-600"
                            title="Go to Google Maps"
                        >
                            <Navigation className="mr-1 h-4 w-4" />
                            {t('common.buttons.navigate')}
                        </Button>
                    </a>
                    <DrawerClose asChild>
                        <Button variant="secondary" className="flex-1">
                            {tGlobal('common.close')}
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
