import { Button } from '@/components/ui/button';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import ParkingSpaceForm, { FormValues } from '@/pages/backend/form-parking-space';
import type { BreadcrumbItem, Country, Municipality, ParkingSpace, Province } from '@/types';
import type { ParkingStatusOption } from '@/types/enum';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarCheck, CheckCircle, MapPinned, ThumbsDown, TimerIcon, User as UserIcon } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';

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
    const { t, tGlobal } = useResourceTranslation('backend/parking/main');
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

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: route('app.parking-spaces.index') },
        { title: parkingSpace.id, href: route('app.parking-spaces.edit', { id: parkingSpace.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.edit', { id: parkingSpace.id })} />
            {/* Header */}
            <header className="px-4 pt-6 sm:px-6">
                <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-0 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                        <h1 className="truncate text-xl leading-none font-semibold tracking-tight sm:text-2xl">
                            {t('head.edit', { id: parkingSpace.id })}
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:auto-cols-max sm:flex-nowrap sm:justify-end">
                        <Button asChild variant="outline" className="h-10 flex-1 sm:h-9 sm:flex-none sm:px-3">
                            <Link href={route('app.parking-spaces.index')}>
                                <ArrowLeft className="h-4 w-4" />
                                {tGlobal('common.back')}
                            </Link>
                        </Button>

                        <Button
                            asChild
                            className="h-10 flex-1 bg-sky-600 text-white hover:bg-sky-700 sm:h-9 sm:flex-none sm:px-3 dark:bg-sky-500 dark:hover:bg-sky-400"
                        >
                            <a
                                href={`https://www.google.com/maps?q=&layer=c&cbll=${parkingSpace.latitude},${parkingSpace.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2"
                            >
                                <MapPinned className="h-4 w-4" />
                                {t('edit.viewStreet')}
                            </a>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="rounded-md border bg-muted/40 p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="h-4 w-4" />
                            {parkingSpace.user ? (
                                <span>
                                    <span className="font-medium text-foreground">{t('edit.submitted')}</span> {parkingSpace.user.name} (
                                    {parkingSpace.user.email})
                                </span>
                            ) : (
                                <span className="text-muted-foreground italic">{t('edit.anonymous')}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarCheck className="h-4 w-4" />
                            <span>
                                <span className="font-medium text-foreground">{t('edit.created')}</span>{' '}
                                {new Date(parkingSpace.created_at).toLocaleString()}
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
