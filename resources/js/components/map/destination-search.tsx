import { closeSearch, openSearch, useSearchOpen } from '@/components/search/search-store';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDestinationSuggestions } from '@/hooks/use-destination-suggestions';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSearchHotkey } from '@/hooks/use-search-hotkey';
import { useRecentSearches } from '@/hooks/use-search-recent';
import { resolve as resolveDestination } from '@/routes/destinations';
import type { DestinationResult } from '@/types/destination';
import { ArrowLeft, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DestinationSearch({
    destination,
    onSelect,
}: {
    destination: DestinationResult | null;
    onSelect: (value: DestinationResult) => void;
}) {
    const { t } = useTranslation('global/search');
    const { t: tMap } = useTranslation('frontend/map/main');
    const open = useSearchOpen();
    const desktop = useMediaQuery('(min-width: 1024px)');
    const [query, setQuery] = useState(destination?.label ?? '');
    const [error, setError] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState('');
    const { results, status } = useDestinationSuggestions(query, open);
    const { items: recent, add } = useRecentSearches();
    const input = useRef<HTMLInputElement>(null);
    const container = useRef<HTMLDivElement>(null);
    const resolver = useRef<AbortController | null>(null);
    useSearchHotkey();

    useEffect(() => () => closeSearch(), []);

    useEffect(() => {
        setSelectedSuggestion(results[0]?.key ?? '');
    }, [results]);

    useEffect(() => {
        if (open) input.current?.focus();
        else setQuery(destination?.label ?? '');
    }, [open, destination]);

    useEffect(() => {
        setError(null);
        setResolving(false);
        return () => resolver.current?.abort();
    }, [query, open]);

    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => {
            if (event.target instanceof Element && event.target.closest('#map-search-toggle')) return;
            if (event.target instanceof Node && !container.current?.contains(event.target)) closeSearch();
        };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);

    function dismiss() {
        closeSearch();
        if (!desktop) document.getElementById('map-search-toggle')?.focus();
        else input.current?.blur();
    }

    function choose(value: DestinationResult) {
        add(value.label);
        resolver.current?.abort();
        onSelect(value);
        dismiss();
    }

    async function resolve() {
        if (query.trim().length < 2 || resolving) return;
        resolver.current?.abort();
        const request = new AbortController();
        resolver.current = request;
        setResolving(true);
        setError(null);
        try {
            const response = await fetch(resolveDestination.url({ query: { q: query.trim() } }), {
                signal: request.signal,
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Destination resolution failed');
            const data = await response.json();
            if (!request.signal.aborted) {
                if (data.result) choose(data.result);
                else setError('no_destination');
            }
        } catch {
            if (!request.signal.aborted) setError('error');
        } finally {
            if (!request.signal.aborted) setResolving(false);
        }
    }

    return (
        <div ref={container} id="map-destination-search" hidden={!desktop && !open} className="pointer-events-auto relative w-full lg:w-[440px]">
            <Command
                shouldFilter={false}
                value={selectedSuggestion}
                onValueChange={setSelectedSuggestion}
                label={t('aria_input')}
                className="h-auto overflow-visible rounded-xl border shadow-md focus-within:ring-2 focus-within:ring-ring [&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input-wrapper]]:border-0"
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        dismiss();
                    }
                }}
                onBlur={(event) => {
                    if (event.relatedTarget instanceof Element && event.relatedTarget.closest('#map-search-toggle')) return;
                    if (!event.currentTarget.contains(event.relatedTarget)) closeSearch();
                }}
            >
                <div className="relative flex items-center">
                    {!desktop && (
                        <Button variant="ghost" size="icon" className="ml-1 size-11 shrink-0" aria-label={tMap('filters.close')} onClick={dismiss}>
                            <ArrowLeft className="size-4" aria-hidden />
                        </Button>
                    )}
                    <div className="min-w-0 flex-1">
                        <CommandInput
                            asChild
                            ref={input}
                            value={query}
                            onValueChange={setQuery}
                            onFocus={openSearch}
                            placeholder={tMap('toolbar.search')}
                            className="h-12 pr-11 text-base lg:text-sm"
                        >
                            <input aria-label={t('aria_input')} aria-expanded={open} />
                        </CommandInput>
                    </div>
                    {query && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 size-11"
                            aria-label={t('clear')}
                            onClick={() => {
                                setQuery('');
                                input.current?.focus();
                            }}
                        >
                            <X className="size-4" aria-hidden />
                        </Button>
                    )}
                </div>
                {open && (
                    <div className="absolute top-full right-0 left-0 mt-1 overflow-hidden rounded-xl border bg-popover shadow-md">
                        <CommandList className="max-h-[min(50dvh,360px)]" label={t('suggestions')}>
                            {(status === 'loading' || resolving || error || status === 'error') && (
                                <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
                                    {t(error ?? (status === 'error' ? 'error' : 'searching'))}
                                </p>
                            )}
                            {status === 'ready' && results.length === 0 && (
                                <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
                                    {t('no_results')}
                                </p>
                            )}
                            <CommandGroup>
                                {results.map((result) => (
                                    <CommandItem
                                        onMouseDown={(event) => event.preventDefault()}
                                        key={result.key}
                                        value={result.key}
                                        onSelect={() => choose(result)}
                                        className="min-h-11 gap-3 px-3 py-2"
                                    >
                                        <MapPin className="size-4" aria-hidden />
                                        <span className="min-w-0">
                                            <span className="block truncate">{result.label}</span>
                                            {result.sub && <span className="block truncate text-xs text-muted-foreground">{result.sub}</span>}
                                        </span>
                                    </CommandItem>
                                ))}
                                {query.trim().length >= 2 && (
                                    <CommandItem
                                        onMouseDown={(event) => event.preventDefault()}
                                        value="resolve-destination"
                                        disabled={resolving}
                                        onSelect={() => void resolve()}
                                        className="min-h-11 gap-3 px-3 py-2"
                                    >
                                        <Search className="size-4" aria-hidden />
                                        <span>{t('search_near', { term: query.trim() })}</span>
                                    </CommandItem>
                                )}
                            </CommandGroup>
                            {query.trim().length < 2 &&
                                (recent.length ? (
                                    <CommandGroup heading={t('recent')}>
                                        {recent.map((term) => (
                                            <CommandItem
                                                onMouseDown={(event) => event.preventDefault()}
                                                key={term}
                                                value={term}
                                                onSelect={() => setQuery(term)}
                                                className="min-h-11 px-3"
                                            >
                                                {term}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ) : (
                                    <p className="px-4 py-3 text-sm text-muted-foreground">{t('start_typing')}</p>
                                ))}
                        </CommandList>
                        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                            {t('attribution')}{' '}
                            <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline">
                                Geoapify
                            </a>{' '}
                            · ©{' '}
                            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
                                OpenStreetMap
                            </a>{' '}
                            {t('contributors')}
                        </p>
                    </div>
                )}
            </Command>
        </div>
    );
}
