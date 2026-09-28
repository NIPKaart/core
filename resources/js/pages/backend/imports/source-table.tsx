import { index } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import MunicipalDateTime from '@/components/municipal-date-time';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import { Form, Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SourceSheet from './source-sheet';
import { SOURCE_STATUSES, SourceStatus, SourceType, type SourceRow, type SourceStatusKey } from './source-status';

export type SourceFilters = {
    search: string;
    status: 'all' | 'attention' | SourceStatusKey;
    type: 'all' | 'municipal' | 'offstreet';
    country: string | null;
};
export type SourceSummary = Record<SourceStatusKey, number> & { total: number; processing: boolean };

type Props = { sources: PaginatedResponse<SourceRow>; summary: SourceSummary; countries: string[]; filters: SourceFilters };

/** Summary chips that filter the table; approval counts include sources awaiting re-approval. */
const chips: { status: SourceFilters['status']; counts: SourceStatusKey[] }[] = [
    { status: 'awaiting_approval', counts: ['awaiting_approval', 'reapproval'] },
    { status: 'awaiting_review', counts: ['awaiting_review'] },
    { status: 'overdue', counts: ['overdue'] },
    { status: 'intake_problem', counts: ['intake_problem'] },
];

export default function SourceTable({ sources, summary, countries, filters }: Props) {
    const { t, i18n } = useTranslation('backend/imports');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = sources.data.find((source) => source.id === selectedId) ?? null;
    const filtered = filters.search !== '' || filters.status !== 'all' || filters.type !== 'all' || filters.country !== null;
    const visit = (changes: Partial<SourceFilters>) =>
        router.get(
            index.url(),
            Object.fromEntries(
                Object.entries({ ...filters, ...changes }).filter(
                    ([key, value]) => value !== null && value !== '' && !(key !== 'search' && value === 'all'),
                ),
            ),
            { preserveState: true, preserveScroll: true },
        );

    const columns: ColumnDef<SourceRow>[] = [
        {
            id: 'source',
            header: t('sources_table.source'),
            cell: ({ row: { original: source } }) => (
                <div className="max-w-md min-w-56 py-1 whitespace-normal">
                    <SourceType type={source.target_type} />
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(source.id);
                        }}
                        className="block text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                        {source.name}
                    </button>
                </div>
            ),
        },
        {
            id: 'area',
            header: t('sources_table.area'),
            cell: ({ row: { original: source } }) => (
                <div className="min-w-40 text-sm">
                    <span className="block">
                        {source.municipality_name}
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{source.municipality_code}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                        {source.subdivision_name ?? source.subdivision}, {source.country}
                    </span>
                </div>
            ),
        },
        {
            id: 'status',
            header: t('status'),
            cell: ({ row: { original: source } }) => <SourceStatus source={source} />,
        },
        {
            id: 'locations',
            header: () => <span className="block text-right">{t('sources_table.locations')}</span>,
            cell: ({ row: { original: source } }) =>
                source.last_published_retrieved_at ? (
                    <span className="block text-right tabular-nums">{source.visible_locations_count.toLocaleString(i18n.language)}</span>
                ) : (
                    <span className="flex justify-end">
                        <Badge variant="outline" className="font-normal whitespace-nowrap text-muted-foreground">
                            {t('sources_table.not_published')}
                        </Badge>
                    </span>
                ),
        },
        {
            id: 'delivery',
            header: t('sources_table.latest_delivery'),
            cell: ({ row: { original: source } }) => (
                <span className="text-sm text-muted-foreground">
                    {source.latest_delivery ? <MunicipalDateTime value={source.latest_delivery.created_at} /> : t('sources_table.none')}
                </span>
            ),
        },
        {
            id: 'licence',
            header: t('approval.fields.licence'),
            cell: ({ row: { original: source } }) => {
                const licence = (source.pending_description ?? source.description).licence;

                return <span className={cn('text-sm', !licence && 'text-destructive')}>{licence ?? t('approval.no_licence')}</span>;
            },
        },
        {
            id: 'open',
            header: () => <span className="sr-only">{t('sources_table.details')}</span>,
            cell: () => <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />,
        },
    ];

    return (
        <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t('sources_table.summary')}>
                {chips.map((chip) => {
                    const count = chip.counts.reduce((total, status) => total + summary[status], 0);
                    const active = filters.status === chip.status;

                    return (
                        <button
                            key={chip.status}
                            type="button"
                            aria-pressed={active}
                            onClick={() => visit({ status: active ? 'all' : chip.status })}
                            className={cn(
                                'flex min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring',
                                active && 'border-primary bg-muted/60',
                                count === 0 && !active && 'text-muted-foreground',
                            )}
                        >
                            <span className="text-xl font-semibold tabular-nums">{count}</span>
                            <span className="text-xs">{t(`sources_table.chips.${chip.status}`)}</span>
                        </button>
                    );
                })}
            </div>
            <DataTable
                columns={columns}
                data={sources.data}
                enableSorting={false}
                onRowClick={(source) => setSelectedId(source.id)}
                emptyState={
                    <div className="space-y-2 px-4 py-6">
                        <p className="font-medium">{t(filtered ? 'sources_table.no_matches' : 'sources_table.empty')}</p>
                        <p className="text-sm text-muted-foreground">{t(filtered ? 'sources_table.no_matches_hint' : 'no_datasets')}</p>
                        {filtered && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={index()}>{t('clear_filters')}</Link>
                            </Button>
                        )}
                    </div>
                }
                toolbar={
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <Form
                            action={index.url()}
                            method="get"
                            options={{ preserveState: true, preserveScroll: true }}
                            className="relative w-full lg:max-w-sm"
                        >
                            {filters.status !== 'all' && <input type="hidden" name="status" value={filters.status} />}
                            {filters.type !== 'all' && <input type="hidden" name="type" value={filters.type} />}
                            {filters.country && <input type="hidden" name="country" value={filters.country} />}
                            <Input
                                key={filters.search}
                                className="w-full pl-9"
                                name="search"
                                defaultValue={filters.search}
                                maxLength={200}
                                placeholder={t('sources_table.search')}
                                aria-label={t('sources_table.search')}
                            />
                            <button
                                type="submit"
                                className="absolute inset-y-0 left-0 flex w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                                aria-label={t('search')}
                            >
                                <Search className="size-4" aria-hidden="true" />
                            </button>
                        </Form>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <Select value={filters.type} onValueChange={(type) => visit({ type: type as SourceFilters['type'] })}>
                                <SelectTrigger aria-label={t('sources_table.type')} className="w-full sm:w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('sources_table.all_types')}</SelectItem>
                                    <SelectItem value="municipal">{t('sources_table.types.municipal')}</SelectItem>
                                    <SelectItem value="offstreet">{t('sources_table.types.offstreet')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {countries.length > 1 && (
                                <Select
                                    value={filters.country ?? 'all'}
                                    onValueChange={(country) => visit({ country: country === 'all' ? null : country })}
                                >
                                    <SelectTrigger aria-label={t('sources_table.country')} className="w-full sm:w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('sources_table.all_countries')}</SelectItem>
                                        {countries.map((country) => (
                                            <SelectItem key={country} value={country}>
                                                {country}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={filters.status} onValueChange={(status) => visit({ status: status as SourceFilters['status'] })}>
                                <SelectTrigger aria-label={t('status')} className="w-full sm:w-52">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('sources_table.all_statuses')}</SelectItem>
                                    <SelectItem value="attention">{t('sources_table.attention')}</SelectItem>
                                    {SOURCE_STATUSES.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {t(`sources_table.statuses.${status}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                }
            />
            {sources.total > 0 && <DataTablePagination pagination={sources} preserveScroll />}
            <SourceSheet source={selected} onClose={() => setSelectedId(null)} />
        </div>
    );
}
