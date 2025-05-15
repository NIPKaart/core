import { RadioCardGroup } from '@/components/card-radio-group';
import { SwitchCard } from '@/components/card-switch';
import LocationPickerCard from '@/components/map/card-location-picker';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Country, Province } from '@/types';
import type { ParkingStatusOption } from '@/types/enum';
import { FileText, Layers, MapPin } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

export type FormValues = {
    country_id: number;
    province_id: number;
    municipality: string;
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
    statusOptions: ParkingStatusOption[];
    orientationOptions: Record<string, string>;
    onSubmit: () => void;
    submitting: boolean;
};

export default function UserParkingSpotForm({ form, countries, provinces, statusOptions, orientationOptions, onSubmit, submitting }: Props) {
    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="mb-4 space-y-1">
                            <h2 className="text-lg font-semibold">Parking Spot Details</h2>
                            <p className="text-muted-foreground text-sm">Edit the details of the parking spot.</p>
                        </div>
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger
                                    value="basic"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <MapPin className="mr-2 h-4 w-4" /> Basic
                                </TabsTrigger>
                                <TabsTrigger
                                    value="extra"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <Layers className="mr-2 h-4 w-4" /> Extra
                                </TabsTrigger>
                                <TabsTrigger
                                    value="status"
                                    className="cursor-pointer data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
                                >
                                    <FileText className="mr-2 h-4 w-4" /> Status
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="pt-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        name="country_id"
                                        control={form.control}
                                        render={({ field }) => (
                                            <FormItem className="w-full">
                                                <FormLabel>Country</FormLabel>
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
                                                <FormLabel>Province</FormLabel>
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

                                    {['municipality', 'city', 'suburb', 'neighbourhood', 'postcode', 'street', 'amenity'].map((name) => (
                                        <FormField
                                            key={name}
                                            name={name as keyof FormValues}
                                            control={form.control}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormLabel>{name}</FormLabel>
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
                                            label="Window Times"
                                            description="Are there restricted hours at this location?"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <FormLabel className="text-sm font-medium">Parking Time</FormLabel>
                                        <p className="text-muted-foreground mb-2 text-sm">Maximum parking duration allowed at this location.</p>
                                        <div className="flex flex-col gap-4 md:flex-row">
                                            <FormField
                                                name="parking_hours"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <FormItem className="w-full">
                                                        <FormLabel>Hours</FormLabel>
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
                                                        <FormLabel>Minutes</FormLabel>
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
                                                <FormLabel>Orientation *</FormLabel>
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
                                                <FormLabel>Description</FormLabel>
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
                                <h2 className="text-lg font-semibold">Location</h2>
                                <p className="text-muted-foreground text-sm">Drag the marker to fine-tune the exact spot on the map.</p>
                            </div>
                            <LocationPickerCard
                                latitude={form.watch('latitude')}
                                longitude={form.watch('longitude')}
                                onChange={(lat, lng) => {
                                    form.setValue('latitude', lat);
                                    form.setValue('longitude', lng);
                                }}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                name="latitude"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Latitude</FormLabel>
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
                                        <FormLabel>Longitude</FormLabel>
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
                        Save Changes
                    </Button>
                </div>
            </form>
        </Form>
    );
}
