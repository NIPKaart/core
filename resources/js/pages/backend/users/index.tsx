import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, SharedData, User } from '@/types';
import { getUserColumns } from './columns';

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

    const columns = getUserColumns(can, auth.user, openDialog);

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
