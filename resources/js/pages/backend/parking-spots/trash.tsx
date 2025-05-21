import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpotActionDialog } from '@/hooks/use-dialog-spot-action';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, ParkingSpot } from '@/types';
import { Head } from '@inertiajs/react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spots', href: route('app.parking-spots.index') },
    { title: 'Trash', href: route('app.parking-spots.trash') },
];

type PageProps = {
    spots: PaginatedResponse<ParkingSpot>;
};

export default function Trash({ spots }: PageProps) {
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const { openDialog, dialogElement } = useSpotActionDialog();

    const selectedIds = spots.data.filter((_, index) => rowSelection[index]).map((spot) => spot.id);

    const columns: ColumnDef<ParkingSpot>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label="Select all"
                    className="border-input bg-background data-[state=checked]:bg-primary cursor-pointer border"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                    aria-label="Select row"
                    className="cursor-pointer"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'user.name',
            header: 'Submitted By',
            enableSorting: true,
            cell: ({ row }) => row.original.user?.name ?? '—',
        },
        {
            accessorKey: 'municipality',
            header: 'Municipality',
            enableSorting: true,
        },
        {
            accessorKey: 'city',
            header: 'City',
            enableSorting: true,
        },
        {
            accessorKey: 'street',
            header: 'Street',
            enableSorting: true,
            cell: ({ row }) => `${row.original.street}, ${row.original.postcode}`,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            enableSorting: true,
            cell: ({ row }) => {
                const status = row.original.status;
                const variantMap = {
                    pending: 'default',
                    approved: 'secondary',
                    rejected: 'destructive',
                } as const;

                return <Badge variant={variantMap[status as keyof typeof variantMap] ?? 'default'}>{status}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: 'Submitted At',
            enableSorting: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            accessorKey: 'deleted_at',
            header: 'Deleted At',
            enableSorting: true,
            cell: ({ row }) => {
                const deletedAt = row.original.deleted_at;
                return deletedAt ? new Date(deletedAt).toLocaleDateString() : '—';
            },
        },
        {
            id: 'actions',
            enableSorting: false,
            cell: ({ row }) => {
                const spot = row.original;

                return (
                    <div className="flex justify-end gap-2">
                        {can('parking-spot.restore') && (
                            <Button variant="outline" className="cursor-pointer" size="icon" onClick={() => openDialog('restore', spot)}>
                                <RotateCcw className="h-4 w-4" />
                                <span className="sr-only">Restore</span>
                            </Button>
                        )}

                        {can('parking-spot.force-delete') && (
                            <Button variant="destructive" className="cursor-pointer" size="icon" onClick={() => openDialog('forceDelete', spot)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete permanently</span>
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Trash — Parking Spots" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">Trashed Parking Spots</h1>

                {selectedIds.length > 0 && (
                    <div className="bg-muted/60 dark:border-muted/40 mb-4 flex flex-col rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground text-sm">
                            <span className="text-foreground font-medium">{selectedIds.length}</span> selected
                        </div>

                        <div className="mt-2 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-3">
                            {can('parking-spot.restore') && (
                                <Button variant="outline" className="cursor-pointer" onClick={() => openDialog('bulkRestore', { ids: selectedIds })}>
                                    Restore selected
                                </Button>
                            )}
                            {can('parking-spot.force-delete') && (
                                <Button
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onClick={() => openDialog('bulkForceDelete', { ids: selectedIds })}
                                >
                                    Delete selected
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={spots.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    initialState={{
                        sorting: [{ id: 'deleted_at', desc: true }],
                    }}
                />
                <DataTablePagination pagination={spots} />
                {dialogElement}
            </div>
        </AppLayout>
    );
}
