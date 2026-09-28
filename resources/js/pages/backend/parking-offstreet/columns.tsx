import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import parkingOffstreet from '@/routes/app/parking-offstreet';
import { ParkingOffstreet, Translations } from '@/types';
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

// Custom progress bar component for parking spaces
function ParkingProgressBar({ value, label }: { value: number; label: string }) {
    let color = 'bg-green-500';
    if (value <= 5) {
        color = 'bg-red-500';
    } else if (value <= 20) {
        color = 'bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500';
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative h-2 w-full overflow-hidden rounded bg-muted/40">
                        <div className={`h-2 rounded transition-all duration-300 ${color}`} style={{ width: `${Math.max(value, 0)}%` }} />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="px-2 py-1 text-xs">
                    {label}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// Function to get the columns for the parking offstreet data table
export function getParkingOffstreetColumns(can: (permission: string) => boolean, { t, tGlobal }: Translations): ColumnDef<ParkingOffstreet>[] {
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
            accessorKey: 'name',
            header: t('table.name'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) => (
                <div>
                    <span className="font-semibold">{row.original.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({row.original.parking_type === 'garage' ? 'Garage' : 'P+R'})</span>
                    <div className="text-xs text-muted-foreground">
                        {row.original.municipality?.name} / {row.original.country?.name}
                    </div>
                </div>
            ),
        },
        {
            id: 'api_state',
            header: t('table.api'),
            cell: ({ row }) => {
                const availability = row.original.availability ?? 'unknown';
                if (availability === 'current') {
                    return <Badge variant="default">{t('badges.current')}</Badge>;
                }

                return <Badge variant={availability === 'unavailable' ? 'destructive' : 'outline'}>{t(`badges.${availability}`)}</Badge>;
            },
        },
        {
            id: 'parking_status',
            header: t('table.status'),
            enableHiding: false,
            cell: ({ row }) => {
                const { free_space, capacity, availability, occupancy_status } = row.original;
                if (availability === 'closed') {
                    return <Badge variant="outline">{t('badges.closed')}</Badge>;
                }
                // Full or free is only claimed for a current measurement (#1221).
                if (availability !== 'current') return <span className="text-muted-foreground">—</span>;
                if (occupancy_status === 'full') {
                    return <Badge variant="destructive">{t('badges.full')}</Badge>;
                }
                if (occupancy_status === 'open') {
                    return <Badge variant="outline">{t('badges.open')}</Badge>;
                }
                if (!capacity || free_space == null) return <span className="text-muted-foreground">—</span>;
                if (free_space > capacity) {
                    return <Badge variant="outline">{t('badges.inconsistent')}</Badge>;
                }
                const pct = Math.round((free_space / capacity) * 100);

                if (pct <= 5) {
                    return <Badge variant="destructive">{t('badges.full')}</Badge>;
                }
                if (pct <= 20) {
                    return (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            {t('badges.almost_full')}
                        </Badge>
                    );
                }
                return (
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t('badges.plenty')}
                    </Badge>
                );
            },
        },
        {
            id: 'occupancy',
            header: t('table.occupancy'),
            cell: ({ row }) => {
                const { free_space, capacity } = row.original;
                if (free_space == null) return <span className="text-muted-foreground">—</span>;
                // A source can report more free spaces than capacity; show the raw values without a misleading bar.
                if (!capacity || free_space > capacity) {
                    return (
                        <span className="text-xs">
                            <strong>{free_space}</strong> {t('table.free')}
                            {capacity ? ` (${t('table.capacity', { capacity })})` : ''}
                        </span>
                    );
                }
                const pct = Math.round((free_space / capacity) * 100);

                return (
                    <div className="flex min-w-[120px] flex-col gap-1">
                        <div className="flex justify-between text-xs">
                            <span>
                                <strong>{free_space}</strong> {t('table.of')} {capacity}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <ParkingProgressBar value={pct} label={t('table.available', { pct })} />
                    </div>
                );
            },
        },
        {
            accessorKey: 'observed_at',
            header: t('table.observed_at'),
            cell: ({ row }) => (row.original.observed_at ? new Date(row.original.observed_at).toLocaleString() : '—'),
        },
        {
            accessorKey: 'visibility',
            header: t('table.visible'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                const space = row.original;
                return can('parking-offstreet.update') ? (
                    <Switch
                        checked={!!space.visibility}
                        className="cursor-pointer"
                        onCheckedChange={(checked) => {
                            router.post(
                                parkingOffstreet.toggleVisibility(),
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
                                                <span>{checked ? t('toast.enabled') : t('toast.disabled')}</span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {space.name} &middot; <b>ID:</b> {space.id}
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
        },
    ];
}
