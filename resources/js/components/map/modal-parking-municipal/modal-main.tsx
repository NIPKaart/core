import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Landmark, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMunicipalInfoRows } from '../modal-shared/info-table';
import { ActionButtons, copyLocationId, copyUrl, ErrorBlock, InfoTable, LoadingSkeleton, MainInfo } from '../modal-shared/modal-parts';
import type { MunicipalParkingDetail } from '../modal-shared/types';

export type ParkingMunicipalModalProps = {
    spaceId: string;
    open: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
};

export default function ParkingMunicipalModal({ spaceId, open, onClose, latitude, longitude }: ParkingMunicipalModalProps) {
    const { t } = useTranslation('map-parking');
    const { t: tGlobal } = useTranslation('global');

    // Authorization and media query hooks
    const { user } = useAuthorization();
    const isLoggedIn = !!user;
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = useState<MunicipalParkingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedSpaceId, setCopiedSpaceId] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    useEffect(() => {
        if (open && spaceId) {
            setLoading(true);
            setError(null);
            fetch(`/api/parking-municipal/${spaceId}`)
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

    const descriptionText = t('municipal.modal.description');

    // Desktop - Dialog variant
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Landmark className="h-6 w-6 text-orange-400" />
                                {t('municipal.modal.title')}
                            </DialogTitle>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_municipal" />}
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
                                            Copied!
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
                                {data && <MainInfo data={data} type="municipal" />}
                                <ActionButtons latitude={latitude} longitude={longitude} />
                                {data && (
                                    <InfoTable
                                        rows={getMunicipalInfoRows(
                                            data,
                                            isLoggedIn,
                                            copiedSpaceId,
                                            setCopiedSpaceId,
                                            (e) => copyLocationId(data, setCopiedSpaceId, e),
                                            t,
                                        )}
                                    />
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter className="flex flex-row justify-between gap-2">
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
                            <Landmark className="h-6 w-6 text-orange-400" />
                            Municipal Parking Space
                        </DrawerTitle>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_municipal" />}
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
                    <div className="px-4 sm:px-6">
                        <DrawerDescription className="mb-0 text-center text-sm text-muted-foreground">{descriptionText}</DrawerDescription>
                        {loading ? (
                            <LoadingSkeleton />
                        ) : error ? (
                            <ErrorBlock />
                        ) : (
                            <>
                                {data && <MainInfo data={data} type="municipal" />}
                                <ActionButtons latitude={latitude} longitude={longitude} />
                                {data && (
                                    <InfoTable
                                        rows={getMunicipalInfoRows(
                                            data,
                                            isLoggedIn,
                                            copiedSpaceId,
                                            setCopiedSpaceId,
                                            (e) => copyLocationId(data, setCopiedSpaceId, e),
                                            t,
                                        )}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
                <DrawerFooter className="flex flex-row gap-2">
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
