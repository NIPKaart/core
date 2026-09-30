import Heading from '@/components/heading';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, type Proposer, ProposerName, useAgo } from './parts';
import { type ChangeGroup, type EnumOption, type ImprovementValues, useChangeSummary, useValueFormatter } from './values';

type OpenRow = {
    id: number;
    space: { id: string; street: string | null; municipality: string | null };
    changes: ChangeGroup[];
    distance_metres: number | null;
    flags: { other_municipality: string | true | null; competing: boolean; reported: boolean };
    proposer: Proposer;
    submitted_at: string;
};

type DecidedRow = {
    id: number;
    space: { id: string; street: string | null; municipality: string | null };
    changes: ChangeGroup[];
    status: 'approved' | 'rejected';
    corrected: boolean;
    reason: string | null;
    note: string | null;
    proposer: string | null;
    submitted_at: string;
    reviewer: string | null;
    reviewed_at: string;
    previous: Partial<ImprovementValues>;
    submitted: Partial<ImprovementValues>;
    applied: Partial<ImprovementValues>;
};

type Filters = { search: string | null; municipality_ids: string[]; changes: string[]; decisions: string[] };

type PageProps = {
    status: 'open' | 'decided';
    improvements: PaginatedResponse<OpenRow | DecidedRow>;
    filters: Filters;
    pendingCount: number;
    options: {
        orientations: EnumOption[];
        changes: ChangeGroup[];
        municipalities: { id: number; name: string }[];
        rejectionReasons: EnumOption[];
    };
};

