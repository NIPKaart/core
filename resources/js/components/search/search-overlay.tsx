import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSearchQuery as useSearchRQ } from '@/hooks/use-search-query';
import { useRecentSearches } from '@/hooks/use-search-recent';
import { cn } from '@/lib/utils';
import type { Hit } from '@/types/search';
import { Link } from '@inertiajs/react';
import { Root as VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ArrowRight, Building2, MapPin, Search as SearchIcon, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { JSX } from 'react/jsx-runtime';
import { closeSearch, setSearchQuery, useSearchOpen, useSearchQuery as useSearchStoreQuery } from './search-store';

const icon = (t: Hit['type']): JSX.Element =>
    t === 'offstreet' ? <Building2 className="h-4 w-4" /> : t === 'community' ? <User className="h-4 w-4" /> : <MapPin className="h-4 w-4" />;

const zoom: Record<Hit['type'], number> = {
    community: 18,
    municipal: 18,
    offstreet: 16,
    other: 14,
};

const highlight = (text: string, q: string) => {
    const s = q.trim();
    if (!s) return text;
    const i = text.toLowerCase().indexOf(s.toLowerCase());
    if (i === -1) return text;
    return (
        <>
            {text.slice(0, i)}
            <mark className="rounded bg-yellow-200/50 px-0.5 font-medium dark:bg-yellow-300/20">{text.slice(i, i + s.length)}</mark>
            {text.slice(i + s.length)}
        </>
    );
};

const mapHref = (h: Hit) =>
    typeof h.lat === 'number' && typeof h.lng === 'number' ? `/map#${zoom[h.type] ?? 16}/${h.lat.toFixed(5)}/${h.lng.toFixed(5)}` : h.href;

export default function SearchOverlay(): JSX.Element {
    const { t } = useTranslation('global/search');
    const open = useSearchOpen();
    const q = useSearchStoreQuery();
    const inputRef = useRef<HTMLInputElement>(null);
    const isMobile = useMediaQuery();

    // recent chips
    const { items: recent, add: addRecent, clear: clearRecent } = useRecentSearches();

    // debounce + react-query
    const debounced = useDebouncedValue(q, 250);
    const { data, isFetching, isError } = useSearchRQ(debounced, 10);
    const hits = useMemo<Hit[]>(() => data?.hits ?? [], [data]);

    // autofocus when opened
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    // keyboard: Escape = close, Enter = go to first result (if any)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeSearch();
                setSearchQuery('');
            } else if (e.key === 'Enter' && q.trim() && !hits.length && !isFetching) {
                addRecent(q);
                window.location.href = `/search?q=${encodeURIComponent(q.trim())}`;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, q, hits.length, isFetching, addRecent]);

    // ——— Sections ———
    const Tip = !isMobile ? (
        <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-accent/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> {t('tip')}
            </div>
        </div>
    ) : null;

    const SearchInput = (
        <div className="relative flex h-12 items-center rounded-xl border bg-background px-3 sm:px-4">
            <SearchIcon className="mr-2 h-4 w-4 opacity-60" />
            <input
                ref={inputRef}
                type="search"
                inputMode="search"
                placeholder={t('placeholder')}
                value={q}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="peer w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
                aria-label={t('aria_input')}
            />
            <kbd className="ml-2 hidden items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:flex">Enter</kbd>
        </div>
    );

    const RecentChips =
        recent.length > 0 ? (
            <div>
                <div className="mb-1 flex items-center justify-between">
                    <div className="text-[11px] tracking-wide text-muted-foreground/70 uppercase">{t('recent')}</div>
                    <button
                        onClick={clearRecent}
                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground"
                        aria-label={t('clear_recent')}
                    >
                        <X className="h-3 w-3" /> {t('clear')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {recent.map((c: string) => (
                        <button
                            key={c}
                            onClick={() => setSearchQuery(c)}
                            className="cursor-pointer rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                            aria-label={t('apply_chip', { term: c })}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>
        ) : null;

    const Results = (q.trim().length > 0 || isFetching || hits.length > 0 || isError) && (
        <div>
            <ul className="overflow-hidden rounded-2xl border bg-background/70">
                {isError ? (
                    <li className="px-4 py-8 text-center text-sm text-red-600">{t('error')}</li>
                ) : isFetching && !hits.length ? (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('searching')}</li>
                ) : !q.trim() && !hits.length ? (
                    <></>
                ) : !hits.length ? (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('no_results')}</li>
                ) : (
                    hits.map((h) => (
                        <li key={`${h.index}-${h.id}`}>
                            <Link
                                href={mapHref(h)}
                                onClick={() => {
                                    addRecent(q);
                                    closeSearch();
                                    setSearchQuery('');
                                }}
                                className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-muted/60"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon(h.type)}</div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{highlight(h.label, q)}</div>
                                    {h.sub && <div className="truncate text-xs text-muted-foreground">{highlight(h.sub, q)}</div>}
                                </div>
                                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
                            </Link>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );

    // ——— Body with consistent vertical spacing ———
    const Body = (
        <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:gap-3">
                {Tip}
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
                onOpenChange={(o) => {
                    if (!o) {
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
            onOpenChange={(o) => {
                if (!o) {
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
