import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { router } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';

type FormValues = {
    parking_hours: string;
    parking_minutes: string;
    orientation: string;
    window_times: boolean;
    message: string;
};

type AddLocationFormProps = {
    lat: number;
    lng: number;
    onClose: () => void;
    orientationOptions: Record<string, string>;
};

export function AddLocationForm({ lat, lng, onClose, orientationOptions }: AddLocationFormProps) {
    const form = useForm<FormValues>({
        defaultValues: {
            parking_hours: '',
            parking_minutes: '',
            orientation: '',
            window_times: false,
            message: '',
        },
    });

    const onSubmit = form.handleSubmit((data) => {
        router.post(
            route('map.store'),
            {
                ...data,
                latitude: lat,
                longitude: lng,
            },
            {
                onSuccess: () => {
                    Swal.fire({
                        title: 'Thank you!',
                        text: 'Your location has been successfully submitted for review.',
                        icon: 'success',
                        confirmButtonText: 'Oké',
                        confirmButtonColor: '#f97316',
                    }).then(() => {
                        onClose();
                    });
                },
                onError: (errors) => {
                    Object.entries(errors).forEach(([key, message]) => {
                        form.setError(key as keyof FormValues, { type: 'server', message: String(message) });
                    });
                },
            },
        );
    });

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-8">
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Type of parking space</h2>
                    <FormField
                        control={form.control}
                        name="orientation"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Orientation *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="--- Select orientation ---" />
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
                        className="text-muted-foreground text-sm underline"
                    >
                        Look up the location in Google Streetview
                    </a>
                </div>

                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Parking time</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="parking_hours"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hours</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="E.g. 2" {...field} />
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
                                        <Input type="number" placeholder="E.g. 30" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <p className="text-muted-foreground text-sm">Keep it empty if there is no time limit indicated on a sub-board.</p>
                </div>

                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Optional information</h2>
                    <FormField
                        control={form.control}
                        name="window_times"
                        render={({ field }) => (
                            <FormItem className="flex items-start space-x-2">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="font-normal">Window times</FormLabel>
                                    <p className="text-muted-foreground text-sm">
                                        For example: Mon–Sun | 09:00–17:00. Please specify this in the comments.
                                    </p>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Message</h2>
                    <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea rows={3} placeholder="For example, location description, details, etc." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button className="cursor-pointer" variant="ghost" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button className="cursor-pointer" type="submit">
                        Send
                    </Button>
                </div>
            </form>
        </Form>
    );
}
