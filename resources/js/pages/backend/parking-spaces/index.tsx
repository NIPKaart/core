import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, ParkingSpace } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Head, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getParkingSpaceColumns } from './columns';
import Heading from '@/components/heading';

type Option = { id: number; name: string };
type PageProps = {
    spaces: PaginatedResponse<ParkingSpace>;
    filters: { status: string | null; municipality_id: string | null; deletion_requested: boolean };
    options: { statuses: Record<ParkingStatus, string>; municipalities: Option[] };
};

export default function Index({ spaces, filters, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/main');
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpaceActionDialog();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [selectedStatus, setSelectedStatus] = useState<ParkingStatus | ''>('');
    const [statusFilter, setStatusFilter] = useState<string[]>(filters.status ? filters.status.split(',') : []);
    const [municipalityFilter, setMunicipalityFilter] = useState<string[]>(filters.municipality_id ? filters.municipality_id.split(',') : []);

    useEffect(() => {
        setSelectedStatus('');
        setRowSelection({});
    }, [statusFilter, municipalityFilter, spaces.data]);

    const statusCounts = spaces.data.reduce(
        (acc, space) => {
            acc[space.status] = (acc[space.status] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );

    const statusOptions = Object.entries(options.statuses).map(([value, label]) => ({
        value,
        label,
        count: statusCounts[value] ?? 0,
    }));

    const municipalityOptions = options.municipalities
        .map((m) => ({
            value: String(m.id),
            label: m.name,
            count: spaces.data.filter((space) => String(space.municipality?.id) === String(m.id)).length,
        }))
        .filter((o) => o.count > 0);

    const updateFilters = (status: string[], municipality: string[]) => {
        const query: Record<string, string | null> = {};
        if (status.length > 0) query.status = status.join(',');
        if (municipality.length > 0) query.municipality_id = municipality.join(',');

        router.get(route('app.parking-spaces.index'), query, { preserveScroll: true, preserveState: true });
    };

    // Get the columns for the data table
    const columns = getParkingSpaceColumns(options.statuses, can, openDialog, { t, tGlobal });

    // Bulk update location status
    const handleBulkUpdate = () => {
        const ids: string[] = spaces.data.filter((_, index) => rowSelection[index]).map((space) => space.id);
        if (!selectedStatus || ids.length === 0) return;

        router.patch(
            route('app.parking-spaces.bulk.update'),
            {
                ids,
                status: selectedStatus,
            },
            {
                preserveState: true,
                onSuccess: () => {
                    setRowSelection({});
                    setSelectedStatus('');
                    toast.success(t('toast.success'));
                },
                onError: (errors) => {
                    if (errors.ids) {
                        toast.error(t('toast.errors.ids'));
                    } else if (errors.status) {
                        toast.error(t('toast.errors.status'));
                    } else {
                        toast.error(t('toast.errors.default'));
                    }
                },
            },
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: route('app.parking-spaces.index') }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <Heading title={t('head.title')} description={t('head.description')} />

                {can('parking-space.update') && Object.keys(rowSelection).length > 0 && (
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-muted/50">
                        <div className="relative flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{Object.keys(rowSelection).length}</span> {t('selected')}
                            </div>

                            <button
                                onClick={() => setRowSelection({})}
                                className="absolute top-0 right-0 cursor-pointer text-xs underline underline-offset-2 transition hover:text-foreground sm:static sm:ml-3 sm:text-sm sm:no-underline"
                            >
                                {t('bulk.clear')}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Select value={selectedStatus} onValueChange={(value: ParkingStatus) => setSelectedStatus(value)}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder={t('bulk.placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map(({ value, label }) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button onClick={handleBulkUpdate} disabled={!selectedStatus} className="w-full cursor-pointer sm:w-auto">
                                {t('bulk.update')}
                            </Button>
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={spaces.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    filters={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <DataTableFacetFilter
                                title={t('filters.status')}
                                selected={statusFilter}
                                options={statusOptions}
                                onChange={(next) => {
                                    setStatusFilter(next);
                                    updateFilters(next, municipalityFilter);
                                }}
                                onClear={() => {
                                    setStatusFilter([]);
                                    updateFilters([], municipalityFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.municipality')}
                                selected={municipalityFilter}
                                options={municipalityOptions}
                                onChange={(next) => {
                                    setMunicipalityFilter(next);
                                    updateFilters(statusFilter, next);
                                }}
                                onClear={() => {
                                    setMunicipalityFilter([]);
                                    updateFilters(statusFilter, []);
                                }}
                            />
                        </div>
                    }
                />

                <DataTablePagination pagination={spaces} />
            </div>
            {dialogElement}
        </AppLayout>
    );
}
