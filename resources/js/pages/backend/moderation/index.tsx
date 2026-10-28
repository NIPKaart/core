import Heading from '@/components/heading';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import type { DataTableFeatures } from '@/components/tables/features';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectionBar, SelectionHeader } from './bulk-pane';
import { panelMode } from './geo';
import { useAgo } from './parts';
import { QueueList, TYPE_COLORS } from './queue-list';
import { ReviewPane } from './review-pane';
import { ShortcutsDialog, useShortcuts } from './shortcuts';
import { TypeBadge } from './type-badge';
import {
    filterQuery,
    itemUrl,
    type Filters,
    type HistoryRow,
    type ItemLink,
    type ItemType,
    type Options,
    type Position,
    type QueueItem,
    type SelectedItem,
} from './types';
import { useValueFormatter } from './values';
import { Workspace } from './workspace';

/** Where the overview starts when the queue is empty. */
const NETHERLANDS = { latitude: 52.2, longitude: 5.3 };
const COUNTRY_ZOOM = 7;

type PageProps = {
    status: 'open' | 'decided';
    filters: Filters;
    items: PaginatedResponse<QueueItem> | null;
    history: PaginatedResponse<HistoryRow> | null;
    selected: SelectedItem | null;
    position: Position | null;
    decidedToday: number;
    options: Options;
};

/**
 * The community moderation inbox. The map fills the screen and one panel beside it switches between the queue, the
 * item under review and a selection, as on the public map. After a decision the inbox continues with the next item.
 * Selected items are rejected together; approving always happens one item at a time.
 */
export default function Index({ status, filters, items, history, selected, position, decidedToday, options }: PageProps) {
    const { t } = useTranslation('backend/moderation');
    const open = status === 'open';
    const query = filterQuery(filters);
    const [viewing, setViewing] = useState<HistoryRow | null>(null);
    const [checked, setChecked] = useState<string[]>([]);
    const [helping, setHelping] = useState(false);
    useEffect(() => setChecked((keys) => keys.filter((key) => items?.data.some((item) => item.key === key))), [items?.data]);

    const visit = (next: Partial<Filters & { status: string }>) => {
        const merged = { ...filters, ...next };
        router.get(
            app.moderation.index(),
            { ...filterQuery(merged), ...((next.status ?? status) === 'decided' ? { status: 'decided' } : {}) },
            { preserveScroll: true, preserveState: true },
        );
    };

    /** The pane opens at once with what the queue row already shows; the item's details follow. */
    const [loading, setLoading] = useState<{ preview: QueueItem | null } | null>(null);
    const openItem = (link: ItemLink) => {
        setChecked([]);
        setLoading({ preview: items?.data.find((item) => item.key === link.key) ?? null });
        router.visit(itemUrl(link, query), {
            preserveState: true,
            preserveScroll: true,
            only: ['selected', 'position'],
            onFinish: () => setLoading(null),
        });
    };
    const closeReview = () => {
        setLoading(null);
        router.visit(app.moderation.index({ query }), { preserveState: true, preserveScroll: true, only: ['selected', 'position'] });
    };

    const current = loading?.preview ?? selected;
    const checkedItems = (items?.data ?? []).filter((item) => checked.includes(item.key));
    const first = items?.data[0];
    const mode = panelMode(current !== null, checkedItems.length);
    const [hovered, setHovered] = useState<string | null>(null);
    const overviewCenter = first ? { latitude: first.latitude, longitude: first.longitude } : NETHERLANDS;
    useShortcuts({
        j: !current && !checkedItems.length && first && (() => openItem(first)),
        Enter: !current && !checkedItems.length && first && (() => openItem(first)),
        x:
            current &&
            current.type !== 'report' &&
            options.can[current.type] &&
            (() => setChecked((keys) => (keys.includes(current.key) ? keys.filter((key) => key !== current.key) : [...keys, current.key]))),
        '?': () => setHelping(true),
    });

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('title'), href: app.moderation.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={current?.street ? `${current.street} · ${t('title')}` : t('title')} />
            {open ? (
                <div className="flex h-[calc(100svh-4rem)] min-h-0 md:h-[calc(100svh-5rem)] md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(100svh-4rem)]">
                    {mode === 'item' ? (
                        <ReviewPane
                            selected={selected}
                            position={position}
                            loading={loading}
                            options={options}
                            query={query}
                            onNavigate={openItem}
                            onBack={closeReview}
                        />
                    ) : (
                        <Workspace
                            scope="overview"
                            label={mode === 'selection' ? t('bulk.label') : t('queue.label')}
                            map={
                                mode === 'selection'
                                    ? {
                                          center: { latitude: checkedItems[0].latitude, longitude: checkedItems[0].longitude },
                                          numbered: checkedItems.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
                                      }
                                    : {
                                          center: overviewCenter,
                                          zoom: first ? undefined : COUNTRY_ZOOM,
                                          queue: (items?.data ?? []).map((item) => ({
                                              key: item.key,
                                              point: { latitude: item.latitude, longitude: item.longitude },
                                              color: TYPE_COLORS[item.type],
                                              label: item.street ?? t('no_address'),
                                          })),
                                          highlighted: hovered,
                                          onPick: (key) => {
                                              const item = items?.data.find((candidate) => candidate.key === key);
                                              if (item) openItem(item);
                                          },
                                      }
                            }
                        >
                            <QueueList
                                status={status}
                                items={items}
                                filters={filters}
                                options={options}
                                checked={checked}
                                onCheck={setChecked}
                                decidedToday={decidedToday}
                                onOpen={openItem}
                                onFilter={visit}
                                onHover={setHovered}
                                selection={mode === 'selection' ? <SelectionHeader items={checkedItems} onClear={() => setChecked([])} /> : undefined}
                                footer={
                                    mode === 'selection' ? (
                                        <SelectionBar items={checkedItems} options={options} onClear={() => setChecked([])} />
                                    ) : undefined
                                }
                            />
                        </Workspace>
                    )}
                </div>
            ) : (
                <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
                    <Heading level={1} title={t('title')} />
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
                                </Link>
                            ))}
                        </nav>
                        {options.types.length > 1 && (
                            <DataTableFacetFilter
                                title={t('filters.type')}
                                selected={filters.types}
                                options={options.types.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                                onChange={(next) => visit({ types: next as ItemType[] })}
                                onClear={() => visit({ types: [] })}
                            />
                        )}
                    </div>
                    {history && <History history={history} onView={setViewing} />}
                </div>
            )}
            <DecisionSheet row={viewing} options={options} onClose={() => setViewing(null)} />
            <ShortcutsDialog open={helping} onOpenChange={setHelping} />
        </AppLayout>
    );
}

function History({ history, onView }: { history: PaginatedResponse<HistoryRow>; onView: (row: HistoryRow) => void }) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();

    const columns: ColumnDef<DataTableFeatures, HistoryRow>[] = [
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
