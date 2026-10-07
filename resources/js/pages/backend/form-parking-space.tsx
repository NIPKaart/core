import LocationMarkerCard from '@/components/map/card-location-marker';
import { Combobox } from '@/components/ui/combobox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { ParkingMunicipal, ParkingSpace } from '@/types';
import { translateSourceValue } from '@/utils/translation';
import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { STATUS_DOTS } from './parking-spaces/parts';

export type FormValues = {
    municipality_id: number;
    city: string;
    suburb: string;
    neighbourhood: string;
    postcode: string;
    street: string;
    amenity: string;
    parking_hours: number;
    parking_minutes: number;
    orientation: string;
    under_sign: string;
    under_sign_text: string;
    restriction_days: string[];
    restriction_starts_at: string;
    restriction_ends_at: string;
    latitude: number;
    longitude: number;
    description: string;
    status: string;
    rejection_reason: string;
    rejection_note: string;
};

type EnumOption = { value: string; label: string; description: string };
export type MunicipalityOption = { id: number; name: string; region: string };

type Props = {
    id: string;
    form: UseFormReturn<FormValues>;
    municipalities: MunicipalityOption[];
    statusOptions: EnumOption[];
    orientationOptions: EnumOption[];
    underSignOptions: EnumOption[];
    rejectionReasonOptions: EnumOption[];
    restrictionDays: string[];
    initialStatus: string;
    onSubmit: () => void;
    nearbySpaces?: ParkingSpace[];
    nearbyMunicipalSpaces?: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
};

/** How each way of parking looks from above: a kerb and a car. */
const ORIENTATION_SKETCHES: Record<string, ReactNode> = {
    parallel: <rect x="6" y="6" width="24" height="10" rx="2" />,
    perpendicular: <rect x="13" y="2" width="10" height="18" rx="2" />,
    angle: <rect x="12" y="3" width="10" height="17" rx="2" transform="rotate(30 17 11)" />,
};

/**
 * Editing a community parking space in sections: the address, what a visitor sees on site, and its status, with the map
 * beside them to put the marker on the exact bay. The municipality decides the province and country.
 */
