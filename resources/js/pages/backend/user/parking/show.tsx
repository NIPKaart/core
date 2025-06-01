import Banner, { BannerVariant } from '@/components/banner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type PageProps = {
    space: ParkingSpace;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
};

export default function UserParkingShow({ space, selectOptions }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'My parking locations', href: route('user.parking-spaces.index') },
        { title: 'Show', href: route('user.parking-spaces.show', { id: space.id }) },
    ];

    const [dialogState, setDialogState] = useState<{ space: ParkingSpace | null; type: 'delete' | null }>({ space: null, type: null });

    const openDialog = (space: ParkingSpace, type: 'delete') => {
        setDialogState({ space, type });
    };

    const closeDialog = () => {
        setDialogState({ space: null, type: null });
    };

    const deleteParkingSpace = (id: string) => {
        router.delete(route('user.parking-spaces.destroy', { id }), {
            onSuccess: () => toast.success('Parking space deleted permanently'),
            onError: () => toast.error('Failed to delete parking space'),
        });
    };

    const statusOpt = selectOptions.statuses.find((s) => s.value === space.status)!;
    const variantMap: Record<string, BannerVariant> = {
        pending: 'primary',
        approved: 'success',
        rejected: 'error',
    };
    const variant = variantMap[space.status] ?? 'info';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Space Details" />
            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Parking space ({space.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('user.parking-spaces.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog(space, 'delete')}>
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
                        <p className="text-muted-foreground text-sm">Information about the parking space.</p>
                    </div>
                    <div className="rounded-lg shadow sm:py-6 lg:p-6">
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
                                        <td className="px-4 py-2">{space.created_at ? formatDate(space.created_at) : 'N/A'}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Country</th>
                                        <td className="px-4 py-2">
                                            {space.country.name} ({space.country.code})
                                        </td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Province</th>
                                        <td className="px-4 py-2">{space.province.name}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Municipality</th>
                                        <td className="px-4 py-2">{space.municipality}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">City</th>
                                        <td className="px-4 py-2">{space.city}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Postcode</th>
                                        <td className="px-4 py-2">{space.postcode}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Street</th>
                                        <td className="px-4 py-2">{space.street}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Amenity</th>
                                        <td className="px-4 py-2">{space.amenity}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <th className="px-4 py-2 font-medium">Orientation</th>
                                        <td className="px-4 py-2">{space.orientation}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-muted-foreground text-sm">Where the parking space is located.</p>
                    </div>
                    <LocationMarkerCard latitude={space.latitude} longitude={space.longitude} />
                </div>
            </div>

            {dialogState.space && dialogState.type === 'delete' && (
                <ConfirmDialog
                    title="Delete parking space?"
                    description={`Are you sure you want to delete the parking space at ${space.street}, ${space.city} (${space.country.name} - ${space.country.code})? This action cannot be undone.`}
                    confirmText="Yes, delete parking space"
                    variant="destructive"
                    onConfirm={() => {
                        deleteParkingSpace(dialogState.space!.id);
                        closeDialog();
                    }}
                    onClose={closeDialog}
                />
            )}
        </AppLayout>
    );
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
