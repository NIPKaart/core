import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Eye, FileText, Info as InfoIcon, MapPinCheckInside, MapPinned, Share2, X } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCommunityInfoRows } from '../modal-shared/info-table';
import { ActionButtons, copyLocationId, copyUrl, ErrorBlock, InfoTable, LoadingSkeleton, MainInfo } from '../modal-shared/modal-parts';
import type { ParkingSpaceDetail } from '../modal-shared/types';
import { ConfirmTab, DescriptionTab } from './modal-parts';

export type ParkingSpaceModalProps = {
    spaceId: string;
    open: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
    confirmationStatusOptions: Record<string, string>;
};

export default function ParkingSpaceModal({ spaceId, open, onClose, latitude, longitude, confirmationStatusOptions }: ParkingSpaceModalProps) {
    const { t } = useTranslation('frontend/map/modals');
    const { t: tGlobal } = useTranslation('frontend/global');

    // Authorization and media query hooks
    const { can, user } = useAuthorization();
    const isLoggedIn = !!user;
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = useState<ParkingSpaceDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedSpaceId, setCopiedSpaceId] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);
    const [tab, setTab] = React.useState('info');

    useEffect(() => {
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

    useEffect(() => {
        if (open) {
            setCopiedSpaceId(false);
            setCopiedShare(false);
            setTab('info');
        }
    }, [open, spaceId]);

    function TabBlock() {
        if (!isLoggedIn && !data?.description)
            return (
                <>
                    {data && <MainInfo data={data} type="community" />}
                    <ActionButtons latitude={latitude} longitude={longitude} />
                    {data && (
                        <InfoTable
                            rows={getCommunityInfoRows(
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
            );
        return (
            <>
                {data && <MainInfo data={data} type="community" />}
                <ActionButtons latitude={latitude} longitude={longitude} />
                <Separator />
                <Tabs value={tab} onValueChange={setTab} className="mt-4 w-full">
                    <TabsList className="mb-2 flex w-full">
                        <TabsTrigger
                            value="info"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                        >
                            <InfoIcon className="h-4 w-4" />
                            {t('community.tabs.info')}
                        </TabsTrigger>
                        {isLoggedIn && (
                            <TabsTrigger
                                value="confirm"
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                            >
                                <MapPinCheckInside className="h-4 w-4" />
                                {t('community.tabs.confirm')}
                            </TabsTrigger>
                        )}
                        {data?.description && (
                            <TabsTrigger
                                value="description"
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                            >
                                <FileText className="h-4 w-4" />
                                {t('community.tabs.description')}
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="info">
                        {data && (
                            <InfoTable
                                rows={getCommunityInfoRows(
                                    data,
                                    isLoggedIn,
                                    copiedSpaceId,
                                    setCopiedSpaceId,
                                    (e) => copyLocationId(data, setCopiedSpaceId, e),
                                    t,
                                )}
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

    const descriptionText = t('community.modal.description');

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <MapPinned className="h-6 w-6 text-orange-400" />
                                {t('community.modal.title')}
                            </DialogTitle>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_space" />}
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
                            {tGlobal('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile - Drawer variant
    return (
        <Drawer open={open} onOpenChange={(value) => !value && onClose()} modal={false}>
            <DrawerContent className="mx-auto max-w-xl bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex w-full items-center justify-between gap-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                            <MapPinned className="h-6 w-6 text-orange-400" />
                            Community Parking Space
                        </DrawerTitle>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_space" />}
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
                            {tGlobal('common.close')}
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
