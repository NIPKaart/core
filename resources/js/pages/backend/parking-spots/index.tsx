import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, UserParkingSpot } from '@/types';
import { Head, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';
import { getParkingSpotColumns } from './columns';

type ParkingStatus = 'pending' | 'approved' | 'rejected';

type PageProps = {
    spots: PaginatedResponse<UserParkingSpot>;
    filters: {
        status: string | null;
        municipality: string | null;
        deletion_requested: boolean;
    };
    statuses: Record<ParkingStatus, string>;
    municipalities: string[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Parking Spots', href: route('app.parking-spots.index') }];

export default function Index({ spots, filters, statuses, municipalities }: PageProps) {
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [statusFilter, setStatusFilter] = useState<string[]>(filters.status ? filters.status.split(',') : []);
    const [municipalityFilter, setMunicipalityFilter] = useState<string[]>(filters.municipality ? filters.municipality.split(',') : []);

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
            {
                status: status.join(','),
                municipality: municipality.join(','),
            },
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    };

    const columns = getParkingSpotColumns(statuses, can);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spots" />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">Parking Spots</h1>

                {Object.keys(rowSelection).length > 0 && (
                    <div className="text-muted-foreground text-sm">{Object.keys(rowSelection).length} selected</div>
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
        </AppLayout>
    );
}
