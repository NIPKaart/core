import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, SharedData, User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';

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
    users: UserWithRoles[];
};

export default function Index({ users }: PageProps) {
    const page = usePage<SharedData>();
    const { can } = useAuthorization();
    const { auth } = page.props;

    const deleteUser = (id: number) => {
        if (confirm('Are you sure you want to delete this user?')) {
            router.delete(route('app.users.destroy', { id }));
            toast.success('User deleted successfully');
        }
    };

    const columns: ColumnDef<UserWithRoles>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => {
                return (
                    <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            enableSorting: true,
        },
        {
            accessorKey: 'email',
            header: 'Email',
        },
        {
            accessorKey: 'roles',
            header: 'Roles',
            cell: ({ row }) => {
                const roles = row.original.roles;

                return (
                    <div className="flex flex-wrap gap-1">
                        {roles.map((role) => (
                            <Badge key={typeof role === 'string' ? role : role.name} variant="outline" className="capitalize">
                                {typeof role === 'string' ? role : role.name}
                            </Badge>
                        ))}
                    </div>
                );
            },
        },
        {
            id: 'status',
            header: ({ column }) => {
                return (
                    <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            accessorFn: (row) => (row.suspended_at ? 'Suspended' : 'Active'),
            cell: ({ row }) => {
                return row.original.suspended_at ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>;
            },
            enableSorting: true,
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => {
                return (
                    <Button className="cursor-pointer" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Created at
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => new Date(row.getValue('created_at')).toLocaleDateString(),
            enableSorting: true,
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const user = row.original;

                const isSelf = user.id === auth.user?.id;
                const isSuspended = !!user.suspended_at;

                const handleSuspendToggle = () => {
                    if (isSelf) {
                        toast.error("You can't suspend yourself");
                        return;
                    }

                    const confirmed = confirm(isSuspended ? 'Unsuspend this user?' : 'Suspend this user?');
                    if (!confirmed) return;

                    router.put(
                        route('app.users.suspend', { id: user.id }),
                        {
                            suspended_at: isSuspended ? null : new Date().toISOString(),
                        },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                toast.success(isSuspended ? 'User unsuspended' : 'User suspended');
                            },
                            onError: () => {
                                // console.error('Error updating suspension:', errors);
                                toast.error('Failed to update suspension status');
                            },
                        },
                    );
                };

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
                                {can('user.update') && (
                                    <div>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.users.edit', { id: user.id })}>Edit</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {!isSelf && (
                                            <DropdownMenuItem className="cursor-pointer" onClick={handleSuspendToggle}>
                                                {isSuspended ? 'Unsuspend' : 'Suspend'}
                                            </DropdownMenuItem>
                                        )}
                                    </div>
                                )}
                                {can('user.delete') && (
                                    <DropdownMenuItem onClick={() => deleteUser(user.id)} className="text-destructive cursor-pointer">
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
                                    <Plus className="mr-2 h-4 w-4" />
                                    New User
                                </Link>
                            </Button>
                        )}
                    </div>

                    <DataTable columns={columns} data={users} />
                </div>
            </div>
        </AppLayout>
    );
}
