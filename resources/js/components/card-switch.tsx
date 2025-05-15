import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

interface SwitchCardProps<TFieldValues extends FieldValues = FieldValues> {
    name: FieldPath<TFieldValues>;
    control: Control<TFieldValues>;
    label: string;
    description?: string;
    disabled?: boolean;
}

export function SwitchCard<TFieldValues extends FieldValues>({ name, control, label, description, disabled = false }: SwitchCardProps<TFieldValues>) {
    return (
        <FormField
            name={name}
            control={control}
            render={({ field }) => (
                <FormItem
                    className={cn(
                        'flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm transition-colors',
                        disabled && 'cursor-not-allowed opacity-50',
                    )}
                >
                    <div className="space-y-0.5">
                        <FormLabel>{label}</FormLabel>
                        {description && <p className="text-muted-foreground text-sm">{description}</p>}
                    </div>
                    <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} className="cursor-pointer" />
                    </FormControl>
                </FormItem>
            )}
        />
    );
}
