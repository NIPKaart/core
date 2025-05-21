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
import type { DialogType } from '@/hooks/use-dialog-spot-action';
import type { ParkingSpot } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Link } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

export function getParkingSpotColumns(
    statuses: Record<ParkingStatus, string>,
    can: (permission: string) => boolean,
    openDialog: (type: DialogType, spot: ParkingSpot) => void,
): ColumnDef<ParkingSpot>[] {
    return [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label="Select all"
                    className="border-input bg-background data-[state=checked]:bg-primary cursor-pointer border"
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
            cell: ({ row }) => row.original.province.name,
        },
        {
            accessorKey: 'municipality',
            header: 'Municipality',
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
                const spot = row.original;

                return (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground data-[state=open]:bg-muted flex size-8 cursor-pointer"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {can('parking-spot.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spots.show', { id: spot.id })}>Show</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-spot.update') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.parking-spots.edit', { id: spot.id })}>Edit</Link>
                                    </DropdownMenuItem>
                                )}

                                {can('parking-spot.delete') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive cursor-pointer"
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                openDialog('delete', spot);
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
