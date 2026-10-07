import InputError from '@/components/input-error';
import { getOrientationIllustration } from '@/components/map/parking-detail/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { translateSourceValue } from '@/utils/translation';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContributionForm, OrientationOption } from './types';

const DURATION_PRESETS = [30, 60, 120, 180];
const NOTE_MAX = 500;
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

type Props = {
    data: ContributionForm;
    setData: <K extends keyof ContributionForm>(key: K, value: ContributionForm[K]) => void;
    errors: Partial<Record<keyof ContributionForm | `restriction_days.${number}`, string>>;
    orientationOptions: OrientationOption[];
    restrictionDays: string[];
};

const choiceClass = (selected: boolean) =>
    cn(
        'cursor-pointer rounded-xl border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
        selected ? 'border-2 border-orange-600 bg-orange-50 font-semibold dark:bg-orange-950/40' : 'border-border bg-background hover:bg-accent',
    );

function minutesOf(data: ContributionForm): number {
    return Number(data.parking_hours || 0) * 60 + Number(data.parking_minutes || 0);
}

export default function DetailsStep({ data, setData, errors, orientationOptions, restrictionDays }: Props) {
    const { t } = useTranslation('frontend/map/contribute');
    const duration = minutesOf(data);
    const [customDuration, setCustomDuration] = useState(duration > 0 && !DURATION_PRESETS.includes(duration));

    const setDuration = (minutes: number) => {
        setCustomDuration(false);
        const next = duration === minutes ? 0 : minutes;
        setData('parking_hours', next ? String(Math.floor(next / 60)) : '');
        setData('parking_minutes', next ? String(next % 60) : '');
    };

    const toggleDay = (day: string) =>
        setData(
            'restriction_days',
            data.restriction_days.includes(day) ? data.restriction_days.filter((value) => value !== day) : [...data.restriction_days, day],
        );

    const dayError = errors.restriction_days ?? Object.entries(errors).find(([key]) => key.startsWith('restriction_days.'))?.[1];

    return (
        <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <legend className="float-left w-full text-base font-semibold">{t('details.orientation.title')}</legend>
                <p className="text-sm text-muted-foreground">{t('details.orientation.hint')}</p>
                <div className="grid grid-cols-3 gap-2">
                    {orientationOptions.map((option) => (
                        <label
                            key={option.value}
                            className={cn(choiceClass(data.orientation === option.value), 'flex flex-col items-center gap-1.5 px-1.5 py-2.5 text-sm')}
                        >
                            <input
                                type="radio"
                                name="orientation"
                                value={option.value}
                                checked={data.orientation === option.value}
                                onChange={() => setData('orientation', option.value)}
                                className="sr-only"
                            />
                            <img src={getOrientationIllustration(option)} alt="" className="size-16 object-contain sm:size-20" />
                            {option.label}
                        </label>
                    ))}
                </div>
                <InputError message={errors.orientation} />
                {data.latitude !== null && data.longitude !== null && (
                    <a
                        href={`https://maps.google.com/maps?q=&layer=c&cbll=${data.latitude},${data.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 self-start py-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        <ExternalLink className="size-4" aria-hidden />
                        {t('details.streetview')}
                    </a>
                )}
            </fieldset>

            <fieldset className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <legend className="float-left w-full text-base font-semibold">{t('details.under_sign.title')}</legend>
                <div className="flex items-center gap-3">
                    <img src="/assets/images/boards/under-sign.svg" alt={t('details.under_sign.example')} className="h-16 w-13 shrink-0 rounded-lg" />
                    <p className="text-sm text-muted-foreground">{t('details.under_sign.hint')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {(['yes', 'no'] as const).map((answer) => (
                        <label
                            key={answer}
                            className={cn(choiceClass(data.under_sign === answer), 'flex h-12 items-center justify-center text-[15px]')}
                        >
                            <input
                                type="radio"
                                name="under_sign"
                                value={answer}
                                checked={data.under_sign === answer}
                                onChange={() => setData('under_sign', answer)}
                                className="sr-only"
                            />
                            {translateSourceValue('frontend/map/contribute', `details.under_sign.${answer}`)}
                        </label>
                    ))}
                </div>
                <InputError message={errors.under_sign} />

                {data.under_sign === 'yes' && (
                    <div className="flex flex-col gap-4 border-t pt-3">
                        <p className="text-sm text-muted-foreground">{t('details.under_sign.optional')}</p>

                        <div className="grid gap-1.5">
                            <Label htmlFor="under_sign_text">{t('details.under_sign.text_label')}</Label>
                            <Input
                                id="under_sign_text"
                                value={data.under_sign_text}
                                maxLength={255}
                                placeholder={t('details.under_sign.text_placeholder')}
                                onChange={(event) => setData('under_sign_text', event.target.value)}
                                className="h-12"
                            />
                            <InputError message={errors.under_sign_text} />
                        </div>

                        <div className="grid gap-2">
                            <span className="text-sm font-medium" id="duration-label">
                                {t('details.under_sign.duration')}
                            </span>
                            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="duration-label">
                                {DURATION_PRESETS.map((minutes) => (
                                    <button
                                        key={minutes}
                                        type="button"
                                        aria-pressed={!customDuration && duration === minutes}
                                        onClick={() => setDuration(minutes)}
                                        className="h-11 rounded-full border px-4 text-sm aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-semibold aria-pressed:text-background"
                                    >
                                        {minutes < 60
                                            ? t('details.under_sign.duration_minutes', { count: minutes })
                                            : t('details.under_sign.duration_hours', { count: minutes / 60 })}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    aria-pressed={customDuration}
                                    onClick={() => setCustomDuration((value) => !value)}
                                    className="h-11 rounded-full border border-dashed px-4 text-sm aria-pressed:border-solid aria-pressed:border-foreground aria-pressed:font-semibold"
                                >
                                    {t('details.under_sign.duration_other')}
                                </button>
                            </div>
                            {customDuration && (
                                <div className="grid grid-cols-2 gap-2">
                                    {(['parking_hours', 'parking_minutes'] as const).map((name) => (
                                        <div key={name} className="grid gap-1">
                                            <Label htmlFor={name} className="text-muted-foreground">
                                                {translateSourceValue(
                                                    'frontend/map/contribute',
                                                    `details.under_sign.${name === 'parking_hours' ? 'hours' : 'minutes'}`,
                                                )}
                                            </Label>
                                            <Input
                                                id={name}
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                max={name === 'parking_hours' ? 24 : 59}
                                                value={data[name]}
                                                onChange={(event) => setData(name, event.target.value)}
                                                className="h-12"
                                            />
                                            <InputError message={errors[name]} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm font-medium" id="days-label">
                                    {t('details.under_sign.applies')}
                                </span>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        className="py-2 text-sm font-semibold text-orange-700 dark:text-orange-400"
                                        onClick={() => setData('restriction_days', WEEKDAYS)}
                                    >
                                        {t('details.under_sign.weekdays')}
                                    </button>
                                    <button
                                        type="button"
                                        className="py-2 text-sm font-semibold text-orange-700 dark:text-orange-400"
                                        onClick={() => setData('restriction_days', restrictionDays)}
                                    >
                                        {t('details.under_sign.every_day')}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5" role="group" aria-labelledby="days-label">
                                {restrictionDays.map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        aria-pressed={data.restriction_days.includes(day)}
                                        onClick={() => toggleDay(day)}
                                        className="h-11 rounded-lg border text-sm aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-semibold aria-pressed:text-background"
                                    >
                                        {translateSourceValue('frontend/map/contribute', `days.${day}`)}
                                    </button>
                                ))}
                            </div>
                            <InputError message={dayError} />
                            <div className="grid grid-cols-2 gap-2">
                                {(['restriction_starts_at', 'restriction_ends_at'] as const).map((name) => (
                                    <div key={name} className="grid gap-1">
                                        <Label htmlFor={name} className="text-muted-foreground">
                                            {translateSourceValue(
                                                'frontend/map/contribute',
                                                `details.under_sign.${name === 'restriction_starts_at' ? 'from' : 'until'}`,
                                            )}
                                        </Label>
                                        <Input
                                            id={name}
                                            type="time"
                                            value={data[name]}
                                            onChange={(event) => setData(name, event.target.value)}
                                            className="h-12"
                                        />
                                        <InputError message={errors[name]} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </fieldset>

            <div className="grid gap-2 rounded-2xl border bg-card p-4">
                <Label htmlFor="description" className="text-base font-semibold">
                    {t('details.note.title')} <span className="text-sm font-normal text-muted-foreground">{t('details.note.optional')}</span>
                </Label>
                <Textarea
                    id="description"
                    rows={3}
                    maxLength={NOTE_MAX}
                    value={data.description}
                    placeholder={t('details.note.placeholder')}
                    onChange={(event) => setData('description', event.target.value)}
                />
                <div className="flex justify-between gap-2">
                    <InputError message={errors.description} />
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
                        {data.description.length} / {NOTE_MAX}
                    </span>
                </div>
            </div>
        </div>
    );
}
