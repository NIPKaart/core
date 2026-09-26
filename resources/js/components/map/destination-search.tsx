import { Input } from '@/components/ui/input';
import type { DestinationResult } from '@/types/destination';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Props = {
    onSelect: (destination: DestinationResult) => void;
};

export default function DestinationSearch({ onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DestinationResult[]>([]);
    const [loading, setLoading] = useState(false);
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

    async function submit(event: FormEvent) {
        event.preventDefault();
        const value = query.trim();
        if (!value) return;
        if (results.length === 1) {
            onSelect(results[0]);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/destinations/resolve?q=${encodeURIComponent(value)}`, {
                headers: { Accept: 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.result) onSelect(data.result);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={submit} className="absolute top-4 left-1/2 z-[1000] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2">
            <div className="rounded-lg border bg-background shadow-lg">
                <label htmlFor="destination-search" className="sr-only">Where do you want to go?</label>
                <Input
                    id="destination-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Where do you want to go?"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="destination-results"
                    aria-expanded={results.length > 0}
                />
                {results.length > 0 && (
                    <ul id="destination-results" role="listbox" className="max-h-72 overflow-y-auto border-t p-1">
                        {results.map((result) => (
                            <li key={result.key}>
                                <button
                                    type="button"
                                    className="w-full rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent"
                                    onClick={() => onSelect(result)}
                                >
                                    <span className="block font-medium">{result.label}</span>
                                    {result.sub && <span className="block truncate text-sm text-muted-foreground">{result.sub}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {loading && <span className="sr-only" aria-live="polite">Searching destinations</span>}
            </div>
        </form>
    );
}
