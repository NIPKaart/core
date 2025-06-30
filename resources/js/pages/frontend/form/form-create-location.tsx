import { SwitchCard } from '@/components/card-switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('map-add-parking');
    const formRef = useRef<HTMLFormElement | null>(null);

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} ref={formRef} className="mx-auto max-w-xl space-y-6">
                {/* Orientation */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">{t('modal.form.orientation.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('modal.form.orientation.description')}</p>
                    </div>
                    <FormField
                        control={form.control}
                        name="orientation"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('modal.form.orientation.label')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('modal.form.orientation.placeholder')} />
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
                        {t('modal.form.orientation.streetviewLink')}
                    </a>
                </section>

                {/* Parking time */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">{t('modal.form.parking_time.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('modal.form.parking_time.description')}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="parking_hours"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('modal.form.parking_time.fields.hours.label')}</FormLabel>
                                    <FormControl>
                                        <Input type="number" min={0} placeholder={t('modal.form.parking_time.fields.hours.placeholder')} {...field} />
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
                                    <FormLabel>{t('modal.form.parking_time.fields.minutes.label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder={t('modal.form.parking_time.fields.minutes.placeholder')}
                                            {...field}
                                        />
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
                        <h2 className="text-lg font-semibold">{t('modal.form.window_times.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('modal.form.window_times.description')}</p>
                    </div>
                    <SwitchCard
                        name="window_times"
                        control={form.control}
                        label={t('modal.form.window_times.switch.label')}
                        description={t('modal.form.window_times.switch.description')}
                    />
                    <p className="text-sm text-muted-foreground">{t('modal.form.window_times.note')}</p>
                </section>

                {/* Message */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">{t('modal.form.message.title')}</h2>
                    </div>
                    <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea rows={3} placeholder={t('modal.form.message.placeholder')} {...field} />
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
