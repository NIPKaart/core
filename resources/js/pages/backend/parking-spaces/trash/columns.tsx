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
                    aria-label={tGlobal('common.selectAll')}
                    className="cursor-pointer border border-input bg-background data-[state=checked]:bg-primary"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                    aria-label={tGlobal('common.selectRow')}
                    className="cursor-pointer"
                />
            ),
        },
        {
            accessorKey: 'user.name',
            header: t('table.submittedBy'),
            enableSorting: true,
            cell: ({ row }) => row.original.user?.name ?? '—',
        },
        {
            accessorKey: 'municipality',
            header: t('table.municipality'),
            enableSorting: true,
            cell: ({ row }) => row.original.municipality?.name ?? '—',
        },
        {
            accessorKey: 'city',
            header: t('table.city'),
            enableSorting: true,
        },
        {
            accessorKey: 'street',
            header: t('table.street'),
            enableSorting: true,
            cell: ({ row }) => `${row.original.street}, ${row.original.postcode}`,
        },
        {
            accessorKey: 'status',
            header: t('table.status'),
            enableSorting: true,
            cell: ({ row }) => {
                const status = row.original.status;
                const variantMap = {
                    pending: 'default',
                    approved: 'secondary',
                    rejected: 'destructive',
                } as const;

                return <Badge variant={variantMap[status as keyof typeof variantMap] ?? 'default'}>{t(`status.${status}`)}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: t('table.submittedAt'),
            enableSorting: true,
            cell: ({ row }) =>
                new Date(row.original.created_at).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                }),
        },
        {
            accessorKey: 'deleted_at',
            header: t('table.deletedAt'),
            enableSorting: true,
            cell: ({ row }) => {
                const deletedAt = row.original.deleted_at;
                return deletedAt
                    ? new Date(deletedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                      })
                    : '—';
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
                                <span className="sr-only">{t('table.actions.restore')}</span>
                            </Button>
                        )}

                        {can('parking-space.force-delete') && (
                            <Button variant="destructive" className="cursor-pointer" size="icon" onClick={() => openDialog('forceDelete', space)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t('table.actions.forceDelete')}</span>
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];
}
