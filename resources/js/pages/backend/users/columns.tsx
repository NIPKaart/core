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
import app from '@/routes/app';
import type { Translations, User } from '@/types';
import { Link } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

type UserWithRoles = User & {
    roles: { id: number; name: string }[];
};
type OpenDialogFn = (user: UserWithRoles, type: 'delete' | 'suspend') => void;

export function getUserColumns(
    can: (permission: string) => boolean,
    authUser: { id: number } | undefined,
    openDialog: OpenDialogFn,
    { t, tGlobal }: Translations,
): ColumnDef<UserWithRoles>[] {
    return [
        {
            accessorKey: 'name',
            header: t('table.name'),
            enableSorting: true,
            enableHiding: false,
        },
        {
            accessorKey: 'email',
            header: t('table.email'),
            enableSorting: false,
            enableHiding: true,
        },
        {
            accessorKey: 'roles',
            header: t('table.roles'),
            enableSorting: false,
            enableHiding: true,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.roles.map((role) => (
                        <Badge key={role.id} variant="outline" className="capitalize">
                            {role.name}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            id: 'status',
            header: t('table.status'),
            accessorFn: (row) => (row.suspended_at ? 'Suspended' : 'Active'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) =>
                row.original.suspended_at ? (
                    <Badge variant="destructive">{t('table.suspended')}</Badge>
                ) : (
                    <Badge variant="secondary">{t('table.active')}</Badge>
                ),
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
                const user = row.original;
                const isSelf = user.id === authUser?.id;
                const isSuspended = !!user.suspended_at;

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
                                {/* {can('user.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.users.show', { id: user.id })}>View</Link>
                                    </DropdownMenuItem>
                                )} */}
                                {can('user.update') && (
                                    <>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={app.users.edit({ id: user.id })}>{tGlobal('common.edit')}</Link>
                                        </DropdownMenuItem>
                                        {!isSelf && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onSelect={(e) => {
                                                        e.preventDefault();
                                                        openDialog(user, 'suspend');
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    {isSuspended ? t('table.actions.unsuspend') : t('table.actions.suspend')}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </>
                                )}
                                {can('user.delete') && !isSelf && (
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            openDialog(user, 'delete');
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
