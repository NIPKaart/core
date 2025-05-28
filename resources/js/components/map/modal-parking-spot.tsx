import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Eye, MapPin, Navigation, Share2, X } from 'lucide-react';
import * as React from 'react';
import { FavoriteButton } from '../frontend/button/favorite';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type LocationDetail = {
    id: string;
    orientation: string | null;
    municipality: string | null;
    province: string | null;
    country: string | null;
    street: string | null;
    amenity?: string | null;
    description?: string | null;
    rule_url?: string | null;
    parking_time?: number | null;
    created_at: string;
    is_favorited?: boolean;
};

type ParkingSpotModalProps = {
    spotId: string | null;
    open: boolean;
    onClose: () => void;
    latitude: number | null;
    longitude: number | null;
};

function getOrientationIllustration(orientation?: string | null) {
    if (!orientation) return '/assets/images/car-illu.svg';
    const key = orientation.toLowerCase();
    if (key === 'perpendicular') return '/assets/images/orientation/perpendicular.png';
    if (key === 'parallel') return '/assets/images/orientation/parallel.png';
    if (key === 'angle') return '/assets/images/orientation/angle.png';
    return '/assets/images/car-illu.svg';
}

function formatParkingTime(minutes?: number | null) {
    if (!minutes) return 'Unlimited';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h} hour ${m} min`;
    if (h) return `${h} hour`;
    return `${m} min`;
}

function getGoogleMapsUrl(lat: number | null, lng: number | null): string {
    if (lat !== null && lng !== null) {
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return 'https://maps.google.com/';
}

function getStreetViewUrl(lat: number | null, lng: number | null): string {
    if (lat !== null && lng !== null) {
        return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
    }
    return 'https://maps.google.com/';
}

export default function ParkingSpotModal({ spotId, open, onClose, latitude, longitude }: ParkingSpotModalProps) {
    const { can, user } = useAuthorization();
    const isLoggedIn = !!user;

    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = React.useState<LocationDetail | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [accordionOpen, setAccordionOpen] = React.useState<string | undefined>(undefined);
    const [copiedLocationId, setCopiedLocationId] = React.useState(false);
    const [copiedShare, setCopiedShare] = React.useState(false);

    React.useEffect(() => {
        if (open && spotId) {
            setLoading(true);
            setError(null);
            fetch(`/api/parking-spots/${spotId}`)
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
    }, [spotId, open]);

    React.useEffect(() => {
        if (open) {
            setAccordionOpen(undefined);
            setCopiedLocationId(false);
            setCopiedShare(false);
        }
    }, [open, spotId]);

    function copyLocationId(e: React.MouseEvent) {
        e.stopPropagation();
        if (data?.id) {
            navigator.clipboard.writeText(data.id);
            setCopiedLocationId(true);
            setTimeout(() => setCopiedLocationId(false), 1400);
        }
    }

    function copyUrl() {
        const shareUrl = getShareUrl(latitude, longitude, 18);
        navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 1400);
    }

    function getShareUrl(lat: number | null, lng: number | null, zoom = 18) {
        if (lat !== null && lng !== null) {
            return `${window.location.origin}${window.location.pathname}#${zoom}/${lat.toFixed(5)}/${lng.toFixed(5)}`;
        }
        return window.location.href;
    }

    function MainInfo() {
        if (!data) return null;
        return (
            <>
                <div className="mb-3 flex w-full items-center justify-center">
                    <div className="flex w-full justify-center" style={{ maxHeight: 120 }}>
                        <img
                            src={getOrientationIllustration(data.orientation)}
                            alt="Orientation"
                            className="max-h-40 w-full object-contain"
                            style={{ aspectRatio: '3/1', maxWidth: 440 }}
                        />
                    </div>
                </div>
                <div className="mb-1 text-center">
                    <span className="text-base font-bold">
                        {data.street ? data.street + ',' : ''} {data.municipality}
                    </span>
                    <br />
                    <span className="text-xs text-zinc-500">
                        {data.province}
                        {data.country ? `, ${data.country}` : ''}
                    </span>
                </div>
                {typeof data.parking_time === 'number' && data.parking_time > 0 && (
                    <div className="mb-2 rounded bg-orange-50 px-2 py-1 text-center text-xs text-orange-700 dark:bg-orange-950/60 dark:text-orange-200">
                        At this location you may park for a maximum of <strong>{formatParkingTime(data.parking_time)}</strong>. Don’t forget to
                        display a <strong>parking disc</strong>.
                    </div>
                )}
            </>
        );
    }

    function ActionButtons() {
        const hasCoords = latitude !== null && longitude !== null;

        return (
            <div className="my-3 flex flex-row justify-center gap-2">
                <a
                    href={getGoogleMapsUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener"
                    tabIndex={hasCoords ? 0 : -1}
                    aria-disabled={!hasCoords}
                >
                    <Button size="sm" className="cursor-pointer rounded-md bg-orange-500 text-white hover:bg-orange-600" disabled={!hasCoords}>
                        <Navigation className="mr-1 h-4 w-4" /> Navigate
                    </Button>
                </a>
                <a
                    href={getStreetViewUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener"
                    tabIndex={hasCoords ? 0 : -1}
                    aria-disabled={!hasCoords}
                >
                    <Button variant="outline" size="sm" className="cursor-pointer rounded-md" disabled={!hasCoords}>
                        <Eye className="mr-1 h-4 w-4" /> Streetview
                    </Button>
                </a>
            </div>
        );
    }

    function CompactTable() {
        if (!data) return null;
        return (
            <div className="my-3">
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell className="w-1/3 font-medium text-zinc-500">Maximum parking time</TableCell>
                            <TableCell>
                                {typeof data.parking_time === 'number' && data.parking_time > 0 ? formatParkingTime(data.parking_time) : 'Unlimited'}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-zinc-500">Orientation</TableCell>
                            <TableCell>{data.orientation || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-zinc-500">Municipal regulations</TableCell>
                            <TableCell>
                                {data.rule_url ? (
                                    <a href={data.rule_url} target="_blank" rel="noopener" className="text-orange-600 underline">
                                        Website
                                    </a>
                                ) : (
                                    <span className="text-zinc-400 italic">No information</span>
                                )}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-zinc-500">Added on</TableCell>
                            <TableCell>{new Date(data.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    }

    function MoreInfoAccordion() {
        if (!data) return null;
        return (
            <Accordion
                type="single"
                collapsible
                className="mt-4 w-full"
                value={accordionOpen}
                onValueChange={(v) => setAccordionOpen(v || undefined)}
            >
                <AccordionItem value="details">
                    <AccordionTrigger className="cursor-pointer rounded-md border border-zinc-200 bg-white px-4 py-3 font-medium text-orange-700 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                        More information
                    </AccordionTrigger>
                    <AccordionContent>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="w-1/3 font-medium text-zinc-500">Municipality</TableCell>
                                    <TableCell>{data.municipality || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium text-zinc-500">Province</TableCell>
                                    <TableCell>{data.province || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium text-zinc-500">Country</TableCell>
                                    <TableCell>{data.country || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium text-zinc-500">Area</TableCell>
                                    <TableCell>{data.amenity || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium text-zinc-500">Location ID</TableCell>
                                    <TableCell>
                                        {isDesktop ? (
                                            <TooltipProvider>
                                                <Tooltip open={copiedLocationId} onOpenChange={() => setCopiedLocationId(false)} delayDuration={0}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="link"
                                                            onClick={copyLocationId}
                                                            className="cursor-pointer p-0 text-orange-600"
                                                            tabIndex={0}
                                                            type="button"
                                                            aria-label="Copy location ID"
                                                        >
                                                            {data.id}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" align="center">
                                                        Copied!
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="link"
                                                onClick={copyLocationId}
                                                className="cursor-pointer p-0 text-orange-600"
                                                tabIndex={0}
                                                type="button"
                                                aria-label="Copy location ID"
                                            >
                                                {data.id}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        {data.description && (
                            <div className="mt-2 rounded-md bg-zinc-50 p-3 text-xs shadow-inner dark:bg-orange-950/60">
                                <div className="mb-1 font-semibold">Description</div>
                                <div>{data.description}</div>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }

    function Content({ withPadding = true }: { withPadding?: boolean }) {
        if (loading) return <div className="py-4 text-center">Loading...</div>;
        if (error) return <div className="py-2 text-red-500">{error}</div>;
        if (!data) return null;

        return (
            <div className={withPadding ? 'px-4' : ''}>
                <MainInfo />
                <ActionButtons />
                <CompactTable />
                <MoreInfoAccordion />
            </div>
        );
    }

    const descriptionText = 'Here you will find all the details of this parking location.';

    // ---- Desktop Dialog ----
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent showClose={false} className="max-w-xl bg-white sm:rounded-xl dark:bg-zinc-950">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-6 w-6 text-orange-400" />
                                <DialogTitle className="text-lg font-semibold">Parking location</DialogTitle>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_spot" />}
                                {isDesktop ? (
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
                                ) : (
                                    <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
                                        <Share2 className="h-5 w-5" />
                                    </Button>
                                )}
                                <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <DialogDescription className="text-muted-foreground mb-0 text-center text-sm">{descriptionText}</DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 max-h-[70vh] overflow-y-auto">
                        <Content withPadding={true} />
                    </div>
                    <DialogFooter className="flex flex-row justify-between gap-2">
                        {can('parking-spot.view') && data?.id && (
                            <a href={route('app.parking-spots.show', { id: data.id })} target="_blank" rel="noopener">
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

    // ---- Mobile Drawer ----
    return (
        <Drawer open={open} onOpenChange={onClose}>
            <DrawerContent className="mx-auto max-w-xl bg-white dark:bg-zinc-950">
                <DrawerHeader>
                    <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-6 w-6 text-orange-400" />
                            <DrawerTitle className="text-lg font-semibold">Parking location</DrawerTitle>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_spot" />}
                            <Button size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DrawerHeader>
                <div className="mt-2 max-h-[68vh] overflow-y-auto">
                    <DrawerDescription className="text-muted-foreground mb-2 text-center text-sm">{descriptionText}</DrawerDescription>
                    <Content withPadding={true} />
                </div>
                <DrawerFooter className="flex flex-row gap-2">
                    {can('parking-spot.view') && data?.id && (
                        <a href={route('app.parking-spots.show', { id: data.id })} target="_blank" rel="noopener" className="flex-1">
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
