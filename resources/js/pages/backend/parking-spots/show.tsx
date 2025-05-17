import Banner, { BannerVariant } from '@/components/banner';
import LocationMarkerCard from '@/components/map/card-location-marker';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, UserParkingSpot } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spots', href: route('app.user-parking-spots.index') },
    { title: 'Show', href: route('app.user-parking-spots.show', { id: ':id' }) },
];

type PageProps = {
    spot: UserParkingSpot;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
};

export default function Show({ spot, selectOptions }: PageProps) {
    const { can } = useAuthorization();

    const statusOpt = selectOptions.statuses.find((s) => s.value === spot.status)!;
    const variantMap: Record<string, BannerVariant> = {
        pending: 'primary',
        approved: 'success',
        rejected: 'error',
    };
    const variant = variantMap[spot.status] ?? 'info';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spot" />
            {/* Header */}
            <div className="flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6 mb-4">
                <h1 className="text-2xl font-bold tracking-tight">Parking spot ({spot.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.user-parking-spots.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    {can('user-parking-spot.update') && (
                        <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                            <Link href={route('app.user-parking-spots.edit', { id: spot.id })}>
                                <Edit className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    )}

                    {can('user-parking-spot.delete') && (
                        <Button variant="destructive" className="w-1/2 sm:w-auto">
                            <Trash2 className="h-4 w-4" />
                            Move to trash
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
                <div className="rounded-lg p-6 shadow">
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Details</h2>
                        <p className="text-muted-foreground text-sm">Information about the parking spot.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <tbody>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Country</th>
                                    <td className="px-4 py-2">
                                        {spot.country.name} ({spot.country.code})
                                    </td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Province</th>
                                    <td className="px-4 py-2">{spot.province.name}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">IP Address</th>
                                    <td className="px-4 py-2">
                                        <a
                                            href={`https://whatismyipaddress.com/?s=${spot.ip_address}`}
                                            target="_blank"
                                            className="font-medium text-orange-600 hover:underline dark:text-orange-500"
                                        >
                                            {spot.ip_address}
                                        </a>
                                    </td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Municipality</th>
                                    <td className="px-4 py-2">{spot.municipality}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">City</th>
                                    <td className="px-4 py-2">{spot.city}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Postcode</th>
                                    <td className="px-4 py-2">{spot.postcode}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Street</th>
                                    <td className="px-4 py-2">{spot.street}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Amenity</th>
                                    <td className="px-4 py-2">{spot.amenity}</td>
                                </tr>
                                <tr className="border-t">
                                    <th className="px-4 py-2 font-medium">Orientation</th>
                                    <td className="px-4 py-2">{spot.orientation}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Card 2: Audit trail */}
                <div className="rounded-lg p-6 shadow">
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Audit trail</h2>
                        <p className="text-muted-foreground text-sm">TODO - show audit trail</p>
                    </div>
                </div>

                {/* Card 3: Map */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-muted-foreground text-sm">Where the parking spot is located.</p>
                    </div>
                    <LocationMarkerCard latitude={spot.latitude} longitude={spot.longitude} />
                </div>

                {/* Card 4: Street View */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Street view</h2>
                        <p className="text-muted-foreground text-sm">See the area around the parking spot.</p>
                    </div>
                    <StreetViewCard latitude={spot.latitude} longitude={spot.longitude} />
                </div>
            </div>
        </AppLayout>
    );
}
