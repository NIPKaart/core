import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { ParkingSpaceConfirmation } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';

const variantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
    confirmed: 'secondary',
    moved: 'default',
    unavailable: 'destructive',
};

export function getConfirmationColumns(
    statuses: Record<string, string>,
    can: (permission: string) => boolean,
    openDialog: (type: 'delete', subject: ParkingSpaceConfirmation) => void,
): ColumnDef<ParkingSpaceConfirmation>[] {
    return [
        {
            id: 'select',
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
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={variantMap[row.original.status] ?? 'default'}>{statuses[row.original.status] ?? row.original.status}</Badge>
            ),
        },
        {
            accessorKey: 'user.name',
            header: 'User',
            enableSorting: true,
            cell: ({ row }) => row.original.user?.name ?? <span className="text-muted-foreground italic">Unknown</span>,
        },
        {
            accessorKey: 'confirmed_at',
            header: 'Confirmed at',
            enableSorting: true,
            cell: ({ row }) => {
                const date = row.original.confirmed_at;
                return <span title={new Date(date).toLocaleString()}>{formatDistanceToNow(parseISO(date), { addSuffix: true, locale: enUS })}</span>;
            },
        },
        {
            accessorKey: 'comment',
            header: 'Comment',
            enableSorting: false,
            cell: ({ row }) => row.original.comment ?? <span className="text-muted-foreground italic">—</span>,
        },
        {
            id: 'actions',
            enableSorting: false,
            meta: { align: 'right' },
            cell: ({ row }) =>
                can('parking-space-confirmation.delete') && (
                    <Button variant="destructive" size="icon" className="cursor-pointer" onClick={() => openDialog('delete', row.original)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete confirmation</span>
                    </Button>
                ),
        },
    ];
}
