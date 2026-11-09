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
import { Link, router } from '@inertiajs/react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ListChecks, Search, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationProposals, SOURCE_COLOR, toLocationProposal, type ProposalRow } from './location-proposals';
import { Kbd } from './shortcuts';
import { TYPE_ICONS } from './type-badge';
import { filterQuery, type Filters, type HistoryType, type ItemType, type Options, type QueueItem } from './types';
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
function useItemPreview() {
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

/**
 * The open queue in the panel beside the map: the open items with the oldest first and reports on top. Pointing at an
 * item highlights it on the map. Selecting items keeps the list where it is; the decision on them sits at the bottom.
 */
export function QueueList({
    status,
    locationProposals = [],
    items,
    filters,
    options,
    checked,
    onCheck,
    decidedToday,
    onOpen,
    onFilter,
    onHover,
    footer,
}: {
    status: 'open' | 'decided';
    locationProposals?: ProposalRow[];
    items: PaginatedResponse<QueueItem> | null;
    filters: Filters;
    options: Options;
    checked: string[];
    onCheck: (keys: string[]) => void;
    decidedToday: number;
    onOpen: (item: QueueItem) => void;
    onFilter: (next: Partial<Filters>) => void;
    onHover?: (key: string | null) => void;
    /** Replaces the shortcut hints, for example with the selection's decision. */
    footer?: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const query = filterQuery(filters);
    const age = useShortAge();
    const preview = useItemPreview();

    const rows = items?.data ?? [];
    const groups = [
        { key: 'high', label: t('priority.high'), rows: rows.filter((item) => item.priority === 'high') },
        { key: 'normal', label: t('queue.oldest_first'), rows: rows.filter((item) => item.priority === 'normal') },
    ].filter((group) => group.rows.length > 0);
    const selectable = (item: QueueItem) => item.type !== 'report' && options.can[item.type];
    /** On a touch screen there is no pointing at a row, so selecting starts with a button and a tap selects a row. */
    const [selectMode, setSelectMode] = useState(false);
    const selecting = checked.length > 0 || selectMode;
    const toggle = (key: string, on: boolean) => onCheck(on ? [...checked, key] : checked.filter((item) => item !== key));
    const canSelect = rows.some(selectable);
    const filtered = Object.keys(query).length > 0;

    return (
        <>
            <QueueHeader
                status={status}
                total={items?.total ?? 0}
                decidedToday={decidedToday}
                filters={filters}
                options={options}
                onFilter={onFilter}
                selectMode={canSelect ? selectMode : undefined}
                onSelectMode={(on) => {
                    setSelectMode(on);
                    if (!on) onCheck([]);
                }}
            />

            <div
                className="flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-col overflow-y-auto pb-2 hover:scrollbar-thumb-muted-foreground/50"
                onMouseLeave={() => onHover?.(null)}
            >
                {!filtered && locationProposals.length > 0 && (
                    <LocationProposals
                        proposals={locationProposals.map(toLocationProposal)}
                        onOpen={({ proposal, point }) =>
                            router.visit(app.moderation.proposals.index({ query: { proposal: proposal.id, point: point.id, from: 'queue' } }))
                        }
                    />
                )}
                {rows.length === 0 && (filtered || locationProposals.length === 0) && (
                    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                        {!filtered && (
                            <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                <Check className="size-6" aria-hidden />
                            </span>
                        )}
                        <p className="text-base font-semibold">{t(filtered ? 'empty.filtered' : 'empty.pane_done')}</p>
                    </div>
                )}
                {groups.map((group) => (
                    <Fragment key={group.key}>
                        <div className="flex min-h-8 items-center justify-between px-4.5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">
                            <span>{group.label}</span>
                            {selectMode && group.rows.some(selectable) ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const keys = group.rows.filter(selectable).map((item) => item.key);
                                        const all = keys.every((key) => checked.includes(key));
                                        onCheck(all ? checked.filter((key) => !keys.includes(key)) : [...new Set([...checked, ...keys])]);
                                    }}
                                    className="-my-2 h-10 cursor-pointer px-1 text-sm font-semibold text-blue-700 dark:text-blue-400"
                                >
                                    {group.rows.filter(selectable).every((item) => checked.includes(item.key))
                                        ? t('queue.select_none')
                                        : t('queue.select_all', { count: group.rows.filter(selectable).length })}
                                </button>
                            ) : (
                                <span className="tabular-nums">{group.rows.length}</span>
                            )}
                        </div>
                        <ul className="flex flex-col">
                            {group.rows.map((item) => {
                                const isChecked = checked.includes(item.key);
                                const inert = selectMode && !selectable(item);
                                return (
                                    <li key={item.key} className="group/row relative border-t border-muted" onMouseEnter={() => onHover?.(item.key)}>
                                        <button
                                            type="button"
                                            onClick={() => (selectMode ? selectable(item) && toggle(item.key, !isChecked) : onOpen(item))}
                                            onFocus={() => onHover?.(item.key)}
                                            aria-disabled={inert || undefined}
                                            aria-pressed={selectMode && selectable(item) ? isChecked : undefined}
                                            className={cn(
                                                'flex w-full cursor-pointer items-center gap-3 border-l-[3px] border-transparent py-2.5 pr-4 pl-[15px] text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring max-lg:min-h-16',
                                                selectMode && 'pr-14',
                                                inert && 'cursor-default opacity-50 hover:bg-transparent',
                                                isChecked &&
                                                    'border-blue-700 bg-blue-50 hover:bg-blue-50 dark:bg-blue-950/50 dark:hover:bg-blue-950/50',
                                            )}
                                        >
                                            <TypeTile type={item.type} />
                                            <span className="flex min-w-0 flex-1 flex-col gap-px">
                                                <span className="truncate text-[15px] font-medium">{item.street || t('no_address')}</span>
                                                <span className="truncate text-[13px] text-muted-foreground">
                                                    <span className="sr-only">{t(`types.${item.type}`)} · </span>
                                                    {[item.municipality, preview(item)].filter(Boolean).join(' · ')}
                                                </span>
                                            </span>
                                            <span
                                                className={cn(
                                                    'shrink-0 text-[13px] text-muted-foreground tabular-nums',
                                                    selectable(item) && (selecting ? 'invisible' : 'group-hover/row:invisible'),
                                                )}
                                            >
                                                {age(item.waiting_since)}
                                            </span>
                                        </button>
                                        {selectable(item) && (
                                            <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={(on) => toggle(item.key, !!on)}
                                                aria-label={t('select_item', { place: item.street ?? t('no_address') })}
                                                className={cn(
                                                    'absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer bg-background after:absolute after:-inset-3 pointer-coarse:size-6 pointer-coarse:rounded-md',
                                                    !selecting &&
                                                        'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden',
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
                    <div className="mt-2 flex items-center justify-between px-4.5 text-xs text-muted-foreground">
                        <span>{t('queue.page', { from: items.from, to: items.to, total: items.total })}</span>
                        <span className="flex gap-1">
                            <PageLink href={items.prev_page_url} label={t('queue.previous_page')} icon={ChevronLeft} />
                            <PageLink href={items.next_page_url} label={t('queue.next_page')} icon={ChevronRight} />
                        </span>
                    </div>
                )}
            </div>

            {footer || (
                <div className="flex h-10 shrink-0 items-center gap-3.5 overflow-hidden border-t px-4.5 text-xs whitespace-nowrap text-muted-foreground pointer-coarse:hidden">
                    <span className="flex items-center gap-1">
                        <Kbd>J</Kbd>
                        <Kbd>K</Kbd> {t('shortcuts.short.next')}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>↵</Kbd> {t('shortcuts.short.open')}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>X</Kbd> {t('shortcuts.short.select')}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>?</Kbd> {t('shortcuts.short.more')}
                    </span>
                </div>
            )}
        </>
    );
}

/**
 * The top of the queue panel: the status tabs, search and filters. Open items can be searched and filtered by
 * municipality; decided items only by type. Switching between open and decided keeps the page, so the map stays and
 * only its pins and the list change; every tab is prefetched.
 */
export function QueueHeader({
    status,
    total,
    decidedToday,
    filters,
    options,
    onFilter,
    selectMode,
    onSelectMode,
}: {
    status: 'open' | 'decided';
    total: number;
    decidedToday: number;
    filters: Filters;
    options: Options;
    onFilter: (next: Partial<Filters>) => void;
    /** Whether rows are being selected on a touch screen; left out when nothing in the list can be selected. */
    selectMode?: boolean;
    onSelectMode?: (on: boolean) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const open = status === 'open';
    const query = filterQuery(filters);
    const [searching, setSearching] = useState(Boolean(filters.search));
    const [search, setSearch] = useState(filters.search ?? '');
    const searchInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (search === (filters.search ?? '')) return;
        const timer = setTimeout(() => onFilter({ search: search || null }), 300);
        return () => clearTimeout(timer);
        // Only the typed search should trigger this debounce.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const filtered = Object.keys(query).length > 0;
    const types: HistoryType[] = open ? options.types : options.historyTypes;
    const tabQuery = {
        open: open ? query : filterQuery({ ...filters, types: filters.types.filter((type) => type !== 'proposal') }),
        decided: { ...(query.type ? { type: query.type } : {}), status: 'decided' },
    };

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
        <div className="flex shrink-0 flex-col gap-3 px-4.5 pt-4.5 pb-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-[-0.02em]">{t('queue.label')}</h2>
                <span className="text-[13px] text-muted-foreground">{t('queue.decided_today', { count: decidedToday })}</span>
            </div>
            <div className="flex gap-2">
                <nav aria-label={t('tabs.label')} className="flex flex-1 rounded-[10px] bg-muted p-1">
                    {(['open', 'decided'] as const).map((tab) => (
                        <Link
                            key={tab}
                            href={app.moderation.index({ query: tabQuery[tab] })}
                            preserveState
                            preserveScroll
                            prefetch
                            aria-current={status === tab ? 'page' : undefined}
                            className={cn(
                                'flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[7px] text-sm max-lg:h-10',
                                status === tab
                                    ? 'bg-background font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                                    : 'font-medium text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {t(`tabs.${tab}`)}
                            {tab === 'open' && open && <span className="font-medium text-muted-foreground tabular-nums">{total}</span>}
                        </Link>
                    ))}
                    {options.types.includes('submission') && options.can.submission && (
                        <Link
                            href={app.moderation.proposals.index()}
                            prefetch
                            className="flex h-[34px] flex-1 items-center justify-center rounded-[7px] px-1 text-sm font-medium text-muted-foreground hover:text-foreground max-lg:h-10"
                        >
                            {t('proposals.tab')}
                        </Link>
                    )}
                </nav>
                {open && (
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-[42px] cursor-pointer rounded-[10px] max-lg:size-12"
                        aria-label={t('search')}
                        aria-pressed={searching}
                        onClick={() => {
                            setSearching((value) => !value);
                            setTimeout(() => searchInput.current?.focus());
                        }}
                    >
                        <Search className="size-[18px]" />
                    </Button>
                )}
            </div>
            {open && selectMode !== undefined && (
                <Button
                    variant={selectMode ? 'default' : 'secondary'}
                    aria-pressed={selectMode}
                    onClick={() => onSelectMode?.(!selectMode)}
                    className="h-11 cursor-pointer self-start rounded-[10px] pointer-fine:hidden"
                >
                    {selectMode ? <Check aria-hidden /> : <ListChecks aria-hidden />}
                    {t(selectMode ? 'queue.select_done' : 'queue.select')}
                </Button>
            )}
            {open && searching && (
                <div className="relative">
                    <Input
                        ref={searchInput}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('search')}
                        aria-label={t('search')}
                        className="h-9 pr-8 text-sm"
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
            <div className="flex flex-wrap items-center gap-2">
                {types.length > 1 && (
                    <FilterMenu
                        label={typeLabel}
                        options={types.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                        selected={filters.types}
                        onChange={(next) => onFilter({ types: next as HistoryType[] })}
                    />
                )}
                {open && options.municipalities.length > 0 && (
                    <FilterMenu
                        label={municipalityLabel}
                        options={options.municipalities.map((municipality) => ({ value: String(municipality.id), label: municipality.name }))}
                        selected={filters.municipality_ids}
                        onChange={(municipality_ids) => onFilter({ municipality_ids })}
                    />
                )}
                {filtered && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearch('');
                            onFilter({ types: [], municipality_ids: [], search: null });
                        }}
                        className="ml-auto cursor-pointer text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                        {t('queue.clear_filters')}
                    </button>
                )}
            </div>
        </div>
    );
}

/** The kind of an item as a tinted tile, in the same colour as its pin on the map. */
export function TypeTile({ type }: { type: HistoryType }) {
    const color = type === 'proposal' ? SOURCE_COLOR : TYPE_COLORS[type];
    const Icon = TYPE_ICONS[type];

    return (
        <span
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
            aria-hidden
        >
            <Icon className="size-[18px]" />
        </span>
    );
}

export function PageLink({ href, label, icon: Icon }: { href: string | null; label: string; icon: typeof ChevronLeft }) {
    return href ? (
        <Link
            href={href}
            preserveScroll
            preserveState
            aria-label={label}
            className="flex size-7 items-center justify-center rounded-md border hover:bg-muted max-lg:size-10"
        >
            <Icon className="size-4" />
        </Link>
    ) : (
        <span aria-hidden className="flex size-7 items-center justify-center rounded-md border opacity-40 max-lg:size-10">
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
                    className="flex h-7 max-w-40 cursor-pointer items-center gap-1 rounded-[7px] border px-2.5 pr-2 text-[13px] font-medium whitespace-nowrap hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring max-lg:h-10 max-lg:max-w-48 max-lg:rounded-full max-lg:px-3.5 max-lg:text-sm"
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
