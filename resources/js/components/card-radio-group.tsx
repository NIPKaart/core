import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { Control, FieldValues, Path } from 'react-hook-form';

type Option = {
    value: string;
    label: string;
    description?: string;
    icon?: LucideIcon;
};

type RadioCardGroupProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
    name: TName;
    control: Control<TFieldValues>;
    options: Option[];
};

export function RadioCardGroup<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
    name,
    control,
    options,
}: RadioCardGroupProps<TFieldValues, TName>) {
    return (
        <FormField
            name={name}
            control={control}
            render={({ field }) => (
                <FormItem className="grid gap-4">
                    {options.map((option) => {
                        const Icon = option.icon;
                        const id = `radio-${name}-${option.value}`;

                        return (
                            <label key={option.value} htmlFor={id} className="block cursor-pointer">
                                <input
                                    type="radio"
                                    id={id}
                                    name={field.name}
                                    value={option.value}
                                    checked={field.value === option.value}
                                    onChange={() => field.onChange(option.value)}
                                    className="peer sr-only"
                                />
                                <div
                                    className={cn(
                                        'rounded-md border p-4 shadow-sm transition-all',
                                        'hover:bg-muted',
                                        'peer-checked:border-primary peer-checked:bg-muted',
                                        'peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
                                    )}
                                >
                                    <div className="flex items-center gap-2 font-semibold">
                                        {Icon && <Icon className="text-muted-foreground h-4 w-4" />}
                                        {option.label}
                                    </div>
                                    {option.description && <p className="text-muted-foreground mt-1 text-sm">{option.description}</p>}
                                </div>
                            </label>
                        );
                    })}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
