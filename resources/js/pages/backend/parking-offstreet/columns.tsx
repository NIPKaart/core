import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ParkingOffstreet } from '@/types';
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';


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

export function getParkingOffstreetColumns(can: (permission: string) => boolean): ColumnDef<ParkingOffstreet>[] {
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
            accessorKey: 'name',
            header: 'Name',
            cell: ({ row }) => (
                <div>
                    <span className="font-semibold">{row.original.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({row.original.parking_type === 'garage' ? 'Garage' : 'P+R'})</span>
                    <div className="text-xs text-muted-foreground">
                        {row.original.municipality?.name} / {row.original.country?.name}
                    </div>
                </div>
            ),
            enableSorting: true,
        },
        {
            id: 'parking_status',
            header: 'Status',
            cell: ({ row }) => {
                const { free_space_short, short_capacity } = row.original;
                if (!short_capacity) return <span className="text-muted-foreground">—</span>;
                const pct = Math.round(((free_space_short ?? 0) / short_capacity) * 100);

                if (pct <= 5) {
                    return <Badge variant="destructive">Full!</Badge>;
                }
                if (pct <= 20) {
                    return (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Almost full
                        </Badge>
                    );
                }
                return (
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Plenty of space
                    </Badge>
                );
            },
        },
        {
            id: 'short_parking',
            header: 'Short Parking',
            cell: ({ row }) => {
                const { free_space_short, short_capacity } = row.original;
                const pct = short_capacity ? Math.round(((free_space_short ?? 0) / short_capacity) * 100) : 0;
                const label = `${pct}% available (short)`;
                return (
                    <div className="flex min-w-[120px] flex-col gap-1">
                        <div className="flex justify-between text-xs">
                            <span>
                                <strong>{free_space_short}</strong> / {short_capacity}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <ParkingProgressBar value={pct} label={label} />
                    </div>
                );
            },
        },
        {
            id: 'long_parking',
            header: 'Long Parking',
            cell: ({ row }) => {
                const { free_space_long, long_capacity } = row.original;
                if (!long_capacity) return <span className="text-muted-foreground">—</span>;
                const pct = long_capacity ? Math.round(((free_space_long ?? 0) / long_capacity) * 100) : 0;
                const label = `${pct}% available (long)`;
                return (
                    <div className="flex min-w-[120px] flex-col gap-1">
                        <div className="flex justify-between text-xs">
                            <span>
                                <strong>{free_space_long}</strong> / {long_capacity}
                            </span>
                            <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <ParkingProgressBar value={pct} label={label} />
                    </div>
                );
            },
        },
        {
            accessorKey: 'updated_at',
            header: 'Last Updated',
            cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
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
                                route('app.parking-offstreet.toggle-visibility'),
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
                                                    {space.name} &middot; <b>ID:</b> {space.id}
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
    ];
}
