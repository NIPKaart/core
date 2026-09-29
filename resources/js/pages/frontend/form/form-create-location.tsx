import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    orientation: string;
    under_sign: '' | 'yes' | 'no';
    under_sign_text: string;
    parking_hours: string;
    parking_minutes: string;
    restriction_days: string[];
    restriction_starts_at: string;
    restriction_ends_at: string;
    description: string;
};

const RESTRICTION_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

type Props = {
    action: string;
    method?: 'post' | 'put' | 'patch';
    orientationOptions: Record<string, string>;
    initial?: Partial<FormValues>;
    lat: number;
    lng: number;
    onSuccess?: () => void;
};

export function AddLocationForm({ action, method = 'post', orientationOptions, initial, lat, lng, onSuccess }: Props) {
    const { t } = useTranslation('frontend/map/add-parking');

    const [orientation, setOrientation] = useState<string>(initial?.orientation ?? '');
    const [underSign, setUnderSign] = useState<string>(initial?.under_sign ?? '');

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

                    {/* Under-sign */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('modal.form.under_sign.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('modal.form.under_sign.description')}</p>
                        </div>

                        <div className="space-y-2">
                            <label id="under-sign-label" className="text-sm font-medium">
                                {t('modal.form.under_sign.label')}
                            </label>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                value={underSign}
                                onValueChange={setUnderSign}
                                disabled={processing}
                                aria-labelledby="under-sign-label"
                                className="justify-start"
                            >
                                <ToggleGroupItem value="yes" className="px-6">
                                    {t('modal.form.under_sign.yes')}
                                </ToggleGroupItem>
                                <ToggleGroupItem value="no" className="px-6">
                                    {t('modal.form.under_sign.no')}
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <input type="hidden" name="under_sign" value={underSign} />
                            <InputError message={errors.under_sign} />
                        </div>

                        {underSign === 'yes' && (
                            <div className="space-y-4 rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('modal.form.under_sign.details_hint')}</p>

                                <div className="space-y-2">
                                    <label htmlFor="under_sign_text" className="text-sm font-medium">
                                        {t('modal.form.under_sign.text.label')}
                                    </label>
                                    <Input
                                        id="under_sign_text"
                                        name="under_sign_text"
                                        maxLength={255}
                                        placeholder={t('modal.form.under_sign.text.placeholder')}
                                        defaultValue={initial?.under_sign_text ?? ''}
                                        disabled={processing}
                                    />
                                    <InputError message={errors.under_sign_text} />
                                </div>

                                <div className="space-y-2">
                                    <span className="text-sm font-medium">{t('modal.form.parking_time.title')}</span>
                                    <p className="text-sm text-muted-foreground">{t('modal.form.parking_time.description')}</p>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm font-medium">{t('modal.form.parking_time.fields.hours.label')}</label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={24}
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
                                                max={59}
                                                name="parking_minutes"
                                                placeholder={t('modal.form.parking_time.fields.minutes.placeholder')}
                                                defaultValue={initial?.parking_minutes ?? ''}
                                                disabled={processing}
                                            />
                                            <InputError className="mt-2" message={errors.parking_minutes} />
                                        </div>
                                    </div>
                                </div>

                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium">{t('modal.form.restriction.title')}</legend>
                                    <p className="text-sm text-muted-foreground">{t('modal.form.restriction.description')}</p>
                                    <div className="flex flex-wrap gap-3">
                                        {RESTRICTION_DAYS.map((day) => (
                                            <label key={day} className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    name="restriction_days[]"
                                                    value={day}
                                                    defaultChecked={initial?.restriction_days?.includes(day)}
                                                    disabled={processing}
                                                />
                                                {t(`modal.form.restriction.days.${day}`)}
                                            </label>
                                        ))}
                                    </div>
                                    <InputError message={errors.restriction_days} />
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {(['restriction_starts_at', 'restriction_ends_at'] as const).map((name) => (
                                            <div key={name}>
                                                <label htmlFor={name} className="text-sm font-medium">
                                                    {t(`modal.form.restriction.${name}`)}
                                                </label>
                                                <Input id={name} type="time" name={name} defaultValue={initial?.[name] ?? ''} disabled={processing} />
                                                <InputError className="mt-2" message={errors[name]} />
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        )}
                    </section>

                    {/* Note */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">{t('modal.form.description.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('modal.form.description.hint')}</p>
                        </div>
                        <div>
                            <Textarea
                                rows={3}
                                name="description"
                                maxLength={500}
                                placeholder={t('modal.form.description.placeholder')}
                                defaultValue={initial?.description ?? ''}
                                disabled={processing}
                            />
                            <InputError className="mt-2" message={errors.description} />
                        </div>
                    </section>
                </>
            )}
        </Form>
    );
}
