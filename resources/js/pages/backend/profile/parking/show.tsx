import ParkingSpaceStatusBanner from '@/components/alerts/status-parking-space';
import { ConfirmDialog } from '@/components/confirm-dialog';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Building2, Clock4, Compass, Globe, Hash, Home, Landmark, MapPin, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type PageProps = {
    parkingSpace: ParkingSpace;
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
        orientations: { value: string; label: string; description: string }[];
    };
};

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UserParkingShow({ parkingSpace, selectOptions }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/profile');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('parking_spaces.breadcrumbs.index'), href: route('profile.parking-spaces.index') },
        { title: t('parking_spaces.breadcrumbs.show'), href: route('profile.parking-spaces.show', { id: parkingSpace.id }) },
    ];

    const statusOpt = selectOptions.statuses.find((s) => s.value === parkingSpace.status)!;
    const [dialogState, setDialogState] = useState<{ parkingSpace: ParkingSpace | null; type: 'delete' | null }>({
        parkingSpace: null,
        type: null,
    });

    const openDialog = (parkingSpace: ParkingSpace, type: 'delete') => {
        setDialogState({ parkingSpace, type });
    };

    const closeDialog = () => {
        setDialogState({ parkingSpace: null, type: null });
    };

    const deleteParkingSpace = (id: string) => {
        router.delete(route('profile.parking-spaces.destroy', { id }), {
            onSuccess: () => toast.success(t('parking_spaces.toast.success')),
            onError: () => toast.error(t('parking_spaces.toast.error')),
        });
    };

    const details = [
        {
            icon: <Clock4 className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.added_at'),
            value: parkingSpace.created_at ? formatDate(parkingSpace.created_at) : 'N/A',
        },
        {
            icon: <Globe className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.country'),
            value: (
                <>
                    {parkingSpace.country?.name ?? <span className="text-muted-foreground">-</span>}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({parkingSpace.country?.code ?? '--'})</span>
                </>
            ),
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.province'),
            value: parkingSpace.province?.name ?? <span className="text-muted-foreground">-</span>,
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.municipality'),
            value: parkingSpace.municipality?.name ?? <span className="text-muted-foreground">-</span>,
        },
        {
            icon: <Home className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.city'),
            value: parkingSpace.city,
        },
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.street'),
            value: parkingSpace.street,
        },
        {
            icon: <Hash className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.postcode'),
            value: parkingSpace.postcode,
        },
        {
            icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
            label: t('parking_spaces.table.amenity'),
            value: parkingSpace.amenity,
        },
        {
            icon: <Compass className="h-4 w-4 rotate-90 text-muted-foreground" />,
            label: t('parking_spaces.table.orientation'),
            value: (() => {
                const orientation = selectOptions.orientations.find((o) => o.value === parkingSpace.orientation);
                if (!orientation) return <span className="text-muted-foreground">—</span>;
                return (
                    <div className="space-y-0.5">
                        <div className="font-medium">{orientation.label}</div>
                        <div className="text-xs text-muted-foreground">{orientation.description}</div>
                    </div>
                );
            })(),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${t('parking_spaces.title.show')} (${parkingSpace.id})`} />

            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">{t('parking_spaces.heading.show', { id: parkingSpace.id })}</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('profile.parking-spaces.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            {tGlobal('common.back')}
                        </Link>
                    </Button>
                    <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog(parkingSpace, 'delete')}>
                        <Trash2 className="h-4 w-4" />
                        {tGlobal('common.delete')}
                    </Button>
                </div>
            </div>

            {/* Banner Notification */}
            <div className="px-4 sm:px-6">
                <ParkingSpaceStatusBanner parkingSpace={parkingSpace} label={statusOpt.label} description={statusOpt.description} />
            </div>

            {/* Main grid */}
            <div className="grid auto-rows-min grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                {/* Details Card */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">{t('parking_spaces.table.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('parking_spaces.table.subtitle')}</p>
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
                        <h2 className="text-lg font-semibold">{t('parking_spaces.location.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('parking_spaces.location.subtitle')}</p>
                    </div>
                    <LocationMarkerCard latitude={parkingSpace.latitude} longitude={parkingSpace.longitude} />
                </div>
            </div>

            {/* Confirm Delete Dialog */}
            {dialogState.parkingSpace && dialogState.type === 'delete' && (
                <ConfirmDialog
                    title={t('parking_spaces.actions.delete.title')}
                    description={t('parking_spaces.actions.delete.description', {
                        street: parkingSpace.street,
                        city: parkingSpace.city,
                        country: parkingSpace.country?.name ?? '-',
                        code: parkingSpace.country?.code ?? '-',
                    })}
                    confirmText={t('parking_spaces.actions.delete.confirm')}
                    cancelText={tGlobal('common.cancel')}
                    variant="destructive"
                    onConfirm={() => {
                        deleteParkingSpace(dialogState.parkingSpace!.id);
                        closeDialog();
                    }}
                    onClose={closeDialog}
                />
            )}
        </AppLayout>
    );
}
