import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { ParkingSpaceConfirmation, Translations } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';

const variantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
    confirmed: 'secondary',
    moved: 'default',
    unavailable: 'destructive',
};
type OpenDialogFn = (type: 'delete', subject: ParkingSpaceConfirmation) => void;

export function getConfirmationColumns(
    statuses: Record<string, string>,
    can: (permission: string) => boolean,
    openDialog: OpenDialogFn,
    { t }: Translations,
): ColumnDef<ParkingSpaceConfirmation>[] {
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
            accessorKey: 'status',
            header: t('table.status'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) => {
                const status = row.original.status;
                return <Badge variant={variantMap[status] || 'default'}>{statuses[status]}</Badge>;
            },
        },
        {
            accessorKey: 'user.name',
            header: t('table.user'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) => row.original.user?.name ?? <span className="text-muted-foreground italic">Unknown</span>,
        },
        {
            accessorKey: 'confirmed_at',
            header: t('table.confirmedAt'),
            enableSorting: true,
            cell: ({ row }) => {
                const date = row.original.confirmed_at;
                return <span title={new Date(date).toLocaleString()}>{formatDistanceToNow(parseISO(date), { addSuffix: true, locale: enUS })}</span>;
            },
        },
        {
            accessorKey: 'comment',
            header: t('table.comment'),
            enableSorting: false,
            cell: ({ row }) => row.original.comment ?? <span className="text-muted-foreground italic">—</span>,
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) =>
                can('parking-space-confirmation.delete') && (
                    <Button variant="destructive" size="icon" className="cursor-pointer" onClick={() => openDialog('delete', row.original)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t('table.actions.delete')}</span>
                    </Button>
                ),
        },
    ];
}
