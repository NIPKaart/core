import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import ParkingSpaceForm, { FormValues } from '@/pages/backend/form-parking-space';
import type { BreadcrumbItem, Country, Municipality, ParkingSpace, Province } from '@/types';
import type { ParkingStatusOption } from '@/types/enum';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarCheck, CheckCircle, MapPinned, ThumbsDown, TimerIcon, User as UserIcon } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spaces', href: route('app.parking-spaces.index') },
    { title: 'Edit Parking Space', href: route('app.parking-spaces.edit', { id: ':id' }) },
];

const iconMap = {
    pending: TimerIcon,
    approved: CheckCircle,
    rejected: ThumbsDown,
};

type PageProps = {
    parkingSpace: ParkingSpace;
    countries: Country[];
    provinces: Province[];
    municipalities: Municipality[];
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
        orientation: Record<string, string>;
    };
    nearbySpaces?: ParkingSpace[];
};

export default function Edit() {
    const { parkingSpace, countries, provinces, municipalities, selectOptions, nearbySpaces } = usePage<PageProps>().props;

    const statusOptions: ParkingStatusOption[] = selectOptions.statuses.map((status) => ({
        ...status,
        icon: iconMap[status.value as keyof typeof iconMap],
    }));

    const form = useForm<FormValues, ParkingSpace>({
        defaultValues: {
            country_id: parkingSpace.country?.id,
            province_id: parkingSpace.province?.id,
            municipality_id: parkingSpace.municipality?.id,
            city: parkingSpace.city,
            suburb: parkingSpace.suburb ?? '',
            neighbourhood: parkingSpace.neighbourhood ?? '',
            postcode: parkingSpace.postcode,
            street: parkingSpace.street,
            amenity: parkingSpace.amenity ?? '',
            parking_hours: parkingSpace.parking_hours ?? 0,
            parking_minutes: parkingSpace.parking_minutes ?? 0,
            orientation: parkingSpace.orientation,
            window_times: parkingSpace.window_times,
            latitude: parkingSpace.latitude,
            longitude: parkingSpace.longitude,
            description: parkingSpace.description ?? '',
            status: parkingSpace.status,
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        const payload = {
            ...data,
            parking_time: (Number(data.parking_hours) || 0) * 60 + (Number(data.parking_minutes) || 0),
        };

        router.put(route('app.parking-spaces.update', { id: parkingSpace.id }), payload, {
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
            <Head title={`Edit ${parkingSpace.id}`} />

            <div className="flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Edit {parkingSpace.id}</h1>

                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.parking-spaces.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                    </Button>

                    <Button asChild className="w-1/2 bg-sky-600 text-white hover:bg-sky-700 sm:w-auto dark:bg-sky-500 dark:hover:bg-sky-400">
                        <a
                            href={`https://www.google.com/maps?q=&layer=c&cbll=${parkingSpace.latitude},${parkingSpace.longitude}`}
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
                <div className="rounded-md border bg-muted/40 p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="h-4 w-4" />
                            {parkingSpace.user ? (
                                <span>
                                    <span className="font-medium text-foreground">Submitted by:</span> {parkingSpace.user.name} (
                                    {parkingSpace.user.email})
                                </span>
                            ) : (
                                <span className="text-muted-foreground italic">Submitted anonymously</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarCheck className="h-4 w-4" />
                            <span>
                                <span className="font-medium text-foreground">Created:</span> {new Date(parkingSpace.created_at).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                <FormProvider {...form}>
                    <ParkingSpaceForm
                        form={form}
                        countries={countries}
                        provinces={provinces}
                        municipalities={municipalities}
                        statusOptions={statusOptions}
                        orientationOptions={selectOptions.orientation}
                        onSubmit={handleSubmit}
                        submitting={false}
                        nearbySpaces={nearbySpaces}
                    />
                </FormProvider>
            </div>
        </AppLayout>
    );
}
