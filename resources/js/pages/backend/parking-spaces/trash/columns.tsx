import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ParkingSpace, Translations } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical, RotateCcw } from 'lucide-react';
import { StatusPill } from '../parts';

export type TrashedSpace = ParkingSpace & { deleted_at: string };

type Options = {
    can: (permission: string) => boolean;
    openDialog: (type: 'restore' | 'forceDelete', space: ParkingSpace) => void;
    when: (value: string) => string;
    rejectionReasons: { value: string; label: string }[];
};

export function getParkingTrashColumns(
    { can, openDialog, when, rejectionReasons }: Options,
    { t, tGlobal }: Translations,
): ColumnDef<TrashedSpace>[] {
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
            id: 'location',
            header: t('table.location'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div>
                    <span className="block font-medium">{row.original.street}</span>
                    <span className="text-[13px] text-muted-foreground">{[row.original.postcode, row.original.city].filter(Boolean).join(' ')}</span>
                </div>
            ),
        },
        {
            id: 'municipality',
            header: t('table.municipality'),
            enableSorting: false,
            cell: ({ row }) => (
                <div>
                    {row.original.municipality?.name ?? '—'}
                    {row.original.province && <span className="block text-[13px] text-muted-foreground">{row.original.province.name}</span>}
                </div>
            ),
        },
        {
            id: 'contributor',
            header: t('table.submittedBy'),
            enableSorting: false,
            cell: ({ row }) => row.original.user?.name ?? <span className="text-muted-foreground">—</span>,
        },
        {
            id: 'status',
            header: t('table.status'),
            enableSorting: false,
            cell: ({ row }) => {
                const reason = row.original.status === 'rejected' && row.original.latest_review?.reason;

                return (
                    <div className="flex flex-col items-start gap-1">
                        <StatusPill status={row.original.status} />
                        {reason && (
                            <span className="text-[13px] text-muted-foreground">
                                {rejectionReasons.find((option) => option.value === reason)?.label ?? reason}
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'deleted_at',
            header: t('table.deletedAt'),
            enableSorting: false,
            cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original.deleted_at)}</span>,
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    {can('parking-space.restore') && (
                        <Button variant="outline" size="sm" onClick={() => openDialog('restore', row.original)}>
                            <RotateCcw />
                            {t('table.actions.restore')}
                        </Button>
                    )}
                    {can('parking-space.force-delete') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground"
                                    aria-label={t('table.actions.more', { street: row.original.street })}
                                >
                                    <MoreVertical />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        openDialog('forceDelete', row.original);
                                    }}
                                >
                                    {t('table.actions.forceDelete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            ),
        },
    ];
}
