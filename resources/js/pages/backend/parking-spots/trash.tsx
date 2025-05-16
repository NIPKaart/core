import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, PaginatedResponse, UserParkingSpot } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
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

export default function TrashPage({ spots }: PageProps) {
    const { can } = useAuthorization();

    const [dialogSpot, setDialogSpot] = useState<UserParkingSpot | null>(null);
    const [dialogType, setDialogType] = useState<'restore' | 'forceDelete' | null>(null);

    const openDialog = (spot: UserParkingSpot, type: 'restore' | 'forceDelete') => {
        setDialogSpot(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogSpot(spot);
            setDialogType(type);
        }, 0);
    };

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

    const columns: ColumnDef<UserParkingSpot>[] = [
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

                return <Badge variant={variantMap[status] ?? 'default'}>{status}</Badge>;
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

                <DataTable
                    columns={columns}
                    data={spots.data}
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
        </AppLayout>
    );
}
