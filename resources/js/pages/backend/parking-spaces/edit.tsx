import { Button } from '@/components/ui/button';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import ParkingSpaceForm, { type FormValues, type MunicipalityOption } from '@/pages/backend/form-parking-space';
import app from '@/routes/app';
import type { BreadcrumbItem, ParkingMunicipal, ParkingSpace } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

type EnumOption = { value: string; label: string; description: string };

type PageProps = {
    parkingSpace: ParkingSpace;
    municipalities: MunicipalityOption[];
    selectOptions: {
        statuses: EnumOption[];
        orientation: EnumOption[];
        underSign: EnumOption[];
        rejectionReasons: EnumOption[];
        restrictionDays: string[];
    };
    nearbySpaces?: ParkingSpace[];
    nearbyMunicipalSpaces?: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
};

/** Editing a community parking space, with a bar that keeps saving in reach and says what is not saved yet. */
export default function Edit({ parkingSpace: space, municipalities, selectOptions, nearbySpaces, nearbyMunicipalSpaces }: PageProps) {
    const { t } = useResourceTranslation('backend/parking/main');
    const { i18n } = useTranslation();

    const form = useForm<FormValues>({
        defaultValues: {
            municipality_id: space.municipality?.id,
            city: space.city ?? '',
            suburb: space.suburb ?? '',
            neighbourhood: space.neighbourhood ?? '',
            postcode: space.postcode,
            street: space.street,
            amenity: space.amenity ?? '',
            parking_hours: space.parking_hours ?? 0,
            parking_minutes: space.parking_minutes ?? 0,
            orientation: space.orientation,
            under_sign: space.under_sign ?? '',
            under_sign_text: space.under_sign_text ?? '',
            restriction_days: space.restriction_days ?? [],
            restriction_starts_at: space.restriction_starts_at?.slice(0, 5) ?? '',
            restriction_ends_at: space.restriction_ends_at?.slice(0, 5) ?? '',
            latitude: space.latitude,
            longitude: space.longitude,
            description: space.description ?? '',
            status: space.status,
            rejection_reason: '',
            rejection_note: '',
        },
    });

    const [submitting, setSubmitting] = useState(false);
    const changes = Object.keys(form.formState.dirtyFields).length;

    const handleSubmit = form.handleSubmit((data) => {
        form.clearErrors();

        router.put(app.parkingSpaces.update({ parking_space: space.id }), data, {
            preserveScroll: true,
            onStart: () => setSubmitting(true),
            onFinish: () => setSubmitting(false),
            onError: (errors) => {
                Object.entries(errors).forEach(([field, message]) => {
                    form.setError(field as keyof FormValues, { type: 'server', message: message as string });
                });
            },
        });
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: app.parkingSpaces.index() },
        { title: space.street, href: app.parkingSpaces.show({ parking_space: space.id }) },
        { title: t('edit.breadcrumb'), href: app.parkingSpaces.edit({ parking_space: space.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('edit.title', { street: space.street })} />
            <div className="flex flex-col gap-7 px-4 pt-6 pb-8 sm:px-8 sm:pt-7 lg:px-10">
                <header className="space-y-1.5">
                    <Link
                        href={app.parkingSpaces.show({ parking_space: space.id })}
                        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-3.5" aria-hidden />
                        {space.street}
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('edit.title', { street: space.street })}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t(space.user ? 'edit.added_by' : 'edit.added', {
                            name: space.user?.name,
                            date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(space.created_at)),
                        })}
                    </p>
                </header>

                <ParkingSpaceForm
                    id="parking-space-form"
                    form={form}
                    municipalities={municipalities}
                    statusOptions={selectOptions.statuses}
                    orientationOptions={selectOptions.orientation}
                    underSignOptions={selectOptions.underSign}
                    rejectionReasonOptions={selectOptions.rejectionReasons}
                    restrictionDays={selectOptions.restrictionDays}
                    initialStatus={space.status}
                    onSubmit={handleSubmit}
                    nearbySpaces={nearbySpaces}
                    nearbyMunicipalSpaces={nearbyMunicipalSpaces}
                />
            </div>

            <div className="sticky bottom-0 z-30 mt-auto flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-8 lg:px-10">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    {changes > 0 && <span className="size-1.75 rounded-full bg-amber-600" aria-hidden />}
                    {changes > 0 ? t('edit.unsaved', { count: changes }) : t('edit.no_changes')}
                </span>
                <span className="flex gap-2">
                    <Button asChild variant="ghost">
                        <Link href={app.parkingSpaces.show({ parking_space: space.id })}>{t('edit.cancel')}</Link>
                    </Button>
                    <Button type="submit" form="parking-space-form" disabled={submitting}>
                        {t('edit.form.actions.save')}
                    </Button>
                </span>
            </div>
        </AppLayout>
    );
}
