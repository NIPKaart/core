import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    parking_hours: string;
    parking_minutes: string;
    orientation: string;
    window_times: boolean;
    message: string;
};

type Props = {
    action: string;
    method?: 'post' | 'put' | 'patch';
    orientationOptions: Record<string, string>;
    initial?: Partial<FormValues>;
    lat: number;
    lng: number;
    onSuccess?: (args: any) => void;
};

export function AddLocationForm({ action, method = 'post', orientationOptions, initial, lat, lng, onSuccess }: Props) {
    const { t } = useTranslation('frontend/map/add-parking');

    const [orientation, setOrientation] = useState<string>(initial?.orientation ?? '');
    const [windowTimes, setWindowTimes] = useState<boolean>(Boolean(initial?.window_times));

    return (
        <Form
            id="location-form"
            method={method}
            action={action}
            options={{ preserveScroll: true }}
            onSuccess={onSuccess}
            className="mx-auto max-w-xl space-y-6"
        >
            {({ errors, processing }) => (
                <>
                    {/* Orientation */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('modal.form.orientation.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('modal.form.orientation.description')}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('modal.form.orientation.label')}</label>
                            <Select value={orientation} onValueChange={setOrientation} disabled={processing}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('modal.form.orientation.placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(orientationOptions).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <input type="hidden" name="orientation" value={orientation} />
                            <InputError message={errors.orientation} />
                        </div>

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
                            <div>
                                <label className="text-sm font-medium">{t('modal.form.parking_time.fields.hours.label')}</label>
                                <Input
                                    type="number"
                                    min={0}
                                    name="parking_hours"
                                    placeholder={t('modal.form.parking_time.fields.hours.placeholder')}
                                    defaultValue={initial?.parking_hours ?? ''}
                                    disabled={processing}
                                />
                                <InputError className="mt-2" message={errors.parking_hours} />
                            </div>

                            <div>
                                <label className="text-sm font-medium">{t('modal.form.parking_time.fields.minutes.label')}</label>
                                <Input
                                    type="number"
                                    min={0}
                                    name="parking_minutes"
                                    placeholder={t('modal.form.parking_time.fields.minutes.placeholder')}
                                    defaultValue={initial?.parking_minutes ?? ''}
                                    disabled={processing}
                                />
                                <InputError className="mt-2" message={errors.parking_minutes} />
                            </div>
                        </div>
                    </section>

                    {/* Optional info */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('modal.form.window_times.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('modal.form.window_times.description')}</p>
                        </div>

                        <div className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="font-medium">{t('modal.form.window_times.switch.label')}</div>
                                    <p className="text-sm text-muted-foreground">{t('modal.form.window_times.switch.description')}</p>
                                </div>
                                <Switch checked={windowTimes} onCheckedChange={setWindowTimes} disabled={processing} />
                            </div>
                            <input type="hidden" name="window_times" value={windowTimes ? '1' : '0'} />
                            <InputError className="mt-2" message={errors.window_times} />
                        </div>

                        <p className="text-sm text-muted-foreground">{t('modal.form.window_times.note')}</p>
                    </section>

                    {/* Message */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('modal.form.message.title')}</h2>
                        </div>
                        <div>
                            <Textarea
                                rows={3}
                                name="message"
                                placeholder={t('modal.form.message.placeholder')}
                                defaultValue={initial?.message ?? ''}
                                disabled={processing}
                            />
                            <InputError className="mt-2" message={errors.message} />
                        </div>
                    </section>
                </>
            )}
        </Form>
    );
}
