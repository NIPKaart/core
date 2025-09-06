import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import app from '@/routes/app';
import type { Role, Translations } from '@/types';
import { Link } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

type OpenDialogFn = (role: Role, type: 'delete') => void;

export function getRoleColumns(can: (permission: string) => boolean, openDialog: OpenDialogFn, { t, tGlobal }: Translations): ColumnDef<Role>[] {
    return [
        {
            accessorKey: 'name',
            header: t('table.name'),
            enableSorting: true,
            enableHiding: false,
        },
        {
            accessorKey: 'guard_name',
            header: t('table.guard'),
            enableSorting: false,
            enableHiding: true,
        },
        {
            accessorKey: 'created_at',
            header: t('table.created_at'),
            enableSorting: true,
            enableHiding: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) => {
                const role = row.original;
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
                                {/* {can('role.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.roles.show', { id: role.id })}>View</Link>
                                    </DropdownMenuItem>
                                )} */}
                                {can('role.update') && (
                                    <>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={app.roles.edit({ id: role.id })}>{tGlobal('common.edit')}</Link>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {can('role.delete') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                openDialog(role, 'delete');
                                            }}
                                            className="cursor-pointer text-destructive"
                                        >
                                            {tGlobal('common.delete')}
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
