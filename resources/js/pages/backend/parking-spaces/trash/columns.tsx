import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ParkingSpace, Translations } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { RotateCcw, Trash2 } from 'lucide-react';

type OpenDialogFn = (type: 'restore' | 'forceDelete', space: ParkingSpace) => void;

export function getParkingTrashColumns(
    can: (permission: string) => boolean,
    openDialog: OpenDialogFn,
    { t, tGlobal }: Translations,
): ColumnDef<ParkingSpace>[] {
    return [
        {
            id: 'select',
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label="Select all"
                    className="cursor-pointer border border-input bg-background data-[state=checked]:bg-primary"
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
            enableHiding: false,
            cell: ({ row }) => {
                const space = row.original;

                return (
                    <div className="flex justify-end gap-2">
                        {can('parking-space.restore') && (
                            <Button variant="outline" className="cursor-pointer" size="icon" onClick={() => openDialog('restore', space)}>
                                <RotateCcw className="h-4 w-4" />
                                <span className="sr-only">Restore</span>
                            </Button>
                        )}

                        {can('parking-space.force-delete') && (
                            <Button variant="destructive" className="cursor-pointer" size="icon" onClick={() => openDialog('forceDelete', space)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete permanently</span>
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];
}
