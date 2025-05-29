import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ParkingConfirmForm } from '@/pages/frontend/form/form-confirm-location';
import clsx from 'clsx';
import { AlarmClock, Eye, FileText, Info as InfoIcon, Loader2, MapPin, MapPinCheckInside, Navigation, Share2, Users, X } from 'lucide-react';
import * as React from 'react';
import { FavoriteButton } from '../frontend/button/favorite';
import { Separator } from '../ui/separator';
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
    is_favorited: boolean;
    confirmed_today: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: string | null;
};

type ParkingSpotModalProps = {
    spotId: string | null;
    open: boolean;
    onClose: () => void;
    latitude: number | null;
    longitude: number | null;
    confirmationStatusOptions: Record<string, string>;
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
    if (h && m) return `${h} ${h === 1 ? 'hour' : 'hours'} ${m} min`;
    if (h) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    if (m) return `${m} min`;
    return 'Unlimited';
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

export function ConfirmedBadge({ count, className = '' }: { count: number; className?: string }) {
    if (!count || count <= 0) return null;
    return (
        <div
            className={clsx(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm',
                // Light mode
                'border-green-200 bg-green-50 text-green-800',
                // Dark mode
                'dark:border-green-900 dark:bg-green-950/80 dark:text-green-300',
                className,
            )}
            style={{
                minWidth: 70,
                justifyContent: 'center',
                letterSpacing: '.01em',
            }}
        >
            <Users className="mr-1 h-4 w-4 text-green-600 dark:text-green-300" />
            {count}x confirmed
        </div>
    );
}

export default function ParkingSpotModal({ spotId, open, onClose, latitude, longitude, confirmationStatusOptions }: ParkingSpotModalProps) {
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
            setCopiedLocationId(false);
            setCopiedShare(false);
            setTab('info');
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
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-orange-400" />
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
                <Button variant="outline" onClick={() => window.location.reload()}>
                    Try again
                </Button>
            </div>
        );
    }

    function MainInfo() {
        if (!data) return null;
        return (
            <div className="mx-auto my-2 flex w-full max-w-lg flex-col items-center gap-2">
                <img
                    src={getOrientationIllustration(data.orientation)}
                    alt="Orientation"
                    className="max-h-28 w-auto object-contain"
                    style={{ aspectRatio: '3/1', maxWidth: 300 }}
                />
                {/* Centered address + badge */}
                <div className="flex w-full items-center justify-center gap-2">
                    <MapPin className="h-5 w-5 flex-shrink-0 text-orange-400" aria-label="Location" />
                    <span className="block truncate text-lg font-bold">
                        {data.street}
                        {data.street ? ',' : ''} {data.municipality}
                    </span>
                    {data.confirmations_count?.confirmed ? <ConfirmedBadge count={data.confirmations_count.confirmed} /> : null}
                </div>
                <div className="w-full truncate px-2 text-center text-xs text-zinc-500">
                    {data.province}
                    {data.country ? `, ${data.country}` : ''}
                </div>
            </div>
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

    function InfoTable() {
        if (!data) return null;

        const alwaysRows = [
            {
                label: 'Street',
                value: data.street || '-',
            },
            {
                label: <span className="flex items-center gap-1">Max. parking time</span>,
                value:
                    typeof data.parking_time === 'number' && data.parking_time > 0 ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800 shadow-sm transition-colors dark:border-orange-900 dark:bg-orange-950/70 dark:text-orange-100">
                                        <AlarmClock className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                        {formatParkingTime(data.parking_time)}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                    Don’t forget your parking disc!
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <span className="text-zinc-400 italic">Unlimited</span>
                    ),
            },
            { label: 'Orientation', value: data.orientation || '-' },
            { label: 'Municipality', value: data.municipality || '-' },
            {
                label: 'Municipal regulations',
                value: data.rule_url ? (
                    <a href={data.rule_url} target="_blank" rel="noopener" className="text-orange-600 underline">
                        Website
                    </a>
                ) : (
                    <span className="text-zinc-400 italic">No information</span>
                ),
            },
            {
                label: 'Last confirmed',
                value: data.last_confirmed_at ? (
                    new Date(data.last_confirmed_at).toLocaleDateString()
                ) : (
                    <span className="text-zinc-400 italic">Never</span>
                ),
            },
        ];

        const privateRows = [
            {
                label: 'Area',
                value: data.amenity || '-',
            },
            {
                label: 'Location ID',
                value: isDesktop ? (
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
                ),
            },
            {
                label: 'Added on',
                value: new Date(data.created_at).toLocaleDateString(),
            },
        ];

        const rows = isLoggedIn ? [...alwaysRows, ...privateRows] : alwaysRows;

        return (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <Table className="w-full">
                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={i} className={i % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-900'}>
                                <TableCell className="w-1/3 px-4 py-2 font-medium text-zinc-500">{row.label}</TableCell>
                                <TableCell className="px-4 py-2">{row.value}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    // Main component for the parking spot modal
    function InfoTab() {
        return (
            <>
                <MainInfo />
                <ActionButtons />
                <InfoTable />
            </>
        );
    }

    // Confirm tab for logged-in users to confirm the parking spot
    function ConfirmTab() {
        if (!data) return null;
        return (
            <div className="py-3">
                <ParkingConfirmForm
                    spotId={data.id}
                    onConfirmed={() => {
                        fetch(`/api/parking-spots/${spotId}`)
                            .then((res) => res.json())
                            .then(setData);
                    }}
                    confirmationStatusOptions={confirmationStatusOptions}
                    confirmedToday={data.confirmed_today}
                />
            </div>
        );
    }

    // Description tab to show additional information about the parking spot
    function DescriptionTab() {
        if (!data?.description) return null;
        return (
            <div className="relative mb-2 rounded-xl border border-orange-100 bg-orange-50/70 px-6 py-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/60">
                <div className="absolute top-0 left-0 h-full w-1 rounded-tl-xl rounded-bl-xl bg-orange-400" />
                <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
                    <div>
                        <div className="mb-1 text-base font-semibold text-orange-800 dark:text-orange-200">Description</div>
                        <div className="text-sm text-orange-900 dark:text-orange-100">{data.description}</div>
                    </div>
                </div>
            </div>
        );
    }

    function TabBlock() {
        if (!isLoggedIn && !data?.description) return <InfoTab />;
        return (
            <>
                <MainInfo />
                <ActionButtons />
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
                        <InfoTable />
                    </TabsContent>
                    <TabsContent value="confirm">{isLoggedIn && <ConfirmTab />}</TabsContent>
                    <TabsContent value="description">{data?.description && <DescriptionTab />}</TabsContent>
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
                                {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_spot" />}
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
                        <DialogDescription className="text-muted-foreground mb-0 text-center text-sm">{descriptionText}</DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 max-h-[70vh] overflow-y-auto">{loading ? <LoadingSkeleton /> : error ? <ErrorBlock /> : <TabBlock />}</div>
                    <DialogFooter className="flex flex-row justify-between gap-2 pt-4">
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
                            {isLoggedIn && data?.id && <FavoriteButton initial={!!data.is_favorited} id={data.id} type="parking_spot" />}
                            <Button size="icon" variant="ghost" aria-label="Share" onClick={copyUrl}>
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DrawerHeader>
                <div className="max-h-[70vh] overflow-y-auto">
                    <DrawerDescription className="text-muted-foreground mb-2 text-center text-sm">{descriptionText}</DrawerDescription>
                    <div className="px-4 sm:px-6">{loading ? <LoadingSkeleton /> : error ? <ErrorBlock /> : <TabBlock />}</div>
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
