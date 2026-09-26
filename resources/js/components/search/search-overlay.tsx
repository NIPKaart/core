import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useRecentSearches } from '@/hooks/use-search-recent';
import { cn } from '@/lib/utils';
import type { DestinationResult } from '@/types/destination';
import { Root as VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArrowRight, Search as SearchIcon, X } from 'lucide-react';
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
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    useEffect(() => {
        if (!open || debounced.length < 2) {
            setResults([]);
            return;
        }

        controller.current?.abort();
        controller.current = new AbortController();
        setLoading(true);
        fetch(`/api/destinations/suggestions?q=${encodeURIComponent(debounced)}&limit=10`, {
            signal: controller.current.signal,
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (response.ok) setResults((await response.json()).results ?? []);
            })
            .catch((error) => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) setResults([]);
            })
            .finally(() => setLoading(false));

        return () => controller.current?.abort();
    }, [open, debounced]);

    function goToDestination(destination: DestinationResult) {
        addRecent(destination.label);
        closeSearch();
        setSearchQuery('');
        const params = new URLSearchParams({
            destination: destination.label,
            lat: String(destination.latitude),
            lng: String(destination.longitude),
        });
        window.location.href = `/map?${params}`;
    }

    async function resolve() {
        const value = query.trim();
        if (!value) return;
        if (results.length === 1) {
            goToDestination(results[0]);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/destinations/resolve?q=${encodeURIComponent(value)}`, { headers: { Accept: 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                if (data.result) goToDestination(data.result);
            }
        } finally {
            setLoading(false);
        }
    }

    const SearchInput = (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                void resolve();
            }}
            className="relative flex h-12 items-center rounded-xl border bg-background px-3 sm:px-4"
        >
            <SearchIcon className="mr-2 h-4 w-4 opacity-60" />
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

    const Results = query.trim().length > 0 && (
        <ul className="overflow-hidden rounded-2xl border bg-background/70">
            {loading && results.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('searching')}</li>
            ) : results.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('no_results')}</li>
            ) : (
                results.map((result) => (
                    <li key={result.key}>
                        <button
                            type="button"
                            onClick={() => goToDestination(result)}
                            className="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{result.label}</div>
                                {result.sub && <div className="truncate text-xs text-muted-foreground">{result.sub}</div>}
                            </div>
                            <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
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
                {Results}
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer
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
