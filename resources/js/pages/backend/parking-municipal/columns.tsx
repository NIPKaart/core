import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { ParkingMunicipal } from '@/types';
import { ParkingOrientation } from '@/types/enum';
import { router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export function getParkingMunicipalColumns(
    can: (permission: string) => boolean,
    orientations: Record<ParkingOrientation, string>,
): ColumnDef<ParkingMunicipal>[] {
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
            accessorKey: 'id',
            header: 'ID',
            cell: ({ row }) => row.original.id,
        },
        {
            accessorKey: 'province.name',
            header: 'Province',
            cell: ({ row }) => row.original.province?.name ?? '—',
        },
        // {
        //     accessorKey: 'municipality.name',
        //     header: 'Municipality',
        //     cell: ({ row }) => row.original.municipality?.name ?? '—',
        // },
        {
            accessorKey: 'street',
            header: 'Street',
        },
        {
            accessorKey: 'number',
            header: 'Number',
        },
        {
            accessorKey: 'orientation',
            header: 'Orientation',
            cell: ({ row }) => {
                const orientation = row.original.orientation as ParkingOrientation | null;
                return orientation ? <Badge variant="secondary">{orientations[orientation]}</Badge> : <Badge variant="outline">Unknown</Badge>;
            },
        },
        {
            accessorKey: 'visibility',
            header: 'Visible',
            cell: ({ row }) => {
                const space = row.original;
                return can('parking-municipal.update') ? (
                    <Switch
                        checked={!!space.visibility}
                        className="cursor-pointer"
                        onCheckedChange={(checked) => {
                            router.post(
                                route('app.parking-municipal.toggle-visibility'),
                                {
                                    ids: [space.id],
                                    visibility: checked,
                                },
                                {
                                    preserveScroll: true,
                                    preserveState: true,
                                    only: ['spaces'],
                                    onSuccess: () => {
                                        toast.success(
                                            <>
                                                <span>
                                                    Visibility <b>{checked ? 'enabled' : 'disabled'}</b>
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {space.street ? `"${space.street}"` : <i>Unknown street</i>} &middot; <b>ID:</b> {space.id}
                                                </span>
                                            </>,
                                        );
                                    },
                                    onError: () => {
                                        toast.error('Failed to update visibility.');
                                    },
                                },
                            );
                        }}
                        aria-label="Toggle visibility"
                    />
                ) : (
                    <span>{space.visibility ? 'Yes' : 'No'}</span>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'updated_at',
            header: 'Updated',
            cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
        },
    ];
}
