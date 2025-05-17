import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, UserParkingSpot } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parking Spots', href: route('app.user-parking-spots.index') },
    { title: 'Trash', href: route('app.user-parking-spots.trash') },
];

type PageProps = {
    spots: PaginatedResponse<UserParkingSpot>;
};

export default function Trash({ spots }: PageProps) {
    const { can } = useAuthorization();

    const [dialogSpot, setDialogSpot] = useState<UserParkingSpot | null>(null);
    const [dialogType, setDialogType] = useState<'restore' | 'forceDelete' | null>(null);
    const [bulkDialogType, setBulkDialogType] = useState<'bulk-restore' | 'bulk-force-delete' | null>(null);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    const openDialog = (spot: UserParkingSpot, type: 'restore' | 'forceDelete') => {
        setDialogSpot(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogSpot(spot);
            setDialogType(type);
        }, 0);
    };

    const selectedIds = spots.data.filter((_, index) => rowSelection[index]).map((spot) => spot.id);

    const restoreSpot = (id: string) => {
        router.patch(
            route('app.user-parking-spots.restore', { user_parking_spot: id }),
            {},
            {
                onSuccess: () => toast.success('Parking spot restored.'),
                onError: () => toast.error('Failed to restore spot.'),
            },
        );
    };

    const forceDeleteSpot = (id: string) => {
        router.delete(route('app.user-parking-spots.force-delete', { user_parking_spot: id }), {
            data: {},
            onSuccess: () => toast.success('Parking spot permanently deleted.'),
            onError: () => toast.error('Failed to delete spot.'),
        });
    };

    const handleBulkRestore = () => {
        router.patch(
            route('app.user-parking-spots.bulk-restore'),
            { ids: selectedIds },
            {
                onSuccess: () => {
                    toast.success('Restored selected spots.');
                    setRowSelection({});
                    setBulkDialogType(null);
                },
                onError: () => toast.error('Restore failed.'),
            },
        );
    };

    const handleBulkForceDelete = () => {
        router.delete(route('app.user-parking-spots.bulk-force-delete'), {
            data: { ids: selectedIds },
            onSuccess: () => {
                toast.success('Deleted selected spots.');
                setRowSelection({});
                setBulkDialogType(null);
            },
            onError: () => toast.error('Delete failed.'),
        });
    };

    const columns: ColumnDef<UserParkingSpot>[] = [
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
                        {can('user-parking-spot.restore') && (
                            <Button variant="outline" className="cursor-pointer" size="icon" onClick={() => openDialog(spot, 'restore')}>
                                <RotateCcw className="h-4 w-4" />
                                <span className="sr-only">Restore</span>
                            </Button>
                        )}

                        {can('user-parking-spot.force-delete') && (
                            <Button variant="destructive" className="cursor-pointer" size="icon" onClick={() => openDialog(spot, 'forceDelete')}>
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

                {Object.keys(rowSelection).length > 0 && (
                    <div className="bg-muted/60 dark:border-muted/40 mb-4 flex flex-col rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground text-sm">
                            <span className="text-foreground font-medium">{Object.keys(rowSelection).length}</span> selected
                        </div>

                        <div className="mt-2 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-3">
                            {can('user-parking-spot.restore') && (
                                <Button variant="outline" className="cursor-pointer" onClick={() => setBulkDialogType('bulk-restore')}>
                                    Restore selected
                                </Button>
                            )}
                            {can('user-parking-spot.force-delete') && (
                                <Button variant="destructive" className="cursor-pointer" onClick={() => setBulkDialogType('bulk-force-delete')}>
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
            </div>

            {dialogSpot && dialogType === 'restore' && (
                <ConfirmDialog
                    title="Restore Parking Spot"
                    description={`Do you want to restore the spot at "${dialogSpot.street}, ${dialogSpot.city}"?`}
                    confirmText="Restore"
                    onConfirm={() => restoreSpot(dialogSpot.id)}
                    onClose={() => {
                        setDialogSpot(null);
                        setDialogType(null);
                    }}
                />
            )}

            {dialogSpot && dialogType === 'forceDelete' && (
                <ConfirmDialog
                    title="Delete Permanently"
                    description="Are you sure? This action cannot be undone."
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={() => forceDeleteSpot(dialogSpot.id)}
                    onClose={() => {
                        setDialogSpot(null);
                        setDialogType(null);
                    }}
                />
            )}

            {bulkDialogType === 'bulk-restore' && (
                <ConfirmDialog
                    title="Restore selected spots"
                    description="Are you sure you want to restore the selected parking spots?"
                    confirmText="Restore"
                    onConfirm={handleBulkRestore}
                    onClose={() => setBulkDialogType(null)}
                />
            )}

            {bulkDialogType === 'bulk-force-delete' && (
                <ConfirmDialog
                    title="Delete selected spots permanently"
                    description="This cannot be undone. Are you sure?"
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={handleBulkForceDelete}
                    onClose={() => setBulkDialogType(null)}
                />
            )}
        </AppLayout>
    );
}
