import Banner, { BannerVariant } from '@/components/banner';
import LocationMarkerCard from '@/components/map/card-location-marker';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace, ParkingSpaceConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Compass, Copy, Edit, Globe, Hash, Home, Landmark, MapPin, Server, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spaces', href: route('app.parking-spaces.index') },
    { title: 'Show', href: route('app.parking-spaces.show', { id: ':id' }) },
];

type PageProps = {
    parkingSpace: ParkingSpace;
    selectOptions: {
        parkingStatuses: { value: string; label: string; description: string }[];
        confirmationStatuses: { value: string; label: string; description: string }[];
    };
    nearbySpaces: ParkingSpace[];
    recentConfirmations: ParkingSpaceConfirmation[];
};

export default function Show({ parkingSpace, selectOptions, nearbySpaces, recentConfirmations }: PageProps) {
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpaceActionDialog();

    const statusOpt = selectOptions.parkingStatuses.find((s) => s.value === parkingSpace.status)!;
    const variantMap: Record<string, BannerVariant> = {
        pending: 'primary',
        approved: 'success',
        rejected: 'error',
    };
    const variant = variantMap[parkingSpace.status] ?? 'info';

    function copyToClipboard(val: string) {
        navigator.clipboard.writeText(val);
        toast.success('Copied to clipboard');
    }

    const ipAddress = parkingSpace.ip_address ?? '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Space" />
            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Parking space ({parkingSpace.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.parking-spaces.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    {can('parking-space.update') && (
                        <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                            <Link href={route('app.parking-spaces.edit', { id: parkingSpace.id })}>
                                <Edit className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    )}

                    {can('parking-space.delete') && (
                        <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog('delete', parkingSpace)}>
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
                        <p className="text-sm text-muted-foreground">All basic info about this parking space.</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                        <dl>
                            {[
                                {
                                    icon: <Globe className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Country',
                                    value: (
                                        <>
                                            {parkingSpace.country?.name}
                                            <span className="ml-2 font-normal text-muted-foreground">({parkingSpace.country?.code})</span>
                                        </>
                                    ),
                                },
                                {
                                    icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Province',
                                    value: parkingSpace.province?.name,
                                },
                                {
                                    icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Municipality',
                                    value: parkingSpace.municipality?.name,
                                },
                                {
                                    icon: <Home className="h-4 w-4 text-muted-foreground" />,
                                    label: 'City',
                                    value: parkingSpace.city,
                                },
                                {
                                    icon: <Tag className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Street',
                                    value: parkingSpace.street,
                                },
                                {
                                    icon: <Hash className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Postcode',
                                    value: parkingSpace.postcode,
                                },
                                {
                                    icon: <Compass className="h-4 w-4 text-muted-foreground" />,
                                    label: 'Amenity',
                                    value: parkingSpace.amenity,
                                },
                                {
                                    icon: <Compass className="h-4 w-4 rotate-90 text-muted-foreground" />,
                                    label: 'Orientation',
                                    value: parkingSpace.orientation,
                                },
                                {
                                    icon: <Server className="h-4 w-4 text-muted-foreground" />,
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
                                                className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
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
                                    <dt className="text-left text-xs text-muted-foreground">{label}</dt>
                                    {/* Value */}
                                    <dd className="text-sm font-medium break-words text-foreground">
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
                        <p className="text-sm text-muted-foreground">Latest check-ins for this location.</p>
                    </div>
                    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                        {recentConfirmations && recentConfirmations.length > 0 ? (
                            <>
                                <ul>
                                    {recentConfirmations.map((confirmation, i) => {
                                        const statusOpt = selectOptions.confirmationStatuses.find((s) => s.value === confirmation.status);
                                        const badgeVariant: 'default' | 'secondary' | 'destructive' =
                                            confirmation.status === 'confirmed'
                                                ? 'secondary'
                                                : confirmation.status === 'moved'
                                                  ? 'default'
                                                  : confirmation.status === 'unavailable'
                                                    ? 'destructive'
                                                    : 'default';
                                        return (
                                            <li key={confirmation.id} className={`px-3 py-2 ${i !== 0 ? 'border-t border-muted' : ''}`}>
                                                <div className="flex items-start gap-2">
                                                    {/* Badge links */}
                                                    <Badge variant={badgeVariant} className="mt-0.5 shrink-0">
                                                        {statusOpt?.label ?? confirmation.status}
                                                    </Badge>
                                                    {/* Main info + comment */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center justify-between">
                                                            <span className="truncate font-medium">{confirmation.user?.name ?? 'Unknown'}</span>
                                                            <span className="shrink-0 pl-2 text-xs text-muted-foreground">
                                                                {formatDistanceToNow(new Date(confirmation.confirmed_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        {confirmation.comment && (
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground italic">
                                                                “{confirmation.comment}”
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                {can('parking-space-confirmation.view_any') && (
                                    <div className="flex justify-end bg-muted/50 px-3 py-3">
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="transition-colors hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Link href={route('app.parking-spaces.confirmations.index', { parking_space: parkingSpace.id })}>
                                                Show all
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="px-3 py-5 text-sm text-muted-foreground">No confirmations yet.</div>
                        )}
                    </div>
                </div>

                {/* Card 3: Map */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-sm text-muted-foreground">Where the parking space is located.</p>
                    </div>
                    <LocationMarkerCard latitude={parkingSpace.latitude} longitude={parkingSpace.longitude} nearbySpaces={nearbySpaces} />
                </div>

                {/* Card 4: Street View */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Street view</h2>
                        <p className="text-sm text-muted-foreground">See the area around the parking space.</p>
                    </div>
                    <StreetViewCard latitude={parkingSpace.latitude} longitude={parkingSpace.longitude} />
                </div>
            </div>
            {dialogElement}
        </AppLayout>
    );
}
