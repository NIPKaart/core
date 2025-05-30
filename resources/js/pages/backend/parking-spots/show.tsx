import Banner, { BannerVariant } from '@/components/banner';
import LocationMarkerCard from '@/components/map/card-location-marker';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpotActionDialog } from '@/hooks/use-dialog-spot-action';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpot, ParkingSpotConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Compass, Copy, Edit, Globe, Hash, Home, Landmark, MapPin, Server, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spots', href: route('app.parking-spots.index') },
    { title: 'Show', href: route('app.parking-spots.show', { id: ':id' }) },
];

type PageProps = {
    parkingSpot: ParkingSpot;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
    nearbySpots: ParkingSpot[];
    recentConfirmations: ParkingSpotConfirmation[];
};

export default function Show({ parkingSpot, selectOptions, nearbySpots, recentConfirmations }: PageProps) {
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpotActionDialog();

    const statusOpt = selectOptions.statuses.find((s) => s.value === parkingSpot.status)!;
    const variantMap: Record<string, BannerVariant> = {
        pending: 'primary',
        approved: 'success',
        rejected: 'error',
    };
    const variant = variantMap[parkingSpot.status] ?? 'info';

    function copyToClipboard(val: string) {
        navigator.clipboard.writeText(val);
        toast.success('Copied to clipboard');
    }

    const ipAddress = parkingSpot.ip_address ?? '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spot" />
            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Parking spot ({parkingSpot.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.parking-spots.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    {can('parking-spot.update') && (
                        <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                            <Link href={route('app.parking-spots.edit', { id: parkingSpot.id })}>
                                <Edit className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    )}

                    {can('parking-spot.delete') && (
                        <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog('delete', parkingSpot)}>
                            <Trash2 className="h-4 w-4" />
                            Move to Trash
                        </Button>
                    )}
                </div>
            </div>

            {/* Banner Notification */}
            <div className="px-4 sm:px-6">
                <Banner variant={variant} title={statusOpt.label} description={statusOpt.description} />
            </div>

            {/* 2×2 grid met auto-rows-min */}
            <div className="grid auto-rows-min grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                {/* Card 1: Details */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Details</h2>
                        <p className="text-muted-foreground text-sm">All basic info about this parking spot.</p>
                    </div>
                    <div className="bg-background overflow-hidden rounded-xl border shadow-sm">
                        <dl>
                            {[
                                {
                                    icon: <Globe className="text-muted-foreground h-4 w-4" />,
                                    label: 'Country',
                                    value: (
                                        <>
                                            {parkingSpot.country.name}
                                            <span className="text-muted-foreground ml-2 font-normal">({parkingSpot.country.code})</span>
                                        </>
                                    ),
                                },
                                {
                                    icon: <Landmark className="text-muted-foreground h-4 w-4" />,
                                    label: 'Province',
                                    value: parkingSpot.province.name,
                                },
                                {
                                    icon: <MapPin className="text-muted-foreground h-4 w-4" />,
                                    label: 'Municipality',
                                    value: parkingSpot.municipality,
                                },
                                {
                                    icon: <Home className="text-muted-foreground h-4 w-4" />,
                                    label: 'City',
                                    value: parkingSpot.city,
                                },
                                {
                                    icon: <Tag className="text-muted-foreground h-4 w-4" />,
                                    label: 'Street',
                                    value: parkingSpot.street,
                                },
                                {
                                    icon: <Hash className="text-muted-foreground h-4 w-4" />,
                                    label: 'Postcode',
                                    value: parkingSpot.postcode,
                                },
                                {
                                    icon: <Compass className="text-muted-foreground h-4 w-4" />,
                                    label: 'Amenity',
                                    value: parkingSpot.amenity,
                                },
                                {
                                    icon: <Compass className="text-muted-foreground h-4 w-4 rotate-90" />,
                                    label: 'Orientation',
                                    value: parkingSpot.orientation,
                                },
                                {
                                    icon: <Server className="text-muted-foreground h-4 w-4" />,
                                    label: 'IP Address',
                                    value: (
                                        <span className="flex items-center gap-1">
                                            <a
                                                href={`https://whatismyipaddress.com/?s=${ipAddress}`}
                                                target="_blank"
                                                className="font-medium text-orange-600 hover:underline dark:text-orange-400"
                                                rel="noopener noreferrer"
                                            >
                                                {ipAddress}
                                            </a>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => copyToClipboard(ipAddress)}
                                                className="text-muted-foreground hover:text-foreground h-7 w-7 cursor-pointer"
                                                tabIndex={0}
                                                title="Copy IP"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </span>
                                    ),
                                },
                            ].map(({ icon, label, value }, idx) => (
                                <div
                                    key={label}
                                    className={`grid grid-cols-[2rem_9rem_1fr] items-center gap-2 px-4 py-3 ${idx % 2 === 0 ? 'bg-muted/20' : ''} ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === 8 ? 'rounded-b-xl' : ''}`}
                                >
                                    {/* Icon */}
                                    <div className="flex justify-center">{icon}</div>
                                    {/* Label */}
                                    <dt className="text-muted-foreground text-left text-xs">{label}</dt>
                                    {/* Value */}
                                    <dd className="text-foreground text-sm font-medium break-words">
                                        {value || <span className="text-muted-foreground">—</span>}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>

                {/* Card 2: Recent confirmations */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Recent confirmations</h2>
                        <p className="text-muted-foreground text-sm">Latest check-ins for this location.</p>
                    </div>
                    <div className="bg-background overflow-hidden rounded-lg border shadow-sm">
                        {recentConfirmations && recentConfirmations.length > 0 ? (
                            <>
                                <ul>
                                    {recentConfirmations.map((confirmation, i) => {
                                        const statusOpt = selectOptions.statuses.find((s) => s.value === confirmation.status);
                                        const badgeVariant: 'default' | 'secondary' | 'destructive' =
                                            confirmation.status === 'confirmed'
                                                ? 'secondary'
                                                : confirmation.status === 'moved'
                                                  ? 'default'
                                                  : confirmation.status === 'unavailable'
                                                    ? 'destructive'
                                                    : 'default';
                                        return (
                                            <li key={confirmation.id} className={`px-3 py-2 ${i !== 0 ? 'border-muted border-t' : ''}`}>
                                                <div className="flex items-start gap-2">
                                                    {/* Badge links */}
                                                    <Badge variant={badgeVariant} className="mt-0.5 shrink-0">
                                                        {statusOpt?.label ?? confirmation.status}
                                                    </Badge>
                                                    {/* Main info + comment */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center justify-between">
                                                            <span className="truncate font-medium">{confirmation.user?.name ?? 'Unknown'}</span>
                                                            <span className="text-muted-foreground shrink-0 pl-2 text-xs">
                                                                {formatDistanceToNow(new Date(confirmation.confirmed_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        {confirmation.comment && (
                                                            <span className="text-muted-foreground mt-0.5 block truncate text-xs italic">
                                                                “{confirmation.comment}”
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                {can('parking-spot-confirmation.view_any') && (
                                    <div className="bg-muted/50 flex justify-end px-3 py-3">
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="hover:bg-accent hover:text-accent-foreground transition-colors"
                                        >
                                            <Link href={route('app.parking-spots.confirmations.index', { parking_spot: parkingSpot.id })}>
                                                Show all
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-muted-foreground px-3 py-5 text-sm">No confirmations yet.</div>
                        )}
                    </div>
                </div>

                {/* Card 3: Map */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-muted-foreground text-sm">Where the parking spot is located.</p>
                    </div>
                    <LocationMarkerCard latitude={parkingSpot.latitude} longitude={parkingSpot.longitude} nearbySpots={nearbySpots} />
                </div>

                {/* Card 4: Street View */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Street view</h2>
                        <p className="text-muted-foreground text-sm">See the area around the parking spot.</p>
                    </div>
                    <StreetViewCard latitude={parkingSpot.latitude} longitude={parkingSpot.longitude} />
                </div>
            </div>
            {dialogElement}
        </AppLayout>
    );
}
