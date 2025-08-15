import { RadioCardGroup } from '@/components/card-radio-group';
import { SwitchCard } from '@/components/card-switch';
import HeadingSmall from '@/components/heading-small';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Country, Municipality, ParkingSpace, Province } from '@/types';
import type { ParkingStatusOption } from '@/types/enum';
import { FileText, Layers, MapPin } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    country_id: number;
    province_id: number;
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
    window_times: boolean;
    latitude: number;
    longitude: number;
    description: string;
    status: string;
};

type Props = {
    form: UseFormReturn<FormValues>;
    countries: Country[];
    provinces: Province[];
    municipalities: Municipality[];
    statusOptions: ParkingStatusOption[];
    orientationOptions: Record<string, string>;
    onSubmit: () => void;
    submitting: boolean;
    nearbySpaces?: ParkingSpace[];
};

export default function ParkingSpaceForm({
    form,
    countries,
    provinces,
    municipalities,
    statusOptions,
    orientationOptions,
    onSubmit,
    submitting,
    nearbySpaces,
}: Props) {
    const { t } = useTranslation('backend/parking/main');
    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="mb-4 space-y-1">
                            <HeadingSmall title={t('edit.form.title')} description={t('edit.form.description')} />
                        </div>
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger
                                    value="basic"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <MapPin className="mr-2 h-4 w-4" /> {t('edit.form.tabs.basic')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="extra"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <Layers className="mr-2 h-4 w-4" /> {t('edit.form.tabs.extra')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="status"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <FileText className="mr-2 h-4 w-4" /> {t('edit.form.tabs.status')}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="pt-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        name="country_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>{t('edit.form.labels.country')}</FormLabel>
                                                <FormControl>
                                                    <Combobox
                                                        value={String(field.value)}
                                                        onChange={(v) => field.onChange(Number(v))}
                                                        options={countries.map((c) => ({
                                                            label: c.name,
                                                            value: String(c.id),
                                                        }))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        name="province_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>{t('edit.form.labels.province')}</FormLabel>
                                                <FormControl>
                                                    <Combobox
                                                        value={String(field.value)}
                                                        onChange={(v) => field.onChange(Number(v))}
                                                        options={provinces.map((p) => ({
                                                            label: p.name,
                                                            value: String(p.id),
                                                        }))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        name="municipality_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>{t('edit.form.labels.municipality')}</FormLabel>
                                                <FormControl>
                                                    <Combobox
                                                        value={String(field.value)}
                                                        onChange={(val) => field.onChange(Number(val))}
                                                        options={municipalities.map((m) => ({
                                                            label: m.name,
                                                            value: String(m.id),
                                                        }))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {['city', 'suburb', 'neighbourhood', 'postcode', 'street', 'amenity'].map((name) => (
                                        <FormField
                                            key={name}
                                            name={name as keyof FormValues}
                                            control={form.control}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormLabel>{t(`edit.form.labels.${name}`)}</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} value={typeof field.value === 'boolean' ? '' : field.value} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="extra" className="pt-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <SwitchCard
                                            name="window_times"
                                            control={form.control}
                                            label={t('edit.form.labels.windowTimes')}
                                            description={t('edit.form.hints.windowTimes')}
                                        />
                                        <p className="my-2 text-sm text-muted-foreground">{t('edit.form.hints.windowTimesDescription')}</p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <FormLabel className="text-sm font-medium">{t('edit.form.labels.parkingTime')}</FormLabel>
                                        <p className="mb-2 text-sm text-muted-foreground">{t('edit.form.hints.parkingTime')}</p>
                                        <div className="flex flex-col gap-4 md:flex-row">
                                            <FormField
                                                name="parking_hours"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>{t('edit.form.labels.hours')}</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" min={0} {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                name="parking_minutes"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>{t('edit.form.labels.minutes')}</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" min={0} max={59} {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="orientation"
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>{t('edit.form.labels.orientation')}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Object.entries(orientationOptions).map(([value, label]) => (
                                                            <SelectItem key={value} value={value}>
                                                                {label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        name="description"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>{t('edit.form.labels.description')}</FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        className="min-h-[100px] w-full resize-y rounded-md border px-3 py-2 text-sm"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="status" className="pt-4">
                                <RadioCardGroup name="status" control={form.control} options={statusOptions} />
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="space-y-4">
                        <div className="mb-4">
                            <div className="mb-4 space-y-1">
                                <HeadingSmall title={t('edit.form.location.title')} description={t('edit.form.location.description')} />
                            </div>
                            <LocationMarkerCard
                                latitude={form.watch('latitude')}
                                longitude={form.watch('longitude')}
                                onChange={(lat, lng) => {
                                    form.setValue('latitude', lat);
                                    form.setValue('longitude', lng);
                                }}
                                nearbySpaces={nearbySpaces}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                name="latitude"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel>{t('edit.form.location.latitude')}</FormLabel>
                                        <FormControl>
                                            <Input disabled {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="longitude"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel>{t('edit.form.location.longitude')}</FormLabel>
                                        <FormControl>
                                            <Input disabled {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <Button type="submit" disabled={submitting} className="w-full cursor-pointer md:w-auto">
                        {t('edit.form.actions.save')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
