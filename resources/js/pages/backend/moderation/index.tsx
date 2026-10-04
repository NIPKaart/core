import Heading from '@/components/heading';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Flag as FlagIcon } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContributorName, Flag, useAgo } from './parts';
import { ReviewSheet } from './review-sheet';
import { TypeBadge } from './type-badge';
import {
    filterQuery,
    itemUrl,
    type Filters,
    type HistoryRow,
    type ItemType,
    type Options,
    type Position,
    type QueueItem,
    type SelectedItem,
} from './types';
import { useValueFormatter } from './values';

type PageProps = {
    status: 'open' | 'decided';
    filters: Filters;
    items: PaginatedResponse<QueueItem> | null;
    history: PaginatedResponse<HistoryRow> | null;
    selected: SelectedItem | null;
    position: Position | null;
    options: Options;
};

/**
 * The community moderation inbox. The queue stays in view; the item under review opens in a sheet beside it and,
 * after a decision, the sheet continues with the next item.
 */
export default function Index({ status, filters, items, history, selected, position, options }: PageProps) {
    const { t } = useTranslation('backend/moderation');
    const open = status === 'open';
    const query = filterQuery(filters);
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewing, setViewing] = useState<HistoryRow | null>(null);

    const visit = (next: Partial<Filters & { status: string }>) => {
        const merged = { ...filters, search, ...next };
        router.get(
            app.moderation.index(),
            { ...filterQuery(merged), ...((next.status ?? status) === 'decided' ? { status: 'decided' } : {}) },
            { preserveScroll: true, preserveState: true },
        );
    };

    useEffect(() => {
        if (search === (filters.search ?? '')) return;
        const timer = setTimeout(() => visit({ search }), 300);
        return () => clearTimeout(timer);
        // Only the typed search should trigger this debounce.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const review = (item: QueueItem) =>
        router.visit(itemUrl(item, query), { preserveState: true, preserveScroll: true, only: ['selected', 'position'] });
    const closeReview = () =>
        router.visit(app.moderation.index({ query }), { preserveState: true, preserveScroll: true, only: ['selected', 'position'] });
    const breadcrumbs: BreadcrumbItem[] = [{ title: t('title'), href: app.moderation.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('title')} />
            <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
                <Heading level={1} title={t('title')} description={t('description')} />

                <div className="flex flex-wrap items-center gap-2">
                    <nav aria-label={t('tabs.label')} className="inline-flex rounded-lg bg-muted p-[3px]">
                        {(['open', 'decided'] as const).map((tab) => (
                            <Link
                                key={tab}
                                href={app.moderation.index({
                                    query: tab === 'decided' ? { ...(query.type ? { type: query.type } : {}), status: 'decided' } : query,
                                })}
                                aria-current={status === tab ? 'page' : undefined}
                                className={cn(
                                    'rounded-md px-3 py-1 text-sm font-medium',
                                    status === tab ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {t(`tabs.${tab}`)}
                                {tab === 'open' && items && <span className="ml-1.5 text-muted-foreground tabular-nums">{items.total}</span>}
                            </Link>
                        ))}
                    </nav>
                    {open && (
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('search')}
                            aria-label={t('search')}
                            className="w-full sm:ml-2 sm:w-72"
                        />
                    )}
                    {options.types.length > 1 && (
                        <DataTableFacetFilter
                            title={t('filters.type')}
                            selected={filters.types}
                            options={options.types.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                            onChange={(next) => visit({ types: next as ItemType[] })}
                            onClear={() => visit({ types: [] })}
                        />
                    )}
                    {open && options.municipalities.length > 0 && (
                        <DataTableFacetFilter
                            title={t('filters.municipality')}
                            selected={filters.municipality_ids}
                            options={options.municipalities.map((municipality) => ({ value: String(municipality.id), label: municipality.name }))}
                            onChange={(next) => visit({ municipality_ids: next })}
                            onClear={() => visit({ municipality_ids: [] })}
                        />
                    )}
                </div>

                {open && items && (
                    <OpenQueue
                        items={items}
                        selectedKey={selected?.key ?? null}
                        options={options}
                        filtered={Object.keys(query).length > 0}
                        onReview={review}
                    />
                )}
                {!open && history && <History history={history} onView={setViewing} />}
            </div>

            <ReviewSheet selected={selected} position={position} options={options} query={query} onClose={closeReview} />
            <DecisionSheet row={viewing} options={options} onClose={() => setViewing(null)} />
        </AppLayout>
    );
}

/**
 * The open queue in one list, grouped by priority with the oldest item first. Wide screens get a table; narrow
 * screens get stacked rows. Only submissions and improvements can be rejected in bulk.
 */
function OpenQueue({
    items,
    selectedKey,
    options,
    filtered,
    onReview,
}: {
    items: PaginatedResponse<QueueItem>;
    selectedKey: string | null;
    options: Options;
    filtered: boolean;
    onReview: (item: QueueItem) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const [checked, setChecked] = useState<string[]>([]);
    useEffect(() => setChecked([]), [items.data]);

    const groups = (['high', 'normal'] as const)
        .map((priority) => ({ priority, rows: items.data.filter((item) => item.priority === priority) }))
        .filter((group) => group.rows.length > 0);
    const selectable = (item: QueueItem) => item.type !== 'report' && options.can[item.type];
    const selectableKeys = items.data.filter(selectable).map((item) => item.key);
    const allChecked = selectableKeys.length > 0 && selectableKeys.every((key) => checked.includes(key));
    const toggle = (key: string, on: boolean) => setChecked((current) => (on ? [...current, key] : current.filter((item) => item !== key)));
    const openOnKey = (item: QueueItem) => (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onReview(item);
        }
    };

    if (items.data.length === 0) {
        return (
            <p className="rounded-lg border border-dashed px-6 py-12 text-center text-muted-foreground">
                {t(filtered ? 'empty.filtered' : 'empty.open')}
            </p>
        );
    }

    const checkbox = (item: QueueItem) =>
        selectable(item) && (
            <Checkbox
                checked={checked.includes(item.key)}
                onCheckedChange={(on) => toggle(item.key, !!on)}
                onClick={(event) => event.stopPropagation()}
                aria-label={t('select')}
            />
        );
    const contributor = (item: QueueItem) =>
        item.contributor ? (
            <ContributorName contributor={item.contributor} />
        ) : (
            <span className="text-muted-foreground">{t('contributor.reporters', { count: item.flags.reports ?? 0 })}</span>
        );
    const groupLabel = (priority: 'high' | 'normal', count: number) => (
        <span className="inline-flex items-center gap-1.5">
            {priority === 'high' && <FlagIcon className="size-3.5 text-orange-500" aria-hidden />}
            {t(`priority.${priority}`)} <span className="tabular-nums">· {count}</span>
        </span>
    );

    return (
        <div className="space-y-4">
            {checked.length > 0 && <BulkReject keys={checked} reasons={options.bulkReasons} onClear={() => setChecked([])} />}

            <div className="hidden overflow-hidden rounded-md border md:block">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">
                                {selectableKeys.length > 0 && (
                                    <Checkbox
                                        checked={allChecked}
                                        onCheckedChange={(on) => setChecked(on ? selectableKeys : [])}
                                        aria-label={t('select_all')}
                                    />
                                )}
                            </TableHead>
                            <TableHead>{t('columns.type')}</TableHead>
                            <TableHead>{t('columns.place')}</TableHead>
                            <TableHead>{t('columns.contributor')}</TableHead>
                            <TableHead className="text-right">{t('columns.submitted')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.map((group) => (
                            <Fragment key={group.priority}>
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={5} className="bg-muted/30 py-1.5 text-xs font-medium text-muted-foreground">
                                        {groupLabel(group.priority, group.rows.length)}
                                    </TableCell>
                                </TableRow>
                                {group.rows.map((item) => (
                                    <TableRow
                                        key={item.key}
                                        tabIndex={0}
                                        data-state={item.key === selectedKey || checked.includes(item.key) ? 'selected' : undefined}
                                        className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                        onClick={() => onReview(item)}
                                        onKeyDown={openOnKey(item)}
                                    >
                                        <TableCell>{checkbox(item)}</TableCell>
                                        <TableCell>
                                            <TypeBadge type={item.type} />
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            <span className="inline-flex flex-wrap items-center gap-2">
                                                <span>
                                                    <span className="font-medium">{item.street || t('no_address')}</span>
                                                    {item.municipality && <span className="text-muted-foreground"> · {item.municipality}</span>}
                                                </span>
                                                <ItemFlags item={item} />
                                            </span>
                                        </TableCell>
                                        <TableCell>{contributor(item)}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{ago(item.waiting_since)}</TableCell>
                                    </TableRow>
                                ))}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className="overflow-hidden rounded-md border md:hidden">
                {groups.map((group) => (
                    <Fragment key={group.priority}>
                        <li className="border-b bg-muted/30 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            {groupLabel(group.priority, group.rows.length)}
                        </li>
                        {group.rows.map((item) => (
                            <li
                                key={item.key}
                                data-state={item.key === selectedKey || checked.includes(item.key) ? 'selected' : undefined}
                                className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border-b px-4 py-3 last:border-b-0 data-[state=selected]:bg-muted"
                            >
                                <span className="pt-0.5">{checkbox(item)}</span>
                                <button
                                    type="button"
                                    onClick={() => onReview(item)}
                                    className="flex min-w-0 cursor-pointer flex-col gap-1.5 text-left"
                                >
                                    <span className="flex w-full items-baseline gap-3">
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.street || t('no_address')}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{ago(item.waiting_since)}</span>
                                    </span>
                                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                        <TypeBadge type={item.type} />
                                        {item.municipality}
                                        <ItemFlags item={item} />
                                    </span>
                                </button>
                            </li>
                        ))}
                    </Fragment>
                ))}
            </ul>

            <DataTablePagination pagination={items} />
        </div>
    );
}

/** The one or two signals a moderator should notice before opening an item. */
function ItemFlags({ item }: { item: QueueItem }) {
    const { t } = useTranslation('backend/moderation');
    const { flags } = item;
    const flag =
        flags.nearby_municipal_metres != null
            ? t('flags.nearby_municipal', { distance: flags.nearby_municipal_metres })
            : flags.other_municipality != null
              ? t('flags.other_municipality')
              : flags.competing
                ? t('flags.competing')
                : flags.reported
                  ? t('flags.reported')
                  : (flags.reports ?? 0) > 1
                    ? t('flags.reports', { count: flags.reports })
                    : null;

    return flag && <Flag>{flag}</Flag>;
}

function BulkReject({ keys, reasons, onClear }: { keys: string[]; reasons: Options['bulkReasons']; onClear: () => void }) {
    const { t } = useTranslation('backend/moderation');
    const [reason, setReason] = useState(reasons.find((option) => option.value === 'spam')?.value ?? reasons[0]?.value ?? '');
    const [processing, setProcessing] = useState(false);

    const reject = () =>
        router.post(
            app.moderation.bulk.reject(),
            { items: keys, reason },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: onClear },
        );

    return (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{keys.length}</span> {t('bulk.selected')} ·{' '}
                <button type="button" onClick={onClear} className="cursor-pointer underline underline-offset-2 hover:text-foreground">
                    {t('bulk.clear')}
                </button>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="w-full sm:w-60" aria-label={t('bulk.reason')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {reasons.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="destructive" className="cursor-pointer" disabled={processing || !reason} onClick={reject}>
                    {t('bulk.reject', { count: keys.length })}
                </Button>
            </div>
        </div>
    );
}

function History({ history, onView }: { history: PaginatedResponse<HistoryRow>; onView: (row: HistoryRow) => void }) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();

    const columns: ColumnDef<HistoryRow>[] = [
        { id: 'type', header: t('columns.type'), cell: ({ row }) => <TypeBadge type={row.original.type} /> },
        {
            id: 'place',
            header: t('columns.place'),
            cell: ({ row }) => (
                <span>
                    <span className="font-medium">{row.original.street || t('no_address')}</span>
                    {row.original.municipality && <span className="text-muted-foreground"> · {row.original.municipality}</span>}
                </span>
            ),
        },
        { id: 'decision', header: t('columns.decision'), cell: ({ row }) => <DecisionLabel row={row.original} /> },
        {
            id: 'reviewer',
            header: t('columns.reviewer'),
            meta: { align: 'right' },
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.reviewer ?? t('unknown_user')} · {ago(row.original.decided_at)}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <DataTable
                toolbar={null}
                columns={columns}
                data={history.data}
                enableSorting={false}
                onRowClick={onView}
                emptyState={<p className="py-6 text-center text-muted-foreground">{t('empty.decided')}</p>}
            />
            <DataTablePagination pagination={history} />
        </div>
    );
}

function DecisionLabel({ row }: { row: HistoryRow }) {
    const { t } = useTranslation('backend/moderation');
    const positive = row.decision === 'approved' || row.decision === 'kept';
    const label = row.decision === 'approved' && row.corrected ? t('decisions.approved_corrected') : t(`decisions.${row.decision}`);

    return (
        <span className="inline-flex items-center gap-2">
            <span className={cn('size-2 rounded-full', positive ? 'bg-green-600' : 'bg-red-600')} aria-hidden />
            {row.reason ? `${label} · ${row.reason}` : label}
        </span>
    );
}

/** A decided item: the decision, its reason and note, and for an improvement what was submitted and applied. */
function DecisionSheet({ row, options, onClose }: { row: HistoryRow | null; options: Options; onClose: () => void }) {
    const { t } = useTranslation('backend/moderation');
    const format = useValueFormatter(options);
    const ago = useAgo();

    return (
        <Sheet open={row !== null} onOpenChange={(value) => !value && onClose()}>
            <SheetContent className="w-full gap-0 sm:max-w-md">
                {row && (
                    <>
                        <SheetHeader>
                            <div>
                                <TypeBadge type={row.type} />
                            </div>
                            <SheetTitle>{[row.street, row.municipality].filter(Boolean).join(', ') || t('no_address')}</SheetTitle>
                            <SheetDescription>
                                {row.contributor ?? (row.reports ? t('history.reports', { count: row.reports }) : null)}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6 text-sm">
                            <DecisionLabel row={row} />
                            {row.note && <p className="rounded-md bg-muted px-3 py-2">“{row.note}”</p>}
                            {row.type === 'improvement' && row.changes && (
                                <dl className="flex flex-col gap-4">
                                    {row.changes.map((group) => {
                                        const submitted = format(group, { ...row.previous, ...row.submitted });
                                        const applied = row.decision === 'approved' ? format(group, { ...row.previous, ...row.applied }) : null;
                                        return (
                                            <div key={group} className="flex flex-col gap-1">
                                                <dt className="text-xs text-muted-foreground">{t(`groups.${group}`)}</dt>
                                                {row.decision === 'approved' && (
                                                    <dd className="text-muted-foreground line-through decoration-muted-foreground/40">
                                                        {format(group, row.previous ?? {})}
                                                    </dd>
                                                )}
                                                <dd className="font-medium">{applied ?? submitted}</dd>
                                                {applied !== null && applied !== submitted && (
                                                    <dd className="text-xs text-orange-700 dark:text-orange-400">
                                                        {t('history.submitted_was', { value: submitted })}
                                                    </dd>
                                                )}
                                            </div>
                                        );
                                    })}
                                </dl>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {t('history.decided', { reviewer: row.reviewer ?? t('unknown_user'), ago: ago(row.decided_at) })}
                            </p>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
