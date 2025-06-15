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
import type { User } from '@/types';
import { Link } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

type UserWithRoles = User & {
    roles: { id: number; name: string }[];
};

export function getUserColumns(
    can: (permission: string) => boolean,
    authUser: { id: number } | undefined,
    openDialog: (user: UserWithRoles, type: 'delete' | 'suspend') => void,
): ColumnDef<UserWithRoles>[] {
    return [
        {
            accessorKey: 'name',
            header: 'Name',
            enableSorting: true,
            enableHiding: false,
        },
        {
            accessorKey: 'email',
            header: 'Email',
            enableSorting: false,
            enableHiding: true,
        },
        {
            accessorKey: 'roles',
            header: 'Roles',
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
            header: 'Status',
            accessorFn: (row) => (row.suspended_at ? 'Suspended' : 'Active'),
            enableSorting: true,
            enableHiding: false,
            cell: ({ row }) =>
                row.original.suspended_at ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>,
        },
        {
            accessorKey: 'created_at',
            header: 'Created at',
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
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {/* {can('user.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.users.show', { id: user.id })}>View</Link>
                                    </DropdownMenuItem>
                                )} */}
                                {can('user.update') && (
                                    <>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.users.edit', { id: user.id })}>Edit</Link>
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
                                                    {isSuspended ? 'Unsuspend' : 'Suspend'}
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
                                        Delete
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
