import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { PaginatedResponse } from '@/types';
import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, ListFilter, Search, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kbd } from './shortcuts';
import { filterQuery, type Filters, type ItemType, type Options, type QueueItem } from './types';
import { useChangeSummary } from './values';

/** One colour per kind of item, used in the queue and on the map. */
export const TYPE_COLORS: Record<ItemType, string> = { report: '#dc2626', submission: '#d97706', improvement: '#2563eb' };

/** A short age such as "9d" or "3u", so the queue reads at a glance. */
export function useShortAge() {
    const { t } = useTranslation('backend/moderation');

    return (value: string) => {
        const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
        if (minutes < 60) return t('age.minutes', { count: minutes });
        if (minutes < 60 * 24) return t('age.hours', { count: Math.floor(minutes / 60) });
        return t('age.days', { count: Math.floor(minutes / (60 * 24)) });
    };
}

/** The second line of a queue row: what this item is about, in one phrase. */
export function useItemPreview() {
    const { t } = useTranslation('backend/moderation');
    const summary = useChangeSummary();

    return (item: QueueItem): string => {
        switch (item.type) {
            case 'report':
                return item.preview ? `“${item.preview}”` : t('flags.reports', { count: item.flags.reports ?? 0 });
            case 'improvement':
                return summary(item.changes ?? [], item.distance_metres ?? null);
            case 'submission':
                if (item.flags.nearby_municipal_metres != null) return t('flags.nearby_municipal', { distance: item.flags.nearby_municipal_metres });
                return item.contributor && item.contributor.approved + item.contributor.rejected === 0
                    ? t('queue.first_submission')
                    : t('queue.submission');
        }
    };
}

