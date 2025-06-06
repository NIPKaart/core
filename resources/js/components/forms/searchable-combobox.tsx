import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Option = {
    label: string;
    value: string;
};

type Props = {
    label?: string;
    placeholder?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    description?: string;
    disabled?: boolean;
};

export function SearchableCombobox({ label, placeholder = 'Select...', options, value, onChange, error, description, disabled = false }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const buttonRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
    const selectedLabel = options.find((opt) => opt.value === value)?.label;

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (!buttonRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClick);
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    // Focus search input when opening
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    // Keyboard navigation
    function handleButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
        if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
        }
    }

    function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Escape') {
            setOpen(false);
            buttonRef.current?.focus();
        }
    }

    return (
        <div className="relative w-full">
            {label && (
                <label className={cn('mb-1 block text-sm font-medium transition-colors', error ? 'text-destructive' : 'text-foreground')}>
                    {label}
                </label>
            )}
            <button
                ref={buttonRef}
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cn(
                    'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    !value && 'text-muted-foreground',
                    disabled && 'cursor-not-allowed opacity-60',
                    error && 'border-destructive focus:border-destructive',
                    'cursor-pointer',
                )}
                onClick={() => setOpen((prev) => !prev)}
                tabIndex={0}
                disabled={disabled}
                onKeyDown={handleButtonKeyDown}
            >
                <span>{selectedLabel || placeholder}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
            {open && (
                <div
                    ref={listRef}
                    tabIndex={-1}
                    className="absolute left-0 z-50 mt-2 w-full rounded-md border bg-popover shadow-lg animate-in outline-none fade-in-0 zoom-in-95"
                    onKeyDown={handleListKeyDown}
                >
                    <div className="relative p-2 pb-0">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-300">
                            <Search className="h-4 w-4" />
                        </span>
                        <input
                            ref={inputRef}
                            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pr-2 pl-9 text-sm text-foreground transition placeholder:text-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none dark:bg-zinc-800"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className={cn('max-h-60 overflow-auto py-1', filteredOptions.length === 0 && 'py-2')}>
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-muted-foreground select-none">No options found.</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    type="button"
                                    key={option.value}
                                    className={cn(
                                        'group flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-accent focus:bg-accent/60',
                                        value === option.value && 'bg-accent/50',
                                        'cursor-pointer',
                                    )}
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                        setSearch('');
                                        setTimeout(() => buttonRef.current?.focus(), 1);
                                    }}
                                >
                                    <span>{option.label}</span>
                                    {value === option.value && <Check className="ml-2 h-4 w-4 text-primary opacity-100" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
            {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
            {error && <div className="mt-1 text-sm text-destructive">{error}</div>}
        </div>
    );
}
