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
import app from '@/routes/app';
import type { ParkingSpace, Translations, User } from '@/types';
import { Link } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';
import { SignalBadges, StatusPill } from './parts';

export type SpaceRow = ParkingSpace & {
    user?: (User & { parking_spaces_count?: number }) | null;
    confirmations_count: number;
    open_reports_count: number;
    open_improvements_count: number;
};

type Options = {
    can: (permission: string) => boolean;
    openDialog: (type: DialogType, space: ParkingSpace) => void;
    when: (value: string) => string;
    rejectionReasons: { value: string; label: string }[];
};

export function getParkingSpaceColumns({ can, openDialog, when, rejectionReasons }: Options, { t, tGlobal }: Translations): ColumnDef<SpaceRow>[] {
    return [
        {
            id: 'select',
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label={t('index.select_all')}
                    className="cursor-pointer border border-input bg-background data-[state=checked]:bg-primary"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                    aria-label={t('index.select', { street: row.original.street })}
                    className="cursor-pointer"
                />
            ),
        },
        {
            id: 'location',
            accessorKey: 'street',
            header: t('index.columns.location'),
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <Link
                        href={app.parkingSpaces.show({ parking_space: row.original.id })}
                        className="block font-medium hover:underline hover:underline-offset-4"
                    >
                        {row.original.street}
                    </Link>
                    <span className="text-[13px] text-muted-foreground">{[row.original.postcode, row.original.city].filter(Boolean).join(' ')}</span>
                </div>
            ),
        },
        {
            id: 'municipality',
            accessorKey: 'municipality.name',
            header: t('index.columns.municipality'),
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
            accessorKey: 'user.name',
            header: t('index.columns.contributor'),
            enableSorting: false,
            cell: ({ row }) => {
                const contributions = row.original.user?.parking_spaces_count ?? 0;

                return row.original.user ? (
                    <div>
                        {row.original.user.name}
                        <span
                            className={
                                contributions === 1
                                    ? 'block text-[13px] text-amber-700 dark:text-amber-400'
                                    : 'block text-[13px] text-muted-foreground'
                            }
                        >
                            {contributions === 1 ? t('index.first_contribution') : t('index.contributions', { count: contributions })}
                        </span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">{t('index.removed_account')}</span>
                );
            },
        },
        {
            id: 'status',
            accessorKey: 'status',
            header: t('index.columns.status'),
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => {
                const space = row.original;
                const reason = space.status === 'rejected' && space.latest_review?.reason;

                return (
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill status={space.status} />
                            <SignalBadges
                                nearbyMunicipalMetres={space.nearby_municipal_metres}
                                openReports={space.open_reports_count}
                                openImprovements={space.open_improvements_count}
                            />
                        </div>
                        {space.status === 'pending' && (
                            <Link
                                href={app.moderation.submissions.show({ parking_space: space.id })}
                                className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                            >
                                {t('index.review')}
                            </Link>
                        )}
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
            id: 'confirmations',
            accessorKey: 'confirmations_count',
            header: () => <span className="block text-right">{t('index.columns.confirmations')}</span>,
            enableSorting: false,
            cell: ({ row }) => (
                <span className={row.original.confirmations_count > 0 ? 'block text-right tabular-nums' : 'block text-right text-muted-foreground'}>
                    {row.original.confirmations_count > 0 ? row.original.confirmations_count : '—'}
                </span>
            ),
        },
        {
            id: 'created_at',
            accessorKey: 'created_at',
            header: t('index.columns.added'),
            enableSorting: false,
            cell: ({ row }) => <span className="whitespace-nowrap">{when(row.original.created_at)}</span>,
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
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
                                    aria-label={t('index.actions_for', { street: space.street })}
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>{tGlobal('common.actions')}</DropdownMenuLabel>
                                {can('parking-space.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={app.parkingSpaces.show({ parking_space: space.id })}>{tGlobal('common.show')}</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space.update') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={app.parkingSpaces.edit({ parking_space: space.id })}>{tGlobal('common.edit')}</Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space-confirmation.view_any') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={app.parkingSpaces.confirmations.index({ parking_space: space.id })}>
                                            {t('table.actions.confirmations')}
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                {can('parking-space.delete') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="cursor-pointer text-destructive"
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                openDialog('delete', space);
                                            }}
                                        >
                                            {t('index.move_to_trash')}
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