export default function Index({ status, improvements, filters, pendingCount, options }: PageProps) {
    const { t } = useResourceTranslation('backend/improvements');
    const { can } = useAuthorization();
    const open = status === 'open';
    const [search, setSearch] = useState(filters.search ?? '');
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [viewing, setViewing] = useState<DecidedRow | null>(null);

    useEffect(() => setRowSelection({}), [improvements.data]);

    const visit = (next: Partial<Filters & { status: string }>) => {
        const merged = { status, ...filters, search, ...next };
        const query: Record<string, string> = {};
        if (merged.status === 'decided') query.status = 'decided';
        if (merged.search) query.search = merged.search;
        if (merged.municipality_ids?.length) query.municipality_id = merged.municipality_ids.join(',');
        if (merged.changes?.length) query.changes = merged.changes.join(',');
        if (merged.status === 'decided' && merged.decisions?.length) query.decision = merged.decisions.join(',');
        router.get(app.improvements.index(), query, { preserveScroll: true, preserveState: true });
    };

    useEffect(() => {
        if (search === (filters.search ?? '')) return;
        const timer = setTimeout(() => visit({ search }), 300);
        return () => clearTimeout(timer);
        // Only the typed search should trigger this debounce.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns = useColumns(open);
    const selectedIds = improvements.data.filter((_, index) => rowSelection[index]).map((row) => row.id);
    const breadcrumbs: BreadcrumbItem[] = [{ title: t('title'), href: app.improvements.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('title')} />
            <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Heading level={1} title={t('title')} description={t('description')} />
                    {can('parking-space-improvement.review') && pendingCount > 0 && (
                        <Button asChild>
                            <Link href={app.improvements.start()}>
                                {t('actions.start')}
                                <span className="rounded-full bg-primary-foreground/20 px-2 text-xs">{pendingCount}</span>
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <nav aria-label={t('tabs.label')} className="inline-flex rounded-lg bg-muted p-[3px]">
                        {(['open', 'decided'] as const).map((tab) => (
                            <Link
                                key={tab}
                                href={app.improvements.index({ query: tab === 'decided' ? { status: 'decided' } : {} })}
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
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('search')}
                        aria-label={t('search')}
                        className="w-full sm:ml-2 sm:w-72"
                    />
                    <DataTableFacetFilter
                        title={t('filters.municipality')}
                        selected={filters.municipality_ids}
                        options={options.municipalities.map((municipality) => ({ value: String(municipality.id), label: municipality.name }))}
                        onChange={(next) => visit({ municipality_ids: next })}
                        onClear={() => visit({ municipality_ids: [] })}
                    />
                    {open ? (
                        <DataTableFacetFilter
                            title={t('filters.change')}
                            selected={filters.changes}
                            options={options.changes.map((group) => ({ value: group, label: t(`groups.${group}`) }))}
                            onChange={(next) => visit({ changes: next })}
                            onClear={() => visit({ changes: [] })}
                        />
                    ) : (
                        <DataTableFacetFilter
                            title={t('filters.decision')}
                            selected={filters.decisions}
                            options={(['approved', 'rejected'] as const).map((decision) => ({ value: decision, label: t(`decisions.${decision}`) }))}
                            onChange={(next) => visit({ decisions: next })}
                            onClear={() => visit({ decisions: [] })}
                        />
                    )}
                </div>

                {open && selectedIds.length > 0 && can('parking-space-improvement.review') && (
                    <BulkReject ids={selectedIds} reasons={options.rejectionReasons} onClear={() => setRowSelection({})} />
                )}

                <DataTable
                    toolbar={null}
                    columns={columns as ColumnDef<OpenRow | DecidedRow>[]}
                    data={improvements.data}
                    enableSorting={false}
                    rowSelection={open ? rowSelection : undefined}
                    onRowSelectionChange={open ? setRowSelection : undefined}
                    onRowClick={(row) => (open ? router.visit(app.improvements.show({ improvement: row.id })) : setViewing(row as DecidedRow))}
                    emptyState={<p className="py-6 text-center text-muted-foreground">{t(open ? 'empty.open' : 'empty.decided')}</p>}
                />

                <DataTablePagination pagination={improvements} />
            </div>

            <DecisionSheet row={viewing} options={options} onClose={() => setViewing(null)} />
        </AppLayout>
    );
}

function useColumns(open: boolean): ColumnDef<OpenRow>[] | ColumnDef<DecidedRow>[] {
    const { t } = useTranslation('backend/improvements');
    const summary = useChangeSummary();
    const ago = useAgo();

    const place: ColumnDef<OpenRow | DecidedRow> = {
        id: 'place',
        header: t('columns.place'),
        cell: ({ row }) => (
            <span>
                <span className="font-medium">{row.original.space.street || t('no_address')}</span>
                {row.original.space.municipality && <span className="text-muted-foreground"> · {row.original.space.municipality}</span>}
            </span>
        ),
    };

    if (!open) {
        return [
            place,
            { id: 'change', header: t('columns.change'), cell: ({ row }) => summary(row.original.changes) },
            {
                id: 'decision',
                header: t('columns.decision'),
                cell: ({ row }) => {
                    const decided = row.original as DecidedRow;
                    return (
                        <span className="inline-flex items-center gap-2">
                            <span className={cn('size-2 rounded-full', decided.status === 'approved' ? 'bg-green-600' : 'bg-red-600')} aria-hidden />
                            {decided.status === 'approved'
                                ? t(decided.corrected ? 'decisions.approved_corrected' : 'decisions.approved')
                                : `${t('decisions.rejected')} · ${decided.reason}`}
                        </span>
                    );
                },
            },
            {
                id: 'reviewer',
                header: t('columns.reviewer'),
                meta: { align: 'right' },
                cell: ({ row }) => {
                    const decided = row.original as DecidedRow;
                    return (
                        <span className="text-muted-foreground">
                            {decided.reviewer ?? t('unknown_user')} · {ago(decided.reviewed_at)}
                        </span>
                    );
                },
            },
        ] as ColumnDef<DecidedRow>[];
    }

    return [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('select_all')}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('select')}
                />
            ),
        },
        {
            ...place,
            cell: ({ row }) => (
                <Link href={app.improvements.show({ improvement: row.original.id })} onClick={(event) => event.stopPropagation()}>
                    <span className="font-medium">{row.original.space.street || t('no_address')}</span>
                    {row.original.space.municipality && <span className="text-muted-foreground"> · {row.original.space.municipality}</span>}
                </Link>
            ),
        },
        {
            id: 'change',
            header: t('columns.change'),
            cell: ({ row }) => {
                const { changes, distance_metres, flags } = row.original as OpenRow;
                const flag =
                    flags.other_municipality !== null
                        ? t('flags.other_municipality')
                        : flags.competing
                          ? t('flags.competing')
                          : flags.reported
                            ? t('flags.reported')
                            : null;
                return (
                    <span className="inline-flex flex-wrap items-center gap-2">
                        {summary(changes, distance_metres)}
                        {flag && <Flag>{flag}</Flag>}
                    </span>
                );
            },
        },
        {
            id: 'proposer',
            header: t('columns.proposer'),
            cell: ({ row }) => <ProposerName proposer={(row.original as OpenRow).proposer} />,
        },
        {
            id: 'submitted',
            header: t('columns.submitted'),
            meta: { align: 'right' },
            cell: ({ row }) => <span className="text-muted-foreground">{ago(row.original.submitted_at)}</span>,
        },
    ] as ColumnDef<OpenRow>[];
}

function BulkReject({ ids, reasons, onClear }: { ids: number[]; reasons: EnumOption[]; onClear: () => void }) {
    const { t } = useTranslation('backend/improvements');
    const [reason, setReason] = useState('spam');
    const [processing, setProcessing] = useState(false);

    const reject = () =>
        router.post(
            app.improvements.bulk.reject(),
            { ids, reason },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: onClear },
        );

    return (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{ids.length}</span> {t('bulk.selected')} ·{' '}
                <button type="button" onClick={onClear} className="cursor-pointer underline underline-offset-2 hover:text-foreground">
                    {t('bulk.clear')}
                </button>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="w-full sm:w-60" aria-label={t('reject.reason')}>
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
                <Button variant="destructive" className="cursor-pointer" disabled={processing} onClick={reject}>
                    {t('bulk.reject', { count: ids.length })}
                </Button>
            </div>
        </div>
    );
}

/** A decided proposal: what each field was, what was submitted and what was applied. */
function DecisionSheet({ row, options, onClose }: { row: DecidedRow | null; options: PageProps['options']; onClose: () => void }) {
    const { t } = useTranslation('backend/improvements');
    const format = useValueFormatter(options);
    const summary = useChangeSummary();
    const ago = useAgo();

    return (
        <Sheet open={row !== null} onOpenChange={(value) => !value && onClose()}>
            <SheetContent className="w-full gap-0 sm:max-w-md">
                {row && (
                    <>
                        <SheetHeader>
                            <SheetTitle>{[row.space.street, row.space.municipality].filter(Boolean).join(', ') || t('no_address')}</SheetTitle>
                            <SheetDescription>{summary(row.changes)}</SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6 text-sm">
                            <p className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full', row.status === 'approved' ? 'bg-green-600' : 'bg-red-600')} aria-hidden />
                                {row.status === 'approved'
                                    ? t(row.corrected ? 'decisions.approved_corrected' : 'decisions.approved')
                                    : `${t('decisions.rejected')} · ${row.reason}`}
                            </p>
                            {row.note && <p className="rounded-md bg-muted px-3 py-2">“{row.note}”</p>}
                            <dl className="flex flex-col gap-4">
                                {row.changes.map((group) => {
                                    const applied = row.status === 'approved' ? format(group, { ...row.previous, ...row.applied }) : null;
                                    const submitted = format(group, { ...row.previous, ...row.submitted });
                                    return (
                                        <div key={group} className="flex flex-col gap-1">
                                            <dt className="text-xs text-muted-foreground">{t(`groups.${group}`)}</dt>
                                            {row.status === 'approved' && (
                                                <dd className="text-muted-foreground line-through decoration-muted-foreground/40">
                                                    {format(group, row.previous)}
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
                            <p className="text-xs text-muted-foreground">
                                {t('history.by', {
                                    proposer: row.proposer ?? t('unknown_user'),
                                    submitted: ago(row.submitted_at),
                                    reviewer: row.reviewer ?? t('unknown_user'),
                                    reviewed: ago(row.reviewed_at),
                                })}
                            </p>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
