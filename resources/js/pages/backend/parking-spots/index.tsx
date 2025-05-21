import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpotActionDialog } from '@/hooks/use-dialog-spot-action';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, ParkingSpot } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Head, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getParkingSpotColumns } from './columns';

type PageProps = {
    spots: PaginatedResponse<ParkingSpot>;
    filters: { status: string | null; municipality: string | null; deletion_requested: boolean };
    statuses: Record<ParkingStatus, string>;
    municipalities: string[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Parking Spots', href: route('app.parking-spots.index') }];

export default function Index({ spots, filters, statuses, municipalities }: PageProps) {
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpotActionDialog();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [selectedStatus, setSelectedStatus] = useState<ParkingStatus | ''>('');
    const [statusFilter, setStatusFilter] = useState<string[]>(filters.status ? filters.status.split(',') : []);
    const [municipalityFilter, setMunicipalityFilter] = useState<string[]>(filters.municipality ? filters.municipality.split(',') : []);

    useEffect(() => {
        setSelectedStatus('');
        setRowSelection({});
    }, [statusFilter, municipalityFilter, spots.data]);

    const statusCounts = spots.data.reduce(
        (acc, spot) => {
            acc[spot.status] = (acc[spot.status] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );

    const statusOptions = Object.entries(statuses).map(([value, label]) => ({
        value,
        label,
        count: statusCounts[value] ?? 0,
    }));

    const municipalityOptions = municipalities.map((name) => ({
        value: name,
        label: name,
        count: spots.data.filter((spot) => spot.municipality === name).length,
    }));

    const updateFilters = (status: string[], municipality: string[]) => {
        router.get(
            route('app.parking-spots.index'),
            { status: status.join(','), municipality: municipality.join(',') },
            { preserveScroll: true, preserveState: true },
        );
    };

    // Get the columns for the data table
    const columns = getParkingSpotColumns(statuses, can, openDialog);

    // Bulk update location status
    const handleBulkUpdate = () => {
        const ids: string[] = spots.data.filter((_, index) => rowSelection[index]).map((spot) => spot.id);
        if (!selectedStatus || ids.length === 0) return;

        router.patch(
            route('app.parking-spots.bulk-update'),
            {
                ids,
                status: selectedStatus,
            },
            {
                preserveState: true,
                onSuccess: () => {
                    setRowSelection({});
                    setSelectedStatus('');
                },
                onError: (errors) => {
                    if (errors.ids) {
                        toast.error('Invalid selection. Some items may no longer exist.');
                    } else if (errors.status) {
                        toast.error('Please select a valid status.');
                    } else {
                        toast.error('Something went wrong. Please try again.');
                    }
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spots" />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">Parking Spots</h1>

                {can('parking-spot.update') && Object.keys(rowSelection).length > 0 && (
                    <div className="bg-muted/70 dark:border-muted/50 flex flex-col gap-3 rounded-md border p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-muted-foreground text-sm">
                                <span className="text-foreground font-medium">{Object.keys(rowSelection).length}</span> selected
                            </div>

                            <button
                                onClick={() => setRowSelection({})}
                                className="hover:text-foreground absolute top-0 right-0 cursor-pointer text-xs underline underline-offset-2 transition sm:static sm:ml-3 sm:text-sm sm:no-underline"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Select value={selectedStatus} onValueChange={(value: ParkingStatus) => setSelectedStatus(value)}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Select status" />
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
                                Update status
                            </Button>
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={spots.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    filters={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <DataTableFacetFilter
                                title="Status"
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
                                title="Municipality"
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

                <DataTablePagination pagination={spots} />
            </div>
            {dialogElement}
        </AppLayout>
    );
}
