import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DestinationResult } from '@/types/destination';
import { Search } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Props = {
    onSelect: (destination: DestinationResult) => void;
};

export default function DestinationSearch({ onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DestinationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        const value = query.trim();
        if (value.length < 2) {
            setResults([]);
            return;
        }

        const delay = window.setTimeout(async () => {
            controller.current?.abort();
            controller.current = new AbortController();
            setLoading(true);
            try {
                const response = await fetch(`/api/destinations/suggestions?q=${encodeURIComponent(value)}`, {
                    signal: controller.current.signal,
                    headers: { Accept: 'application/json' },
                });
                if (response.ok) {
                    const data = await response.json();
                    setResults(data.results ?? []);
                    setOpen(true);
                }
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setResults([]);
                }
            } finally {
                setLoading(false);
            }
        }, value.length >= 3 ? 450 : 0);

        return () => window.clearTimeout(delay);
    }, [query]);

    function select(result: DestinationResult) {
        setQuery(result.label);
        setOpen(false);
        onSelect(result);
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        const value = query.trim();
        if (!value) return;
        if (results.length === 1) {
            select(results[0]);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/destinations/resolve?q=${encodeURIComponent(value)}`, {
                headers: { Accept: 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.result) select(data.result);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="absolute top-4 left-1/2 z-[1000] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="flex rounded-lg border bg-background shadow-lg">
                        <Command shouldFilter={false} className="rounded-lg">
                            <CommandInput
                                value={query}
                                onValueChange={setQuery}
                                onFocus={() => results.length > 0 && setOpen(true)}
                                placeholder="Where do you want to go?"
                            />
                        </Command>
                        <Button type="submit" variant="ghost" size="icon" disabled={loading} aria-label="Search destination">
                            <Search />
                        </Button>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <Command shouldFilter={false}>
                        <CommandList>
                            <CommandEmpty>{loading ? 'Searching destinations…' : 'No destinations found.'}</CommandEmpty>
                            <CommandGroup>
                                {results.map((result) => (
                                    <CommandItem key={result.key} value={result.key} onSelect={() => select(result)}>
                                        <span className="min-w-0">
                                            <span className="block font-medium">{result.label}</span>
                                            {result.sub && <span className="block truncate text-sm text-muted-foreground">{result.sub}</span>}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <span className="sr-only" aria-live="polite">
                {loading ? 'Searching destinations' : results.length > 0 ? `${results.length} destinations found` : ''}
            </span>
        </form>
    );
}
