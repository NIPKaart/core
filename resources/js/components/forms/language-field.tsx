import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Input } from '../ui/input';

type LanguageLabels = Record<string, string>;

export type LanguageFieldProps = {
    name?: string;
    label: string;
    error?: string;
    initial?: string;
    supported?: string[];
    languageLabels?: LanguageLabels;
    className?: string;
    onChange?: (lng: string) => void;
};

export default function LanguageField({
    name = 'locale',
    label,
    error,
    initial,
    supported,
    languageLabels,
    className,
    onChange,
}: LanguageFieldProps) {
    const { localization, locale } = usePage<SharedData>().props;
    const supportedLanguages = useMemo(() => supported ?? localization.available.map((language) => language.code), [supported, localization]);
    const labels = { ...Object.fromEntries(localization.available.map((language) => [language.code, language.label])), ...languageLabels };
    const [value, setValue] = useState(initial ?? locale);

    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={name}>{label}</Label>
            <Select
                value={value}
                onValueChange={(lng) => {
                    setValue(lng);
                    onChange?.(lng);
                }}
            >
                <SelectTrigger id={name} className="w-full">
                    <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                    {supportedLanguages.map((lng) => (
                        <SelectItem key={lng} value={lng}>
                            {labels[lng] ?? lng}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Input type="hidden" name={name} value={value} />

            <InputError className="mt-2" message={error} />
        </div>
    );
}
