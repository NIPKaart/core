import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { router, usePage } from '@inertiajs/react';
import React from 'react';
import { useForm } from 'react-hook-form';

type FormValues = {
    status: string;
    comment: string;
};

type Props = {
    spaceId: string;
    confirmationStatusOptions: Record<string, string>;
    confirmedToday: boolean;
    onConfirmed?: () => void;
};

export function ParkingConfirmForm({ spaceId, confirmationStatusOptions, confirmedToday, onConfirmed }: Props) {
    const { errors } = usePage().props as unknown as { errors?: Record<string, string[]> };
    const [generalError, setGeneralError] = React.useState<string | null>(null);

    const form = useForm<FormValues>({
        defaultValues: { status: 'confirmed', comment: '' },
    });

    // Clear errors and general error on open/space change
    React.useEffect(() => {
        setGeneralError(null);
        form.clearErrors();
    }, [spaceId, form]);

    // Set validation errors
    React.useEffect(() => {
        if (errors) {
            Object.entries(errors).forEach(([key, value]) => {
                if (key === 'status' || key === 'comment') {
                    form.setError(key as keyof FormValues, { type: 'server', message: Array.isArray(value) ? value[0] : value });
                } else {
                    setGeneralError(Array.isArray(value) ? value[0] : value);
                }
            });
        }
    }, [errors, form]);

    const onSubmit = form.handleSubmit((data) => {
        setGeneralError(null);
        router.post(route('app.parking-spaces.confirm', spaceId), data, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setGeneralError(null);
                onConfirmed?.();
            },
            onError: (errors) => {
                Object.entries(errors).forEach(([key, message]) => {
                    form.setError(key as keyof FormValues, { type: 'server', message: String(message) });
                });
            },
        });
    });

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5">
                <h2 className="mb-2 text-center text-lg font-semibold">Help keep the map up-to-date</h2>
                <div className="mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    Confirm if the parking space is still valid.
                    <br />
                    <span className="text-sm text-zinc-400">(you can do this once per day, for each parking space)</span>
                </div>
                {generalError && (
                    <div className="mb-2 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20">
                        {generalError}
                    </div>
                )}
                <div className="space-y-3">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={confirmedToday || form.formState.isSubmitting}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(confirmationStatusOptions).map(([value, label]) => (
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
                        control={form.control}
                        name="comment"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Comment <span className="text-xs text-muted-foreground">(optional)</span>
                                </FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        rows={2}
                                        className="resize-none text-xs"
                                        placeholder="Add any details or comments about the parking space..."
                                        maxLength={500}
                                        disabled={confirmedToday || form.formState.isSubmitting}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={confirmedToday || form.formState.isSubmitting}>
                    {confirmedToday ? 'Already confirmed today' : form.formState.isSubmitting ? 'Confirming...' : 'Confirm'}
                </Button>
            </form>
        </Form>
    );
}
