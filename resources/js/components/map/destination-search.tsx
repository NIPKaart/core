import { closeSearch, openSearch, useSearchOpen } from '@/components/search/search-store';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDestinationSuggestions } from '@/hooks/use-destination-suggestions';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSearchHotkey } from '@/hooks/use-search-hotkey';
import { useRecentSearches } from '@/hooks/use-search-recent';
import { resolve as resolveDestination } from '@/routes/destinations';
import type { DestinationResult } from '@/types/destination';
import { ArrowLeft, History, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DestinationSearch({
    destination,
    onSelect,
    onClear,
}: {
    destination: DestinationResult | null;
    onSelect: (value: DestinationResult) => void;
    onClear: () => void;
}) {
    const { t } = useTranslation('global/search');
    const { t: tMap } = useTranslation('frontend/map/main');
    const open = useSearchOpen();
    const desktop = useMediaQuery('(min-width: 1024px)');
    const [query, setQuery] = useState(destination?.label ?? '');
    const [error, setError] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState('');
    const editing = query !== destination?.label;
    const { results, status } = useDestinationSuggestions(query, open && editing);
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
        if (open) {
            input.current?.focus();
            input.current?.select();
        } else setQuery(destination?.label ?? '');
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

    useEffect(() => {
        if (!open || desktop) return;
        const viewport = window.visualViewport;
        const resize = () => {
            if (!container.current) return;
            const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
            container.current.style.setProperty('--search-height', `${Math.max(120, bottom - container.current.getBoundingClientRect().top - 12)}px`);
        };
        resize();
        viewport?.addEventListener('resize', resize);
        viewport?.addEventListener('scroll', resize);
        return () => {
            viewport?.removeEventListener('resize', resize);
            viewport?.removeEventListener('scroll', resize);
        };
    }, [open, desktop]);

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
        <div
            ref={container}
            id="map-destination-search"
            hidden={!desktop && !open}
            className="map-destination-search pointer-events-auto relative flex max-h-(--search-height) w-full flex-col bg-background p-3 shadow-lg lg:max-h-none lg:w-[440px] lg:bg-transparent lg:p-0 lg:shadow-none"
        >
            <Command
                shouldFilter={false}
                value={selectedSuggestion}
                onValueChange={setSelectedSuggestion}
                label={t('aria_input')}
                className="h-auto min-h-0 overflow-visible rounded-none bg-transparent lg:rounded-xl lg:border lg:border-border/70 lg:bg-background lg:shadow-md lg:focus-within:border-ring [&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input-wrapper]>svg]:size-[18px]"
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
                <div className="relative flex shrink-0 items-center rounded-xl bg-muted/60 focus-within:ring-2 focus-within:ring-ring/40 lg:bg-transparent lg:focus-within:ring-0">
                    {!desktop && (
                        <Button variant="ghost" size="icon" className="ml-1 size-11 shrink-0" aria-label={tMap('filters.close')} onClick={dismiss}>
                            <ArrowLeft className="size-4" aria-hidden />
                        </Button>
                    )}
                    <div className="min-w-0 flex-1 max-lg:[&_[data-slot=command-input-wrapper]]:pl-0 max-lg:[&_[data-slot=command-input-wrapper]>svg]:hidden">
                        <CommandInput
                            asChild
                            ref={input}
                            value={query}
                            onValueChange={setQuery}
                            onFocus={openSearch}
                            placeholder={tMap('toolbar.search')}
                            className="h-12 pr-11 text-base lg:text-sm"
                        >
                            <input
                                aria-label={t('aria_input')}
                                aria-expanded={open}
                                enterKeyHint="search"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                        </CommandInput>
                    </div>
                    {query && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 size-11"
                            aria-label={t('clear')}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
                            }}
                            onClick={() => {
                                resolver.current?.abort();
                                setQuery('');
                                setError(null);
                                setResolving(false);
                                onClear();
                                input.current?.focus();
                            }}
                        >
                            <X className="size-4" aria-hidden />
                        </Button>
                    )}
                </div>
                {open && (
                    <div className="mt-2 flex min-h-0 flex-col overflow-hidden bg-popover lg:absolute lg:top-full lg:right-0 lg:left-0 lg:mt-2 lg:rounded-xl lg:border lg:shadow-lg">
                        <CommandList
                            className="max-h-[min(60dvh,420px)] min-h-0 overscroll-contain lg:max-h-[min(50dvh,360px)]"
                            label={t('suggestions')}
                        >
                            {(status === 'loading' || resolving || error || status === 'error') && (
                                <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
                                    {t(error ?? (status === 'error' ? 'error' : 'searching'))}
                                </p>
                            )}
                            {status === 'ready' && results.length === 0 && editing && (
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
                                        className="min-h-14 cursor-pointer gap-3 rounded-lg px-3 py-3"
                                    >
                                        <MapPin className="size-4" aria-hidden />
                                        <span className="min-w-0">
                                            <span className="block leading-snug">{result.label}</span>
                                            {result.sub && (
                                                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{result.sub}</span>
                                            )}
                                        </span>
                                    </CommandItem>
                                ))}
                                {query.trim().length >= 2 && editing && (
                                    <CommandItem
                                        onMouseDown={(event) => event.preventDefault()}
                                        value="resolve-destination"
                                        disabled={resolving}
                                        onSelect={() => void resolve()}
                                        className="min-h-14 cursor-pointer gap-3 rounded-lg px-3 py-3"
                                    >
                                        <Search className="size-4" aria-hidden />
                                        <span>{t('search_near', { term: query.trim() })}</span>
                                    </CommandItem>
                                )}
                            </CommandGroup>
                            {(query.trim().length < 2 || !editing) &&
                                (recent.length ? (
                                    <CommandGroup heading={t('recent')}>
                                        {recent.map((term) => (
                                            <CommandItem
                                                onMouseDown={(event) => event.preventDefault()}
                                                key={term}
                                                value={term}
                                                onSelect={() => {
                                                    if (term === destination?.label) dismiss();
                                                    else setQuery(term);
                                                }}
                                                className="min-h-14 cursor-pointer gap-3 rounded-lg px-3"
                                            >
                                                <History className="size-4" aria-hidden />
                                                <span>{term}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ) : (
                                    <p className="px-4 py-3 text-sm text-muted-foreground">{t('start_typing')}</p>
                                ))}
                        </CommandList>
                        <p className="shrink-0 border-t px-3 pt-3 pb-1 text-[10px] leading-relaxed text-muted-foreground lg:py-2">
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
