import { suggestions } from '@/routes/destinations';
import type { DestinationResult } from '@/types/destination';
import { useEffect, useState } from 'react';

export function useDestinationSuggestions(query: string, open: boolean) {
    const [results, setResults] = useState<DestinationResult[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

    useEffect(() => {
        const request = new AbortController();
        const value = query.trim();
        setResults([]);
        setStatus(open && value.length >= 2 ? 'loading' : 'idle');
        if (!open || value.length < 2) return;

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(suggestions.url({ query: { q: value, limit: 6 } }), {
                    signal: request.signal,
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error('Destination search failed');
                const data = await response.json();
                if (!request.signal.aborted) {
                    setResults(data.results ?? []);
                    setStatus('ready');
                }
            } catch {
                if (!request.signal.aborted) setStatus('error');
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [query, open]);

    return { results, status };
}
