import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Eye, FileText, Info as InfoIcon, MapPin, MapPinCheckInside, Share2, X } from 'lucide-react';
import * as React from 'react';
import { ActionButtons, ConfirmTab, DescriptionTab, InfoTable, MainInfo } from './modal-parts';
import { LocationDetail, ParkingSpaceModalProps } from './types';

export default function ParkingSpaceModal({ spaceId, open, onClose, latitude, longitude, confirmationStatusOptions }: ParkingSpaceModalProps) {
    const { can, user } = useAuthorization();
    const isLoggedIn = !!user;
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = React.useState<LocationDetail | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [copiedLocationId, setCopiedLocationId] = React.useState(false);
    const [copiedShare, setCopiedShare] = React.useState(false);
    const [tab, setTab] = React.useState('info');

    React.useEffect(() => {
        if (open && spaceId) {
            setLoading(true);
            setError(null);
            fetch(`/api/parking-spaces/${spaceId}`)
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
            setTab('info');
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
                <div className="mb-2 h-6 w-6 animate-spin text-orange-400">{/* Loader */}</div>
                <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-20 w-full max-w-xs animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
        );
    }

    function ErrorBlock() {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-red-600">
                Could not load location details.
                <br />
                <button
                    className="rounded bg-zinc-100 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-zinc-200 dark:bg-zinc-900"
                    onClick={() => window.location.reload()}
                >
                    Try again
                </button>
            </div>
        );
    }

    function TabBlock() {
        if (!isLoggedIn && !data?.description)
            return (
                <>
                    {data && <MainInfo data={data} />}
                    <ActionButtons latitude={latitude} longitude={longitude} />
                    {data && (
                        <InfoTable
                            data={data}
                            isLoggedIn={isLoggedIn}
                            copiedLocationId={copiedLocationId}
                            setCopiedLocationId={setCopiedLocationId}
                            copyLocationId={copyLocationId}
                        />
                    )}
                </>
            );
        return (
            <>
                {data && <MainInfo data={data} />}
                <ActionButtons latitude={latitude} longitude={longitude} />
                <Separator />
                <Tabs value={tab} onValueChange={setTab} className="mt-4 w-full">
                    <TabsList className="mb-2 flex w-full">
                        <TabsTrigger
                            value="info"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                        >
                            <InfoIcon className="h-4 w-4" />
                            Info
                        </TabsTrigger>
                        {isLoggedIn && (
                            <TabsTrigger
                                value="confirm"
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                            >
                                <MapPinCheckInside className="h-4 w-4" />
                                Confirm
                            </TabsTrigger>
                        )}
                        {data?.description && (
                            <TabsTrigger
                                value="description"
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                            >
                                <FileText className="h-4 w-4" />
                                Description
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="info">
                        {data && (
                            <InfoTable
                                data={data}
                                isLoggedIn={isLoggedIn}
                                copiedLocationId={copiedLocationId}
                                setCopiedLocationId={setCopiedLocationId}
                                copyLocationId={copyLocationId}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="confirm">
                        {isLoggedIn && data && (
                            <ConfirmTab
                                data={data}
                                confirmationStatusOptions={confirmationStatusOptions}
                                onConfirmed={() => {
                                    fetch(`/api/parking-spaces/${spaceId}`)
                                        .then((res) => res.json())
                                        .then(setData);
                                }}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="description">{data?.description && <DescriptionTab description={data.description} />}</TabsContent>
                </Tabs>
            </>
        );
    }

    const descriptionText = 'Here you will find all the details of this parking location.';

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <MapPin className="h-6 w-6 text-orange-400" />
                                Parking location
                            </DialogTitle>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_space" />}
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
                        {/* <DialogDescription className="text-muted-foreground mb-0 text-center text-sm">{descriptionText}</DialogDescription> */}
                    </DialogHeader>
                    <DialogDescription className="mb-0 text-center text-sm text-muted-foreground">{descriptionText}</DialogDescription>
                    <div className="overflow-y-auto">{loading ? <LoadingSkeleton /> : error ? <ErrorBlock /> : <TabBlock />}</div>
                    <DialogFooter className="flex flex-row justify-between gap-2">
                        {can('parking-space.view') && data?.id && (
                            <a href={route('app.parking-spaces.show', { id: data.id })} target="_blank" rel="noopener">
                                <Button variant="outline" className="flex cursor-pointer items-center gap-2" title="Go to admin page">
                                    <Eye className="h-4 w-4" />
                                    Show
                                </Button>
                            </a>
                        )}
                        <Button className="cursor-pointer" variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile Drawer variant
    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="mx-auto max-w-xl bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex w-full items-center justify-between gap-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                            <MapPin className="h-6 w-6 text-orange-400" />
                            Parking location
                        </DrawerTitle>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_space" />}
                            <Button size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DrawerHeader>
                <div className="overflow-y-auto">
                    <DrawerDescription className="mb-0 text-center text-sm text-muted-foreground">{descriptionText}</DrawerDescription>
                    <div className="px-4 sm:px-6">{loading ? <LoadingSkeleton /> : error ? <ErrorBlock /> : <TabBlock />}</div>
                </div>
                <DrawerFooter className="flex flex-row gap-2">
                    {can('parking-space.view') && data?.id && (
                        <a href={route('app.parking-spaces.show', { id: data.id })} target="_blank" rel="noopener" className="flex-1">
                            <Button variant="outline" className="flex w-full items-center gap-2" title="Go to admin page">
                                <Eye className="h-4 w-4" />
                                Show
                            </Button>
                        </a>
                    )}
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
