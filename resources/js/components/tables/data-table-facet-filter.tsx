import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckIcon, PlusCircle } from 'lucide-react';
import { useState } from 'react';

type Option = {
    label: string;
    value: string;
    count?: number;
};

interface DataTableFacetFilterProps {
    title: string;
    selected: string[];
    options: Option[];
    onChange: (selected: string[]) => void;
    onClear?: () => void;
}

export function DataTableFacetFilter({ title, selected, options, onChange, onClear }: DataTableFacetFilterProps) {
    const [open, setOpen] = useState(false);

    const toggle = (value: string) => {
        const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
        onChange(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="cursor-pointer">
                <Button variant="outline" className="h-9 border-dashed">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {title}
                    {selected.length > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                                {selected.length > 2 ? (
                                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                        {selected.length} selected
                                    </Badge>
                                ) : (
                                    selected.map((val) => {
                                        const label = options.find((o) => o.value === val)?.label ?? val;
                                        return (
                                            <Badge key={val} variant="secondary" className="rounded-sm px-1 font-normal">
                                                {label}
                                            </Badge>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Filter ${title.toLowerCase()}...`} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selected.includes(option.value);
                                return (
                                    <CommandItem key={option.value} onSelect={() => toggle(option.value)} className="cursor-pointer">
                                        <div
                                            className={cn(
                                                'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                                isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                                            )}
                                        >
                                            <CheckIcon className="h-4 w-4" />
                                        </div>
                                        <span>{option.label}</span>
                                        <span className="ml-auto text-muted-foreground">{option.count}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {selected.length > 0 && onClear && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={onClear} className="cursor-pointer justify-center text-center">
                                        Clear filters
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