export default function ParkingSpaceForm({
    id,
    form,
    municipalities,
    statusOptions,
    orientationOptions,
    underSignOptions,
    rejectionReasonOptions,
    restrictionDays,
    initialStatus,
    onSubmit,
    nearbySpaces,
    nearbyMunicipalSpaces,
}: Props) {
    const { t } = useTranslation('backend/parking/main');
    const hasUnderSign = form.watch('under_sign') === 'yes';
    const isBecomingRejected = form.watch('status') === 'rejected' && initialStatus !== 'rejected';
    const municipality = municipalities.find((option) => option.id === form.watch('municipality_id'));
    const latitude = form.watch('latitude');
    const longitude = form.watch('longitude');

    const text = (name: 'street' | 'postcode' | 'city' | 'suburb' | 'neighbourhood' | 'amenity', label: string) => (
        <FormField
            name={name}
            control={form.control}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Input {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    return (
        <Form {...form}>
            <form id={id} onSubmit={onSubmit} className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_25rem]">
                <div className="flex min-w-0 flex-col gap-8">
                    <Section title={t('edit.sections.address.title')} description={t('edit.sections.address.description')}>
                        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                            {text('street', t('edit.form.labels.street_number'))}
                            {text('postcode', t('edit.form.labels.postcode'))}
                            {text('city', t('edit.form.labels.city'))}
                            <div className="grid grid-cols-2 gap-3">
                                {text('suburb', t('edit.form.labels.suburb'))}
                                {text('neighbourhood', t('edit.form.labels.neighbourhood'))}
                            </div>
                            <FormField
                                name="municipality_id"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('edit.form.labels.municipality')}</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                value={String(field.value)}
                                                onChange={(value) => field.onChange(Number(value))}
                                                options={municipalities.map((option) => ({ label: option.name, value: String(option.id) }))}
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid gap-2">
                                <span className="text-sm leading-none font-medium">{t('show.region')}</span>
                                <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                                    {municipality?.region || '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">{t('edit.form.hints.region')}</p>
                            </div>
                        </div>
                    </Section>

                    <Section title={t('edit.sections.parking.title')} description={t('edit.sections.parking.description')}>
                        <div className="flex flex-col gap-5">
                            <FormField
                                control={form.control}
                                name="orientation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('show.orientation')}</FormLabel>
                                        <div role="radiogroup" aria-label={t('show.orientation')} className="grid gap-2 sm:grid-cols-3">
                                            {orientationOptions.map((option) => {
                                                const selected = field.value === option.value;
                                                return (
                                                    <label
                                                        key={option.value}
                                                        className={cn(
                                                            'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                                            selected ? 'border-foreground ring-1 ring-foreground' : 'hover:bg-muted/50',
                                                        )}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={field.name}
                                                            value={option.value}
                                                            checked={selected}
                                                            onChange={() => field.onChange(option.value)}
                                                            className="sr-only"
                                                        />
                                                        <svg
                                                            width="36"
                                                            height="24"
                                                            viewBox="0 0 36 24"
                                                            fill="none"
                                                            strokeWidth="1.5"
                                                            className={cn('shrink-0', selected ? 'stroke-foreground' : 'stroke-muted-foreground')}
                                                            aria-hidden
                                                        >
                                                            <path d="M0 22h36" />
                                                            {ORIENTATION_SKETCHES[option.value]}
                                                        </svg>
                                                        <span className="min-w-0">
                                                            <span className="block text-sm font-medium">{option.label}</span>
                                                            <span className="block text-xs text-muted-foreground">{option.description}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="under_sign"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('edit.form.labels.underSign')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder={t('edit.form.hints.underSignUnknown')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {underSignOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {hasUnderSign && (
                                    <FormField
                                        name="under_sign_text"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('edit.form.labels.underSignText')}</FormLabel>
                                                <FormControl>
                                                    <Input maxLength={255} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            {hasUnderSign && (
                                <>
                                    <div className="space-y-2">
                                        <span className="text-sm font-medium">{t('edit.form.labels.maxTime')}</span>
                                        <div className="flex flex-wrap items-start gap-2">
                                            {(['parking_hours', 'parking_minutes'] as const).map((name) => (
                                                <FormField
                                                    key={name}
                                                    name={name}
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <div className="flex h-9 items-center overflow-hidden rounded-md border shadow-xs">
                                                                <FormControl>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={name === 'parking_hours' ? 24 : 59}
                                                                        aria-label={t(
                                                                            `edit.form.labels.${name === 'parking_hours' ? 'hours' : 'minutes'}`,
                                                                        )}
                                                                        className="h-full w-16 bg-transparent px-3 text-sm outline-none"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                                <span className="px-3 text-sm text-muted-foreground">
                                                                    {name === 'parking_hours' ? t('show.hours') : t('show.minutes')}
                                                                </span>
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t('edit.form.hints.parkingTime')}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-sm font-medium">{t('edit.form.labels.restriction')}</span>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <FormField
                                                name="restriction_days"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <>
                                                        {restrictionDays.map((day) => {
                                                            const checked = field.value.includes(day);
                                                            return (
                                                                <label
                                                                    key={day}
                                                                    className={cn(
                                                                        'inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                                                        checked
                                                                            ? 'bg-foreground font-medium text-background'
                                                                            : 'border text-muted-foreground hover:text-foreground',
                                                                    )}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only"
                                                                        checked={checked}
                                                                        onChange={() =>
                                                                            field.onChange(
                                                                                checked
                                                                                    ? field.value.filter((value) => value !== day)
                                                                                    : [...field.value, day],
                                                                            )
                                                                        }
                                                                    />
                                                                    {translateSourceValue('backend/parking/main', `days.${day}`)}
                                                                </label>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            />
                                            <span className="w-3" aria-hidden />
                                            {(['restriction_starts_at', 'restriction_ends_at'] as const).map((name) => (
                                                <FormField
                                                    key={name}
                                                    name={name}
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                                            <FormLabel className="font-normal text-muted-foreground">
                                                                {translateSourceValue('backend/parking/main', `edit.form.labels.${name}`)}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input type="time" className="h-8 w-28" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t('edit.form.hints.restriction')}</p>
                                    </div>
                                </>
                            )}

                            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{text('amenity', t('show.nearby'))}</div>

                            <FormField
                                name="description"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('show.comment')}</FormLabel>
                                        <FormControl>
                                            <Textarea rows={3} maxLength={500} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </Section>

                    <Section
                        title={t('edit.sections.status.title')}
                        description={
                            <>
                                {t('edit.sections.status.description')}{' '}
                                <Link href={app.moderation.index()} className="underline underline-offset-4 hover:text-foreground">
                                    {t('index.moderation')}
                                </Link>
                                .
                            </>
                        }
                    >
                        <FormField
                            name="status"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <div
                                        role="radiogroup"
                                        aria-label={t('edit.sections.status.title')}
                                        className="inline-flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-0.75"
                                    >
                                        {statusOptions.map((option) => {
                                            const selected = field.value === option.value;
                                            return (
                                                <label
                                                    key={option.value}
                                                    className={cn(
                                                        'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                                        selected
                                                            ? 'bg-background font-medium shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={field.name}
                                                        value={option.value}
                                                        checked={selected}
                                                        onChange={() => field.onChange(option.value)}
                                                        className="sr-only"
                                                    />
                                                    <span
                                                        className={cn(
                                                            'size-1.75 rounded-full',
                                                            STATUS_DOTS[option.value as keyof typeof STATUS_DOTS],
                                                        )}
                                                        aria-hidden
                                                    />
                                                    {translateSourceValue('backend/parking/main', `status.${option.value}`)}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {isBecomingRejected && (
                            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="rejection_reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('edit.form.labels.rejectionReason')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder={t('edit.form.hints.rejectionReason')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {rejectionReasonOptions.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    name="rejection_note"
                                    control={form.control}
                                    render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>{t('edit.form.labels.rejectionNote')}</FormLabel>
                                            <FormControl>
                                                <Textarea rows={2} maxLength={1000} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </Section>
                </div>

                <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-sm font-semibold">{t('edit.map.title')}</h2>
                        <a
                            href={`https://www.google.com/maps?q=&layer=c&cbll=${latitude},${longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            {t('show.street_view')}
                        </a>
                    </div>
                    <div className="relative">
                        <LocationMarkerCard
                            latitude={latitude}
                            longitude={longitude}
                            onChange={(lat, lng) => {
                                form.setValue('latitude', lat, { shouldDirty: true });
                                form.setValue('longitude', lng, { shouldDirty: true });
                            }}
                            nearbySpaces={nearbySpaces}
                            nearbyMunicipalSpaces={nearbyMunicipalSpaces}
                            scrollWheelZoom={false}
                            className="h-80 lg:h-85"
                        />
                        <span className="pointer-events-none absolute bottom-3 left-1/2 z-400 -translate-x-1/2 rounded-full bg-neutral-900/85 px-2.5 py-1 text-xs whitespace-nowrap text-neutral-50">
                            {t('edit.map.drag')}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {(['latitude', 'longitude'] as const).map((name) => (
                            <FormField
                                key={name}
                                name={name}
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{translateSourceValue('backend/parking/main', `edit.form.location.${name}`)}</FormLabel>
                                        <FormControl>
                                            <Input
                                                readOnly
                                                className="bg-muted/40 font-mono text-[13px] text-muted-foreground"
                                                {...field}
                                                value={Number(field.value).toFixed(5)}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                    {nearbyMunicipalSpaces && nearbyMunicipalSpaces.length > 0 && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="size-2 rounded-full bg-[#9C2BCB]" aria-hidden />
                            {t('edit.map.municipal')}
                        </p>
                    )}
                </aside>
            </form>
        </Form>
    );
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
    return (
        <fieldset className="border-t pt-7 first:border-t-0 first:pt-0">
            <legend className="float-left w-full text-sm font-semibold">{title}</legend>
            <p className="clear-both pt-0.5 pb-4 text-[13px] text-muted-foreground">{description}</p>
            {children}
        </fieldset>
    );
}
