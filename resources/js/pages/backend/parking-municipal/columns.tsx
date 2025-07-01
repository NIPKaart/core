import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { ParkingMunicipal, Translations } from '@/types';
import { ParkingOrientation } from '@/types/enum';
import { router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export function getParkingMunicipalColumns(
    can: (permission: string) => boolean,
    orientations: Record<ParkingOrientation, string>,
    { t, tGlobal }: Translations,
): ColumnDef<ParkingMunicipal>[] {
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
            accessorKey: 'id',
            header: t('table.id'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) => row.original.id,
        },
        {
            accessorKey: 'province.name',
            header: t('table.province'),
            cell: ({ row }) => row.original.province?.name ?? '—',
        },
        {
            accessorKey: 'street',
            header: t('table.street'),
            enableHiding: false,
        },
        {
            accessorKey: 'number',
            header: t('table.count'),
        },
        {
            accessorKey: 'orientation',
            header: t('table.orientation'),
            cell: ({ row }) => {
                const orientation = row.original.orientation as ParkingOrientation | null;
                return orientation ? (
                    <Badge variant="secondary">{orientations[orientation]}</Badge>
                ) : (
                    <Badge variant="outline">{t('filters.options.unknown')}</Badge>
                );
            },
        },
        {
            accessorKey: 'visibility',
            header: t('table.visible'),
            enableHiding: false,
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
                                                <span>{t(`toast.${checked ? 'enabled' : 'disabled'}`)}</span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {space.street ? `"${space.street}"` : <i>{t('toast.unknown_street')}</i>} &middot; <b>ID:</b>{' '}
                                                    {space.id}
                                                </span>
                                            </>,
                                        );
                                    },
                                    onError: () => {
                                        toast.error(t('toast.error'));
                                    },
                                },
                            );
                        }}
                        aria-label={t('accessibility.toggle_visibility', { id: space.id })}
                    />
                ) : (
                    <span>{space.visibility ? tGlobal('common.yes') : tGlobal('common.no')}</span>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'updated_at',
            header: t('table.updated'),
            cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
        },
    ];
}
