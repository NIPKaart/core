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
import type { DialogType } from '@/hooks/use-dialog-space-action';
import type { ParkingSpace, Translations } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Link } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

const variantMap: Record<ParkingStatus, 'default' | 'secondary' | 'destructive'> = {
    pending: 'default',
    approved: 'secondary',
    rejected: 'destructive',
};
type OpenDialogFn = (type: DialogType, space: ParkingSpace) => void;

export function getParkingSpaceColumns(
    statuses: Record<ParkingStatus, string>,
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
            header: t('table.submittedBy'),
            enableHiding: false,
            cell: ({ row }) => row.original.user?.name ?? '—',
        },
        {
            accessorKey: 'province.name',
            header: t('table.province'),
            cell: ({ row }) => row.original.province?.name ?? '—',
        },
        {
            accessorKey: 'municipality.name',
            header: t('table.municipality'),
            cell: ({ row }) => row.original.municipality?.name ?? '—',
        },
        {
            accessorKey: 'city',
            header: t('table.city'),
        },
        {
            accessorKey: 'street',
            header: t('table.street'),
            cell: ({ row }) => `${row.original.street}, ${row.original.postcode}`,
        },
        {
            accessorKey: 'status',
            header: t('table.status'),
            enableHiding: false,
            cell: ({ row }) => {
                const status = row.original.status as ParkingStatus;
                return <Badge variant={variantMap[status] ?? 'default'}>{statuses[status]}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: t('table.submittedAt'),
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) => {
                const space = row.original;

                return (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex size-8 cursor-pointer text-muted-foreground data-[state=open]:bg-muted"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">{tGlobal('common.openMenu')}</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>{tGlobal('common.actions')}</DropdownMenuLabel>
                                {can('parking-space.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spaces.show', { id: space.id })}>{tGlobal('common.show')}</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space.update') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spaces.edit', { id: space.id })}>{tGlobal('common.edit')}</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space-confirmation.view_any') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.parking-spaces.confirmations.index', { id: space.id })}>
                                                {t('table.actions.confirmations')}
                                            </Link>
                                        </DropdownMenuItem>
                                    </>
                                )}

                                {can('parking-space.delete') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="cursor-pointer text-destructive"
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                openDialog('delete', space);
                                            }}
                                        >
                                            {t('table.actions.trash')}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
