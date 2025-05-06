import { Head, Link, router, usePage } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, SharedData, User } from '@/types';
import { DataTablePagination } from '@/components/tables/data-paginate';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: route('app.users.index'),
    },
];

type UserWithRoles = User & {
    roles: { id: number; name: string }[];
};

type PageProps = {
    users: PaginatedResponse<UserWithRoles>;
};

export default function Index({ users }: PageProps) {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const { can } = useAuthorization();

    const [dialogUser, setDialogUser] = useState<UserWithRoles | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | 'suspend' | null>(null);

    const openDialog = (user: UserWithRoles, type: 'delete' | 'suspend') => {
        // Force rerender in case of same user
        setDialogUser(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogUser(user);
            setDialogType(type);
        }, 0);
    };

    const deleteUser = (id: number) => {
        router.delete(route('app.users.destroy', { id }), {
            onSuccess: () => toast.success('User deleted successfully'),
            onError: () => toast.error('Failed to delete user'),
        });
    };

    const toggleSuspend = (user: User) => {
        router.put(
            route('app.users.suspend', { id: user.id }),
            {
                suspended_at: user.suspended_at ? null : new Date().toISOString(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(user.suspended_at ? 'User is unsuspended' : 'User is suspended');
                },
                onError: () => {
                    toast.error('Failed to update suspension status');
                },
            },
        );
    };

    const columns: ColumnDef<UserWithRoles>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => (
                <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Name
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
            ),
            enableSorting: true,
        },
        {
            accessorKey: 'email',
            header: 'Email',
        },
        {
            accessorKey: 'roles',
            header: 'Roles',
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
            header: ({ column }) => (
                <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Status
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => (row.suspended_at ? 'Suspended' : 'Active'),
            cell: ({ row }) =>
                row.original.suspended_at ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>,
            enableSorting: true,
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                    Created at
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue('created_at')).toLocaleDateString(),
            enableSorting: true,
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const user = row.original;
                const isSelf = user.id === auth.user?.id;
                const isSuspended = !!user.suspended_at;

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
                                        className="text-destructive cursor-pointer"
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="px-4 py-6 sm:px-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Users</h1>
                        {can('user.create') && (
                            <Button variant="outline" asChild>
                                <Link href={route('app.users.create')}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    User
                                </Link>
                            </Button>
                        )}
                    </div>

                    <DataTable columns={columns} data={users.data} />
                    <DataTablePagination pagination={users} />
                </div>
            </div>

            {dialogUser && dialogType === 'delete' && (
                <ConfirmDialog
                    variant="destructive"
                    title="Delete user?"
                    description={`Are you sure you want to delete: ${dialogUser.name}?`}
                    confirmText="Delete"
                    onConfirm={() => {
                        deleteUser(dialogUser.id);
                    }}
                    onClose={() => {
                        setDialogUser(null);
                        setDialogType(null);
                    }}
                />
            )}

            {dialogUser && dialogType === 'suspend' && (
                <ConfirmDialog
                    variant="default"
                    title={dialogUser.suspended_at ? 'Unsuspend user' : 'Suspend user'}
                    description={`Are you sure you want to ${dialogUser.suspended_at ? 'unsuspend' : 'suspend'}: ${dialogUser.name}?`}
                    confirmText={dialogUser.suspended_at ? 'Unsuspend' : 'Suspend'}
                    onConfirm={() => {
                        toggleSuspend(dialogUser);
                    }}
                    onClose={() => {
                        setDialogUser(null);
                        setDialogType(null);
                    }}
                />
            )}
        </AppLayout>
    );
}
