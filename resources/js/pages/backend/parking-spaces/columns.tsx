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
import type { ParkingSpace } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Link } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

export function getParkingSpaceColumns(
    statuses: Record<ParkingStatus, string>,
    can: (permission: string) => boolean,
    openDialog: (type: DialogType, space: ParkingSpace) => void,
): ColumnDef<ParkingSpace>[] {
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
            accessorKey: 'user.name',
            header: 'Submitted By',
            cell: ({ row }) => row.original.user?.name ?? '—',
        },
        {
            accessorKey: 'province.name',
            header: 'Province',
            cell: ({ row }) => row.original.province?.name ?? '—',
        },
        {
            accessorKey: 'municipality.name',
            header: 'Municipality',
            cell: ({ row }) => row.original.municipality?.name ?? '—',
        },
        {
            accessorKey: 'city',
            header: 'City',
        },
        {
            accessorKey: 'street',
            header: 'Street',
            cell: ({ row }) => `${row.original.street}, ${row.original.postcode}`,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status as ParkingStatus;
                const variantMap: Record<ParkingStatus, 'default' | 'secondary' | 'destructive'> = {
                    pending: 'default',
                    approved: 'secondary',
                    rejected: 'destructive',
                };
                return <Badge variant={variantMap[status] ?? 'default'}>{statuses[status]}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: 'Submitted',
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
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
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {can('parking-space.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spaces.show', { id: space.id })}>Show</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space.update') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spaces.edit', { id: space.id })}>Edit</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space-confirmation.view_any') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.parking-spaces.confirmations.index', { id: space.id })}>Confirmations</Link>
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
                                            Move to Trash
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
