import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';
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

const DEFAULT_LABELS: LanguageLabels = {
    en: 'English',
    nl: 'Nederlands',
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
    const supportedLanguages = useMemo<string[]>(
        () =>
            supported ??
            (Array.isArray(i18n.options.supportedLngs) ? (i18n.options.supportedLngs as string[]).filter((lng) => lng !== 'cimode') : ['en']),
        [supported],
    );

    const labels: LanguageLabels = { ...DEFAULT_LABELS, ...(languageLabels ?? {}) };
    const [value, setValue] = useState<string>(initial ?? i18n.language ?? supportedLanguages[0]);

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
