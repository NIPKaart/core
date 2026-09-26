import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useRecentSearches } from '@/hooks/use-search-recent';
import { cn } from '@/lib/utils';
import { locationMap } from '@/routes';
import { resolve as resolveDestination, suggestions } from '@/routes/destinations';
import type { DestinationResult } from '@/types/destination';
import { Root as VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArrowRight, MapPin, Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JSX } from 'react/jsx-runtime';
import { closeSearch, setSearchQuery, useSearchOpen, useSearchQuery } from './search-store';

export default function SearchOverlay(): JSX.Element {
    const { t } = useTranslation('global/search');
    const open = useSearchOpen();
    const query = useSearchQuery();
    const inputRef = useRef<HTMLInputElement>(null);
    const isMobile = useMediaQuery();
    const { items: recent, add: addRecent, clear: clearRecent } = useRecentSearches();
    const debounced = useDebouncedValue(query.trim(), 450);
    const [results, setResults] = useState<DestinationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    useEffect(() => {
        if (!open || debounced.length < 2) {
            setLoading(false);
            setResults([]);
            return;
        }

        controller.current?.abort();
        const request = new AbortController();
        controller.current = request;
        setError(null);
        setLoading(true);
        fetch(suggestions.url({ query: { q: debounced, limit: 10 } }), {
            signal: request.signal,
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) throw new Error('Search failed');
                const data = await response.json();
                if (!request.signal.aborted) setResults(data.results ?? []);
            })
            .catch(() => {
                if (!request.signal.aborted) {
                    setResults([]);
                    setError('error');
                }
            })
            .finally(() => {
                if (!request.signal.aborted) setLoading(false);
            });

        return () => request.abort();
    }, [open, debounced]);

    function goToDestination(destination: DestinationResult) {
        addRecent(destination.label);
        closeSearch();
        setSearchQuery('');
        window.location.href = locationMap.url({
            query: {
                destination: destination.type === 'street' && destination.sub ? `${destination.label}, ${destination.sub}` : destination.label,
                lat: String(destination.latitude),
                lng: String(destination.longitude),
                ...(destination.bounds ? destination.bounds : {}),
            },
        });
    }

    async function resolve() {
        const value = query.trim();
        if (value.length < 2 || resolving) return;
        setResolving(true);
        setError(null);
        try {
            const response = await fetch(resolveDestination.url({ query: { q: value } }), { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Resolution failed');
            const data = await response.json();
            if (data.result) goToDestination(data.result);
            else setError('no_destination');
        } catch {
            setError('error');
        } finally {
            setResolving(false);
        }
    }

    const SearchInput = (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                void resolve();
            }}
            className="flex flex-col gap-3"
        >
            <div className="flex min-h-12 items-center gap-2 rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <SearchIcon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
                <input
                    ref={inputRef}
                    type="search"
                    inputMode="search"
                    placeholder={t('placeholder')}
                    value={query}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
                    aria-label={t('aria_input')}
                />
            </div>
            {query.trim().length >= 2 && (
                <Button type="submit" disabled={resolving} className="h-auto min-h-11 justify-between gap-3 px-4 py-3 text-left whitespace-normal">
                    <span>{resolving ? t('searching') : t('search_near', { term: query.trim() })}</span>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Button>
            )}
        </form>
    );

    const RecentChips =
        recent.length > 0 ? (
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <div className="text-[11px] tracking-wide text-muted-foreground/70 uppercase">{t('recent')}</div>
                    <button
                        type="button"
                        onClick={clearRecent}
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground"
                        aria-label={t('clear_recent')}
                    >
                        <X className="h-3 w-3" /> {t('clear')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {recent.map((item) => (
                        <button
                            type="button"
                            key={item}
                            onClick={() => setSearchQuery(item)}
                            className="cursor-pointer rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                            aria-label={t('apply_chip', { term: item })}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>
        ) : null;

    const Results = query.trim().length >= 2 && (
        <ul aria-label={t('suggestions')} className="max-h-[40dvh] overflow-y-auto rounded-xl border bg-background/70">
            {loading || query.trim() !== debounced ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('searching')}</li>
            ) : results.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('no_results')}</li>
            ) : (
                results.map((result) => (
                    <li key={result.key}>
                        <button
                            type="button"
                            onClick={() => goToDestination(result)}
                            className="group flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                            <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">
                                    {['Municipal spot', 'Community spot'].includes(result.label) ? t('unknown_address') : result.label}
                                </div>
                                {result.sub && <div className="text-xs text-muted-foreground">{result.sub}</div>}
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {result.type === 'street'
                                        ? t('parking_count', { count: result.parking_count })
                                        : t(`types.${['community', 'municipal', 'offstreet'].includes(result.type) ? result.type : 'destination'}`)}
                                </div>
                            </div>
                            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                    </li>
                ))
            )}
        </ul>
    );

    const Body = (
        <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:gap-3">
                {SearchInput}
                {RecentChips}
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {t(error)}
                    </p>
                )}
                {query.trim().length >= 2 && <h2 className="mt-2 text-sm font-semibold">{t('suggestions')}</h2>}
                {Results}
                {query.trim().length >= 2 && (
                    <p className="text-[11px] text-muted-foreground/70">
                        {t('attribution')}{' '}
                        <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">
                            Geoapify
                        </a>{' '}
                        · ©{' '}
                        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
                            OpenStreetMap
                        </a>{' '}
                        {t('contributors')}
                    </p>
                )}
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer
                autoFocus
                open={open}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        closeSearch();
                        setSearchQuery('');
                    }
                }}
            >
                <DrawerContent className="p-0">
                    <VisuallyHidden>
                        <DialogTitle>{t('title')}</DialogTitle>
                        <DialogDescription>{t('description')}</DialogDescription>
                    </VisuallyHidden>
                    {Body}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    closeSearch();
                    setSearchQuery('');
                }
            }}
        >
            <DialogContent className={cn('rounded-2xl border-0 p-0 shadow-xl sm:max-w-2xl md:max-w-3xl', '[&>button.absolute.right-4.top-4]:hidden')}>
                <DialogHeader>
                    <VisuallyHidden>
                        <DialogTitle>{t('title')}</DialogTitle>
                        <DialogDescription>{t('description')}</DialogDescription>
                    </VisuallyHidden>
                </DialogHeader>
                {Body}
            </DialogContent>
        </Dialog>
    );
}
