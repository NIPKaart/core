import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, UserParkingSpot } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Parking Spots', href: route('app.parking-spots.index') }];

type ParkingStatus = 'pending' | 'approved' | 'rejected';

type PageProps = {
    spots: PaginatedResponse<UserParkingSpot>;
    filters: {
        status: string | null;
        deletion_requested: boolean;
    };
    statuses: Record<ParkingStatus, string>;
};

export default function Index({ spots, filters, statuses }: PageProps) {
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [statusFilter, setStatusFilter] = useState<string[]>(filters.status ? filters.status.split(',') : []);

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

    const clearFilters = () => {
        setStatusFilter([]);
        router.get(
            route('app.parking-spots.index'),
            {},
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    };

    const columns: ColumnDef<UserParkingSpot>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(!!checked)} aria-label="Select row" />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'user.name',
            header: 'Submitted By',
            cell: ({ row }) => row.original.user?.name ?? '—',
        },
        {
            accessorKey: 'province.name',
            header: 'Province',
            cell: ({ row }) => row.original.province.name,
        },
        {
            accessorKey: 'municipality',
            header: 'Municipality',
            cell: ({ row }) => row.original.municipality,
        },
        {
            accessorKey: 'city',
            header: 'City',
        },
        {
            accessorKey: 'street',
            header: 'Street',
            cell: ({ row }) => `${row.original.street}, ${row.original.postcode}`,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status as ParkingStatus;
                const variantMap: Record<ParkingStatus, 'default' | 'secondary' | 'destructive'> = {
                    pending: 'default',
                    approved: 'secondary',
                    rejected: 'destructive',
                };
                return <Badge variant={variantMap[status] ?? 'default'}>{statuses[status]}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: 'Submitted',
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
            meta: { align: 'right' },
            cell: ({ row }) => {
                const spot = row.original;

                return (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground data-[state=open]:bg-muted flex size-8 cursor-pointer"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {can('user-parking-spot.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spots.show', { id: spot.id })}>View</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('user-parking-spot.update') && (
                                    <div>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.parking-spots.edit', { id: spot.id })}>Edit</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </div>
                                )}
                                {/* {can('user-parking-spot.delete') && (
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            openDialog(role, 'delete');
                                        }}
                                        className="text-destructive cursor-pointer"
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                )} */}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spots" />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">Parking Spots</h1>

                {/* Optioneel: Toon aantal geselecteerde rijen */}
                {Object.keys(rowSelection).length > 0 && (
                    <div className="text-muted-foreground text-sm">{Object.keys(rowSelection).length} selected</div>
                )}

                <DataTable
                    columns={columns}
                    data={spots.data}
                    filters={
                        <DataTableFacetFilter
                            title="Status"
                            selected={statusFilter}
                            options={statusOptions}
                            onChange={(next) => {
                                setStatusFilter(next);
                                router.get(
                                    route('app.parking-spots.index'),
                                    {
                                        status: next.join(','),
                                    },
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                    },
                                );
                            }}
                            onClear={clearFilters}
                        />
                    }
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                />

                <DataTablePagination pagination={spots} />
            </div>
        </AppLayout>
    );
}
