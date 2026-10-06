import LocalizedDateTime from '@/components/localized-date-time';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ParkingSpaceConfirmation, Translations } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

export const CONFIRMATION_DOTS: Record<string, string> = { confirmed: 'bg-green-600', moved: 'bg-amber-600', unavailable: 'bg-red-600' };

type Options = {
    statuses: Record<string, string>;
    can: (permission: string) => boolean;
    openDialog: (type: 'delete', subject: ParkingSpaceConfirmation) => void;
    when: (value: string) => string;
};

export function getConfirmationColumns(
    { statuses, can, openDialog, when }: Options,
    { t, tGlobal }: Translations,
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
            id: 'status',
            header: t('table.status'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap">
                    <span className={cn('size-1.75 rounded-full', CONFIRMATION_DOTS[row.original.status])} aria-hidden />
                    {statuses[row.original.status] ?? row.original.status}
                </span>
            ),
        },
        {
            id: 'user',
            header: t('table.user'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => <span className="font-medium">{row.original.user?.name ?? t('unknown')}</span>,
        },
        {
            id: 'comment',
            header: t('table.comment'),
            enableSorting: false,
            cell: ({ row }) =>
                row.original.comment ? (
                    <span className="text-foreground/80">“{row.original.comment}”</span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: 'confirmed_at',
            header: t('table.confirmedAt'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="whitespace-nowrap">
                    <LocalizedDateTime value={row.original.confirmed_at}>{when(row.original.confirmed_at)}</LocalizedDateTime>
                </span>
            ),
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) =>
                can('parking-space-confirmation.delete') && (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={t('table.actions.more')}>
                                    <MoreVertical />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        openDialog('delete', row.original);
                                    }}
                                >
                                    {t('table.actions.delete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
        },
    ];
}