export function QueueList({
    status,
    items,
    filters,
    options,
    selectedKey,
    checked,
    onCheck,
    decidedToday,
    onOpen,
    onFilter,
    hidden,
}: {
    status: 'open' | 'decided';
    items: PaginatedResponse<QueueItem> | null;
    filters: Filters;
    options: Options;
    selectedKey: string | null;
    checked: string[];
    onCheck: (keys: string[]) => void;
    decidedToday: number;
    onOpen: (item: QueueItem) => void;
    onFilter: (next: Partial<Filters>) => void;
    /** Hidden on small screens while an item is open there. */
    hidden: boolean;
}) {
    const { t } = useTranslation('backend/moderation');
    const query = filterQuery(filters);
    const [searching, setSearching] = useState(Boolean(filters.search));
    const [search, setSearch] = useState(filters.search ?? '');
    const searchInput = useRef<HTMLInputElement>(null);
    const age = useShortAge();
    const preview = useItemPreview();

    useEffect(() => {
        if (search === (filters.search ?? '')) return;
        const timer = setTimeout(() => onFilter({ search: search || null }), 300);
        return () => clearTimeout(timer);
        // Only the typed search should trigger this debounce.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const rows = items?.data ?? [];
    const groups = [
        { key: 'high', label: t('priority.high'), rows: rows.filter((item) => item.priority === 'high') },
        { key: 'normal', label: t('queue.oldest_first'), rows: rows.filter((item) => item.priority === 'normal') },
    ].filter((group) => group.rows.length > 0);
    const selectable = (item: QueueItem) => item.type !== 'report' && options.can[item.type];
    const selecting = checked.length > 0;
    const toggle = (key: string, on: boolean) => onCheck(on ? [...checked, key] : checked.filter((item) => item !== key));
    const total = items?.total ?? 0;
    const progress = decidedToday + total > 0 ? Math.round((decidedToday / (decidedToday + total)) * 100) : 0;

    const typeLabel =
        filters.types.length === 0
            ? t('queue.all_types')
            : filters.types.length === 1
              ? t(`types.${filters.types[0]}`)
              : t('queue.types_count', { count: filters.types.length });
    const municipalityLabel =
        filters.municipality_ids.length === 0
            ? t('queue.all_municipalities')
            : filters.municipality_ids.length === 1
              ? (options.municipalities.find((municipality) => String(municipality.id) === filters.municipality_ids[0])?.name ?? '')
              : t('queue.municipalities_count', { count: filters.municipality_ids.length });

    return (
        <section
            aria-label={t('queue.label')}
            className={cn('flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r lg:w-[360px]', hidden && 'hidden lg:flex')}
        >
            <h1 className="sr-only">{t('title')}</h1>
            <nav aria-label={t('tabs.label')} className="flex shrink-0 gap-5 border-b pr-3 pl-5">
                {(['open', 'decided'] as const).map((tab) => (
                    <Link
                        key={tab}
                        href={app.moderation.index({
                            query: tab === 'decided' ? { ...(query.type ? { type: query.type } : {}), status: 'decided' } : query,
                        })}
                        aria-current={status === tab ? 'page' : undefined}
                        className={cn(
                            'flex h-10 items-center gap-1.5 border-b-2 text-sm',
                            status === tab
                                ? 'border-foreground font-semibold text-foreground'
                                : 'border-transparent font-medium text-neutral-400 hover:text-foreground',
                        )}
                    >
                        {t(`tabs.${tab}`)}
                        {tab === 'open' && status === 'open' && <span className="font-medium text-neutral-400 tabular-nums">{total}</span>}
                    </Link>
                ))}
                <span className="ml-auto flex items-center gap-0.5 self-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer text-muted-foreground"
                        aria-label={t('search')}
                        aria-pressed={searching}
                        onClick={() => {
                            setSearching((value) => !value);
                            setTimeout(() => searchInput.current?.focus());
                        }}
                    >
                        <Search className="size-[18px]" />
                    </Button>
                    {(filters.types.length > 0 || filters.municipality_ids.length > 0 || filters.search) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 cursor-pointer text-muted-foreground"
                            aria-label={t('queue.clear_filters')}
                            onClick={() => {
                                setSearch('');
                                onFilter({ types: [], municipality_ids: [], search: null });
                            }}
                        >
                            <ListFilter className="size-[18px]" />
                        </Button>
                    )}
                </span>
            </nav>

            {status === 'open' && (
                <div className="flex shrink-0 flex-col gap-2.5 px-5 pt-3 pb-2">
                    {searching && (
                        <div className="relative">
                            <Input
                                ref={searchInput}
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('search')}
                                aria-label={t('search')}
                                className="h-8 pr-8 text-sm"
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label={t('queue.clear_search')}
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex gap-1.5">
                        {options.types.length > 1 && (
                            <FilterMenu
                                label={typeLabel}
                                options={options.types.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                                selected={filters.types}
                                onChange={(types) => onFilter({ types: types as ItemType[] })}
                            />
                        )}
                        {options.municipalities.length > 0 && (
                            <FilterMenu
                                label={municipalityLabel}
                                options={options.municipalities.map((municipality) => ({ value: String(municipality.id), label: municipality.name }))}
                                selected={filters.municipality_ids}
                                onChange={(municipality_ids) => onFilter({ municipality_ids })}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
                            <span className="block h-full bg-green-600" style={{ width: `${progress}%` }} />
                        </span>
                        <span className="whitespace-nowrap">{t('queue.decided_today', { count: decidedToday })}</span>
                    </div>
                </div>
            )}

            <div className="flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-col overflow-y-auto pb-2 hover:scrollbar-thumb-muted-foreground/50">
                {status === 'open' && rows.length === 0 && (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                        {t(Object.keys(query).length ? 'empty.filtered' : 'empty.open')}
                    </p>
                )}
                {groups.map((group) => (
                    <Fragment key={group.key}>
                        <div className="flex justify-between px-5 pt-3 pb-1 text-xs font-medium text-neutral-400">
                            <span>{group.label}</span>
                            <span className="tabular-nums">{group.rows.length}</span>
                        </div>
                        <ul className="flex flex-col">
                            {group.rows.map((item) => {
                                const isChecked = checked.includes(item.key);
                                return (
                                    <li key={item.key} className="group/row relative mx-2">
                                        <button
                                            type="button"
                                            onClick={() => onOpen(item)}
                                            aria-current={item.key === selectedKey ? 'true' : undefined}
                                            className={cn(
                                                'flex w-full cursor-pointer gap-3 rounded-[9px] px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                                item.key === selectedKey && 'bg-neutral-100 hover:bg-neutral-100',
                                                isChecked && item.key !== selectedKey && 'bg-neutral-50',
                                                selecting && 'pl-[38px]',
                                            )}
                                        >
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="flex justify-between gap-2">
                                                    <span className="truncate text-sm font-semibold">{item.street || t('no_address')}</span>
                                                    <span
                                                        className={cn(
                                                            'shrink-0 text-xs text-neutral-400',
                                                            !selecting && selectable(item) && 'group-hover/row:invisible',
                                                        )}
                                                    >
                                                        {age(item.waiting_since)}
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1.5 overflow-hidden text-[13px] whitespace-nowrap text-muted-foreground">
                                                    <span
                                                        className="size-1.5 shrink-0 rounded-full"
                                                        style={{ background: TYPE_COLORS[item.type] }}
                                                        aria-hidden
                                                    />
                                                    <span className="sr-only">{t(`types.${item.type}`)}</span>
                                                    {item.municipality && <span className="shrink-0">{item.municipality}</span>}
                                                    {item.municipality && (
                                                        <span className="text-neutral-400" aria-hidden>
                                                            ·
                                                        </span>
                                                    )}
                                                    <span className="truncate">{preview(item)}</span>
                                                </span>
                                            </span>
                                        </button>
                                        {selectable(item) && (
                                            <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={(on) => toggle(item.key, !!on)}
                                                aria-label={t('select_item', { place: item.street ?? t('no_address') })}
                                                className={cn(
                                                    'absolute top-[11px] cursor-pointer bg-background',
                                                    selecting ? 'left-3' : 'right-3 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
                                                )}
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </Fragment>
                ))}
                {items && items.last_page > 1 && (
                    <div className="mt-2 flex items-center justify-between px-5 text-xs text-muted-foreground">
                        <span>{t('queue.page', { from: items.from, to: items.to, total: items.total })}</span>
                        <span className="flex gap-1">
                            <PageLink href={items.prev_page_url} label={t('queue.previous_page')} icon={ChevronLeft} />
                            <PageLink href={items.next_page_url} label={t('queue.next_page')} icon={ChevronRight} />
                        </span>
                    </div>
                )}
            </div>

            {status === 'open' && (
                <div className="mt-auto flex h-10 shrink-0 items-center gap-3.5 overflow-hidden border-t bg-neutral-50 px-4 text-xs whitespace-nowrap text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Kbd>J</Kbd>
                        <Kbd>K</Kbd> {t('shortcuts.short.next')}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>↵</Kbd> {t('shortcuts.short.open')}
                    </span>
                    {selecting && (
                        <span className="flex items-center gap-1">
                            <Kbd>X</Kbd> {t('shortcuts.short.select')}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Kbd>?</Kbd> {t('shortcuts.short.more')}
                    </span>
                </div>
            )}
        </section>
    );
}

function PageLink({ href, label, icon: Icon }: { href: string | null; label: string; icon: typeof ChevronLeft }) {
    return href ? (
        <Link
            href={href}
            preserveScroll
            preserveState
            aria-label={label}
            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
        >
            <Icon className="size-4" />
        </Link>
    ) : (
        <span aria-hidden className="flex size-7 items-center justify-center rounded-md border opacity-40">
            <Icon className="size-4" />
        </span>
    );
}

/** A compact filter: one button that names the current choice, with every option to tick on or off. */
function FilterMenu({
    label,
    options,
    selected,
    onChange,
}: {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
}) {
    const { t } = useTranslation('backend/moderation');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex h-7 max-w-40 cursor-pointer items-center gap-1 rounded-[7px] border px-2.5 pr-2 text-[13px] font-medium whitespace-nowrap hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <span className="truncate">{label}</span>
                    <ChevronDown className="size-[13px] shrink-0 text-neutral-400" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
                {options.map((option) => (
                    <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selected.includes(option.value)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(on) => onChange(on ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
                    >
                        {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
                {selected.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onChange([])}>{t('queue.clear_filter')}</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
