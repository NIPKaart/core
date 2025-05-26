import Banner, { BannerVariant } from '@/components/banner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpot } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'My parking locations', href: route('user.parking-spots.index') },
    { title: 'Show', href: route('user.parking-spots.show', { id: ':id' }) },
];

type PageProps = {
    spot: ParkingSpot;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
};

export default function UserParkingShow({ spot, selectOptions }: PageProps) {
    const [dialogSpot, setDialogSpot] = useState<ParkingSpot | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | null>(null);

    const openDialog = (parkingSpot: ParkingSpot, type: 'delete') => {
        setDialogSpot(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogSpot(parkingSpot);
            setDialogType(type);
        }, 0);
    };

    const deleteSpot = (id: string) => {
        router.delete(route('user.parking-spots.destroy', { id }), {
            onSuccess: () => toast.success('Parking spot deleted permanently'),
            onError: () => toast.error('Failed to delete parking spot'),
        });
    };

    const statusOpt = selectOptions.statuses.find((s) => s.value === spot.status)!;
    const variantMap: Record<string, BannerVariant> = {
        pending: 'primary',
        approved: 'success',
        rejected: 'error',
    };
    const variant = variantMap[spot.status] ?? 'info';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spot Details" />
            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Parking spot ({spot.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('user.parking-spots.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog(spot, 'delete')}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Banner Notification */}
            <div className="px-4 sm:px-6">
                <Banner variant={variant} title={statusOpt.label} description={statusOpt.description} />
            </div>

            <div className="grid auto-rows-min grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Details</h2>
                        <p className="text-muted-foreground text-sm">Information about the parking spot.</p>
                    </div>
                    <div className="rounded-lg lg:p-6 sm:py-6 shadow">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead>
                                    <tr>
                                        <th className="bg-muted px-4 py-2 font-bold">Field</th>
                                        <th className="bg-muted px-4 py-2 font-bold">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Added At</th>
                                        <td className="px-4 py-2">{spot.created_at ? formatDate(spot.created_at) : 'N/A'}</td>
                                    </tr>
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
                </div>

                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-muted-foreground text-sm">Where the parking spot is located.</p>
                    </div>
                    <LocationMarkerCard latitude={spot.latitude} longitude={spot.longitude} />
                </div>
            </div>

            {dialogSpot && dialogType === 'delete' && (
                <ConfirmDialog
                    title="Delete parking spot?"
                    description={`Are you sure you want to delete the parking spot at ${spot.street}, ${spot.city} (${spot.country.name} - ${spot.country.code})? This action cannot be undone.`}
                    confirmText="Yes, delete parking spot"
                    variant="destructive"
                    onConfirm={() => {
                        deleteSpot(spot.id);
                        setDialogSpot(null);
                        setDialogType(null);
                    }}
                    onClose={() => {
                        setDialogSpot(null);
                        setDialogType(null);
                    }}
                />
            )}
        </AppLayout>
    );
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
