import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { Hit } from '@/types/search';

import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import { useSearchQuery as useSearchRQ } from '@/hooks/use-search-query';
import { useRecentSearches } from '@/hooks/use-search-recent';

import Heading from '@/components/heading';
import { Input } from '@/components/ui/input';
import { highlight, HitIcon, mapHref } from '@/lib/search';
import { search } from '@/routes';
import { ArrowRight, Search as SearchIcon, X } from 'lucide-react';

type PageProps = { q: string };
type FilterType = 'all' | 'municipal' | 'offstreet' | 'community';

export default function Index() {
    const page = usePage<PageProps>();
    const initialQ = page.props.q ?? '';

    const { t: tSearch } = useTranslation('global/search');
    const { t } = useResourceTranslation('backend/search');

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: search() }];

    const [q, setQ] = useState<string>(initialQ);
    const [type, setType] = useState<FilterType>(() => {
        const url = new URL(typeof window !== 'undefined' ? window.location.href : 'https://dummy.local');
        const p = (url.searchParams.get('type') || 'all') as FilterType;
        return ['all', 'municipal', 'offstreet', 'community'].includes(p) ? p : 'all';
    });

    // data (debounced query) + URL-sync
    const debounced = useDebouncedValue(q, 300);
    const mountedRef = useRef(false);

    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }
        router.get(search(), { q: debounced.trim(), type: type === 'all' ? undefined : type }, { preserveState: true, replace: true });
    }, [debounced, type]);

    const { data, isFetching, isError } = useSearchRQ(debounced || '', 80);
    const allHits = useMemo<Hit[]>(() => data?.hits ?? [], [data]);

    const hits = useMemo<Hit[]>(() => (type === 'all' ? allHits : allHits.filter((h) => h.type === type)), [allHits, type]);

    const hasQuery = q.trim().length > 0;
    const counts = useMemo(() => {
        const c = { all: allHits.length, municipal: 0, offstreet: 0, community: 0 };
        for (const h of allHits) {
            if (h.type === 'municipal') c.municipal++;
            else if (h.type === 'offstreet') c.offstreet++;
            else if (h.type === 'community') c.community++;
        }
        return c;
    }, [allHits]);

    const { items: recent, clear: clearRecent } = useRecentSearches();

    const FilterTabs = () => {
        const Item = ({ value, label, count }: { value: FilterType; label: string; count: number }) => {
            const active = type === value;
            return (
                <button
                    onClick={() => setType(value)}
                    aria-pressed={active}
                    className={[
                        'inline-flex shrink-0 items-center gap-1 border-b-2 px-0.5 pb-1 text-sm transition',
                        active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                        'cursor-pointer',
                    ].join(' ')}
                >
                    <span>{label}</span>
                    {hasQuery && <span className="text-[11px] text-muted-foreground/80">({count})</span>}
                </button>
            );
        };

        return (
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <nav className="flex w-max max-w-full items-center gap-4">
                    <Item value="all" label={t('filters.all', { defaultValue: 'Alle' })} count={counts.all} />
                    <Item value="municipal" label={t('filters.municipal', { defaultValue: 'Municipal' })} count={counts.municipal} />
                    <Item value="offstreet" label={t('filters.offstreet', { defaultValue: 'Garage / P+R' })} count={counts.offstreet} />
                    <Item value="community" label={t('filters.community', { defaultValue: 'Community' })} count={counts.community} />
                </nav>
            </div>
        );
    };

    const SkeletonRow = () => (
        <li className="px-2 sm:px-3">
            <div className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                <div className="min-w-0 flex-1">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-muted/80" />
                </div>
            </div>
        </li>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={q ? `${t('head.title')} — ${q}` : t('head.title')} />
            <div className="px-4 py-6 sm:px-6">
                <div className="space-y-6">
                    <Heading title={t('head.title')} description={t('head.description')} />

                    <section className="space-y-3">
                        <div className="flex items-center rounded-xl border bg-background px-3 sm:px-4">
                            <SearchIcon className="mr-2 h-4 w-4 opacity-60" aria-hidden />
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={tSearch('placeholder')}
                                className="h-11 border-0 bg-transparent pl-0 ring-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                aria-label={tSearch('aria_input')}
                                autoFocus
                                inputMode="search"
                            />
                            {q && (
                                <button
                                    onClick={() => setQ('')}
                                    className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
                                    aria-label={t('actions.clear', { defaultValue: 'Clear' })}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Recent chips */}
                        {!hasQuery && recent.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                    <div className="text-[11px] tracking-wide text-muted-foreground/70 uppercase">
                                        {tSearch('recent', { defaultValue: 'Recent' })}
                                    </div>
                                    <button
                                        onClick={clearRecent}
                                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground"
                                        aria-label={tSearch('clear_recent', { defaultValue: 'Clear recent searches' })}
                                    >
                                        <X className="h-3 w-3" />
                                        {tSearch('clear', { defaultValue: 'Clear' })}
                                    </button>
                                </div>
                                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {recent.slice(0, 10).map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setQ(r)}
                                            className="cursor-pointer rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                                            aria-label={tSearch('apply_chip', { term: r })}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <FilterTabs />
                    </section>

                    {/* Meta */}
                    {hasQuery && (
                        <div className="text-sm text-muted-foreground" aria-live="polite">
                            {isFetching ? tSearch('searching') : t('results.count', { count: hits.length, q })}
                        </div>
                    )}

                    {/* Results */}
                    <section className="overflow-hidden rounded-xl border">
                        {isError ? (
                            <div className="px-4 py-12 text-center text-sm text-red-600">{tSearch('error')}</div>
                        ) : isFetching && !allHits.length ? (
                            <ul className="divide-y">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <SkeletonRow key={i} />
                                ))}
                            </ul>
                        ) : !hasQuery ? (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">{tSearch('start_typing')}</div>
                        ) : !hits.length ? (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">{tSearch('no_results')}</div>
                        ) : (
                            <ul className="divide-y">
                                {hits.map((h) => (
                                    <li key={`${h.index}-${h.id}`} className="px-2 sm:px-3">
                                        <Link
                                            href={mapHref(h)}
                                            className="group flex cursor-pointer items-center gap-3 py-3 transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                <HitIcon type={h.type} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium">{highlight(String(h.label), q)}</div>
                                                {h.sub && <div className="truncate text-xs text-muted-foreground">{highlight(String(h.sub), q)}</div>}
                                            </div>
                                            <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
