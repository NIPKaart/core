import { SwitchCard } from '@/components/card-switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';

export type FormValues = {
    parking_hours: string;
    parking_minutes: string;
    orientation: string;
    window_times: boolean;
    message: string;
};

type Props = {
    form: UseFormReturn<FormValues>;
    orientationOptions: Record<string, string>;
    onSubmit: () => void;
    lat: number;
    lng: number;
};

export function AddLocationForm({ form, orientationOptions, onSubmit, lat, lng }: Props) {
    const formRef = useRef<HTMLFormElement | null>(null);

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} ref={formRef} className="mx-auto max-w-xl space-y-6">
                {/* Orientation */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Type of parking space</h2>
                        <p className="text-sm text-muted-foreground">What kind of orientation does the parking spot have?</p>
                    </div>
                    <FormField
                        control={form.control}
                        name="orientation"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Orientation *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select orientation" />
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
                    <a
                        href={`https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground underline"
                    >
                        Look up the location in Google Street View
                    </a>
                </section>

                {/* Parking time */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Parking time</h2>
                        <p className="text-sm text-muted-foreground">If there is a time restriction, enter it here. Otherwise leave it blank.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="parking_hours"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hours</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} placeholder="E.g. 2" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parking_minutes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Minutes</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} placeholder="E.g. 30" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </section>

                {/* Optional info */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Additional info</h2>
                        <p className="text-sm text-muted-foreground">Help others understand the context better.</p>
                    </div>
                    <SwitchCard name="window_times" control={form.control} label="Window times" description="For example: Mon–Sun | 09:00–17:00" />
                    <p className="text-sm text-muted-foreground">Please describe the specific times in the message field.</p>
                </section>

                {/* Message */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Message</h2>
                    </div>
                    <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea rows={3} placeholder="For example, more context or details about the location..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </section>
            </form>
        </Form>
    );
}
