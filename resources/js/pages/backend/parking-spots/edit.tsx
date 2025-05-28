import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import ParkingSpotForm, { FormValues } from '@/pages/backend/form-parking-spot';
import type { BreadcrumbItem, Country, ParkingSpot, Province } from '@/types';
import type { ParkingStatusOption } from '@/types/enum';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarCheck, CheckCircle, MapPinned, ThumbsDown, TimerIcon, User as UserIcon } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spots', href: route('app.parking-spots.index') },
    { title: 'Edit Parking Spot', href: route('app.parking-spots.edit', { id: ':id' }) },
];

const iconMap = {
    pending: TimerIcon,
    approved: CheckCircle,
    rejected: ThumbsDown,
};

type PageProps = {
    parkingSpot: ParkingSpot;
    countries: Country[];
    provinces: Province[];
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
        orientation: Record<string, string>;
    };
    nearbySpots?: ParkingSpot[];
};

export default function Edit() {
    const { parkingSpot, countries, provinces, selectOptions, nearbySpots } = usePage<PageProps>().props;

    const statusOptions: ParkingStatusOption[] = selectOptions.statuses.map((status) => ({
        ...status,
        icon: iconMap[status.value as keyof typeof iconMap],
    }));

    const form = useForm<FormValues, ParkingSpot>({
        defaultValues: {
            country_id: parkingSpot.country.id,
            province_id: parkingSpot.province.id,
            municipality: parkingSpot.municipality,
            city: parkingSpot.city,
            suburb: parkingSpot.suburb ?? '',
            neighbourhood: parkingSpot.neighbourhood ?? '',
            postcode: parkingSpot.postcode,
            street: parkingSpot.street,
            amenity: parkingSpot.amenity ?? '',
            parking_hours: Math.floor(parkingSpot.parking_time ?? 0 / 60),
            parking_minutes: (parkingSpot.parking_time ?? 0) % 60,
            orientation: parkingSpot.orientation,
            window_times: parkingSpot.window_times,
            latitude: parkingSpot.latitude,
            longitude: parkingSpot.longitude,
            description: parkingSpot.description ?? '',
            status: parkingSpot.status,
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        const payload = {
            ...data,
            parking_time: (Number(data.parking_hours) || 0) * 60 + (Number(data.parking_minutes) || 0),
        };

        router.put(route('app.parking-spots.update', { id: parkingSpot.id }), payload, {
            preserveScroll: true,
            onError: (errors) => {
                Object.entries(errors).forEach(([field, message]) => {
                    form.setError(field as keyof FormValues, {
                        type: 'server',
                        message: message as string,
                    });
                });
            },
        });
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${parkingSpot.id}`} />

            <div className="flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Edit {parkingSpot.id}</h1>

                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.parking-spots.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    <Button asChild className="w-1/2 bg-sky-600 text-white hover:bg-sky-700 sm:w-auto dark:bg-sky-500 dark:hover:bg-sky-400">
                        <a
                            href={`https://www.google.com/maps?q=&layer=c&cbll=${parkingSpot.latitude},${parkingSpot.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2"
                        >
                            <MapPinned className="h-4 w-4" />
                            Street View
                        </a>
                    </Button>
                </div>
            </div>

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="bg-muted/40 rounded-md border p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            {parkingSpot.user ? (
                                <span>
                                    <span className="text-foreground font-medium">Submitted by:</span> {parkingSpot.user.name} (
                                    {parkingSpot.user.email})
                                </span>
                            ) : (
                                <span className="text-muted-foreground italic">Submitted anonymously</span>
                            )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4" />
                            <span>
                                <span className="text-foreground font-medium">Created:</span> {new Date(parkingSpot.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <FormProvider {...form}>
                    <ParkingSpotForm
                        form={form}
                        countries={countries}
                        provinces={provinces}
                        statusOptions={statusOptions}
                        orientationOptions={selectOptions.orientation}
                        onSubmit={handleSubmit}
                        submitting={false}
                        nearbySpots={nearbySpots}
                    />
                </FormProvider>
            </div>
        </AppLayout>
    );
}
