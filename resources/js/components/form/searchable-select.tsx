import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

type Option = {
    label: string;
    value: string;
};

type Props = {
    label: string;
    placeholder?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    description?: string;
};

export function SearchableSelect({ label, placeholder, options, value, onChange, error, description }: Props) {
    const [open, setOpen] = useState(false);

    const selectedLabel = options.find((opt) => opt.value === value)?.label;

    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <FormControl>
                        <Button
                            variant="outline"
                            role="combobox"
                            className={cn('w-full justify-between', !value && 'text-muted-foreground')}
                        >
                            {selectedLabel || placeholder || 'Select...'}
                            <ChevronsUpDown className="ml-2 size-4 opacity-50" />
                        </Button>
                    </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search..." className="h-9" />
                        <CommandList>
                            <CommandEmpty>No options found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => {
                                            onChange(option.value);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        {option.label}
                                        <Check className={cn('ml-auto h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {description && <FormDescription>{description}</FormDescription>}
            {error && <FormMessage>{error}</FormMessage>}
        </FormItem>
    );
}
