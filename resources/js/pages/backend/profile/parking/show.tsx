import Banner, { BannerVariant } from '@/components/banner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Building2, Clock4, Compass, Globe, Hash, Home, Landmark, MapPin, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type PageProps = {
    space: ParkingSpace;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
};

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UserParkingShow({ space, selectOptions }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'My parking locations', href: route('profile.parking-spaces.index') },
        { title: 'Show', href: route('profile.parking-spaces.show', { id: space.id }) },
    ];

    const [dialogState, setDialogState] = useState<{ space: ParkingSpace | null; type: 'delete' | null }>({
        space: null,
        type: null,
    });

    const openDialog = (space: ParkingSpace, type: 'delete') => {
        setDialogState({ space, type });
    };

    const closeDialog = () => {
        setDialogState({ space: null, type: null });
    };

    const deleteParkingSpace = (id: string) => {
        router.delete(route('profile.parking-spaces.destroy', { id }), {
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

    const details = [
        {
            icon: <Clock4 className="h-4 w-4 text-muted-foreground" />,
            label: 'Added At',
            value: space.created_at ? formatDate(space.created_at) : 'N/A',
        },
        {
            icon: <Globe className="h-4 w-4 text-muted-foreground" />,
            label: 'Country',
            value: (
                <>
                    {space.country?.name ?? <span className="text-muted-foreground">Unknown</span>}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({space.country?.code ?? '--'})</span>
                </>
            ),
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
            label: 'Province',
            value: space.province?.name ?? <span className="text-muted-foreground">Unknown</span>,
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: 'Municipality',
            value: space.municipality?.name ?? <span className="text-muted-foreground">Unknown</span>,
        },
        {
            icon: <Home className="h-4 w-4 text-muted-foreground" />,
            label: 'City',
            value: space.city,
        },
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: 'Street',
            value: space.street,
        },
        {
            icon: <Hash className="h-4 w-4 text-muted-foreground" />,
            label: 'Postcode',
            value: space.postcode,
        },
        {
            icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
            label: 'Amenity',
            value: space.amenity,
        },
        {
            icon: <Compass className="h-4 w-4 rotate-90 text-muted-foreground" />,
            label: 'Orientation',
            value: space.orientation,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Space Details" />

            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Parking space ({space.id})</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('profile.parking-spaces.index')}>
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

            {/* Main grid */}
            <div className="grid auto-rows-min grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                {/* Details Card */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Details</h2>
                        <p className="text-sm text-muted-foreground">Information about the parking space.</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                        <dl>
                            {details.map(({ icon, label, value }, idx) => (
                                <div
                                    key={label}
                                    className={`grid grid-cols-[2rem_8rem_1fr] items-center gap-2 px-4 py-3 ${idx % 2 === 0 ? 'bg-muted/20' : ''} ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === details.length - 1 ? 'rounded-b-xl' : ''}`}
                                >
                                    <div className="flex justify-center">{icon}</div>
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className="text-sm font-medium break-words text-foreground">
                                        {value || <span className="text-muted-foreground">—</span>}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>

                {/* Location Card */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">Location</h2>
                        <p className="text-sm text-muted-foreground">Where the parking space is located.</p>
                    </div>
                    <LocationMarkerCard latitude={space.latitude} longitude={space.longitude} />
                </div>
            </div>

            {/* Confirm Delete Dialog */}
            {dialogState.space && dialogState.type === 'delete' && (
                <ConfirmDialog
                    title="Delete parking space?"
                    description={`Are you sure you want to delete the parking space at ${space.street}, ${space.city} (${space.country?.name} - ${space.country?.code})? This action cannot be undone.`}
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
