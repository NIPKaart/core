import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Landmark, Share2, X } from 'lucide-react';
import * as React from 'react';
import { getMunicipalInfoRows } from '../modal-shared/info-table';
import { ActionButtons, InfoTable, MainInfo } from '../modal-shared/modal-parts';
import type { MunicipalParkingDetail } from '../modal-shared/types';

export type ParkingMunicipalModalProps = {
    spaceId: string | null;
    open: boolean;
    onClose: () => void;
    latitude: number | null;
    longitude: number | null;
};

export default function ParkingMunicipalModal({ spaceId, open, onClose, latitude, longitude }: ParkingMunicipalModalProps) {
    const { user } = useAuthorization();
    const isLoggedIn = !!user;
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = React.useState<MunicipalParkingDetail | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [copiedLocationId, setCopiedLocationId] = React.useState(false);
    const [copiedShare, setCopiedShare] = React.useState(false);

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (open) {
            setCopiedLocationId(false);
            setCopiedShare(false);
        }
    }, [open, spaceId]);

    function copyLocationId(e: React.MouseEvent) {
        e.stopPropagation();
        if (data?.id) {
            navigator.clipboard.writeText(data.id);
            setCopiedLocationId(true);
            setTimeout(() => setCopiedLocationId(false), 1400);
        }
    }

    function getShareUrl(lat: number | null, lng: number | null, zoom = 18) {
        if (lat !== null && lng !== null) {
            return `${window.location.origin}${window.location.pathname}#${zoom}/${lat.toFixed(5)}/${lng.toFixed(5)}`;
        }
        return window.location.href;
    }

    function copyUrl() {
        const shareUrl = getShareUrl(latitude, longitude, 18);
        navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 1400);
    }

    function LoadingSkeleton() {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
                <div className="mb-2 h-6 w-6 animate-spin text-orange-400" />
                <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-20 w-full max-w-xs animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
        );
    }

    function ErrorBlock() {
        return <div className="flex flex-col items-center justify-center gap-4 py-10 text-red-600">Could not load location details.</div>;
    }

    const descriptionText = 'This is an official parking space provided by the municipality. Details are based on open data.';

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <Landmark className="h-6 w-6 text-orange-400" />
                                Municipal Parking Space
                            </DialogTitle>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_municipal" />}
                                <TooltipProvider>
                                    <Tooltip open={copiedShare} onOpenChange={() => setCopiedShare(false)} delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
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
                    <DialogDescription className="mb-0 text-center text-sm text-muted-foreground">{descriptionText}</DialogDescription>
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
                                    <InfoTable rows={getMunicipalInfoRows(data, isLoggedIn, copiedLocationId, setCopiedLocationId, copyLocationId)} />
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter className="flex flex-row justify-between gap-2">
                        <Button className="cursor-pointer" variant="secondary" onClick={onClose}>
                            Close
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
                            <Button size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
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
                                {data && <MainInfo data={data} type="municipal" />}
                                <ActionButtons latitude={latitude} longitude={longitude} />
                                {data && (
                                    <InfoTable rows={getMunicipalInfoRows(data, isLoggedIn, copiedLocationId, setCopiedLocationId, copyLocationId)} />
                                )}
                            </>
                        )}
                    </div>
                </div>
                <DrawerFooter className="flex flex-row gap-2">
                    <DrawerClose asChild>
                        <Button variant="secondary" className="flex-1">
                            Close
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
