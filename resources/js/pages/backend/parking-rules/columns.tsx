import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Country, ParkingRule } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { MoreVertical } from 'lucide-react';

type OpenEditDialogFn = (rule: ParkingRule) => void;
type OpenDeleteDialogFn = (rule: ParkingRule) => void;

type Translations = {
    t: TFunction;
    tGlobal: TFunction;
};

export function getParkingRuleColumns(
    can: (permission: string) => boolean,
    openEditDialog: OpenEditDialogFn,
    openDeleteDialog: OpenDeleteDialogFn,
    { t, tGlobal }: Translations,
): ColumnDef<ParkingRule>[] {
    return [
        {
            accessorKey: 'id',
            header: 'ID',
            meta: { align: 'center' },
            enableSorting: true,
            enableHiding: false,
        },
        {
            accessorKey: 'country',
            header: t('table.country'),
            meta: { align: 'left' },
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                const country = row.original.country as Country | undefined;
                return country ? `${country.name} (${country.code})` : '—';
            },
        },
        {
            accessorKey: 'municipality',
            header: t('table.municipality'),
            meta: { align: 'left' },
            enableSorting: true,
            cell: ({ row }) => row.original.municipality?.name ?? '—',
        },
        {
            accessorKey: 'nationwide',
            header: t('table.nationwide'),
            meta: { align: 'left' },
            enableSorting: true,
            cell: ({ row }) =>
                row.original.nationwide ? (
                    <Badge variant="default">{tGlobal('common.yes')}</Badge>
                ) : (
                    <Badge variant="outline">{tGlobal('common.no')}</Badge>
                ),
        },
        {
            accessorKey: 'url',
            header: t('table.url'),
            meta: { align: 'left' },
            enableSorting: false,
            cell: ({ row }) => {
                const url = row.original.url;
                const displayUrl = url.length > 60 ? url.slice(0, 60) + '…' : url;
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">
                                    {displayUrl}
                                </a>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs break-all">
                                {url}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            },
        },
        {
            accessorKey: 'created_at',
            header: t('table.created_at'),
            meta: { align: 'left' },
            enableSorting: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            meta: { align: 'right' },
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                const parkingRule = row.original;
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
                                {can('parking-rule.update') && (
                                    <>
                                        <DropdownMenuItem
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                openEditDialog(parkingRule);
                                            }}
                                            className="cursor-pointer"
                                        >
                                            {tGlobal('common.edit')}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                {can('parking-rule.delete') && (
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            openDeleteDialog(parkingRule);
                                        }}
                                        className="cursor-pointer text-destructive"
                                    >
                                        {tGlobal('common.delete')}
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
