import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import { BreadcrumbItem, PaginatedResponse, SharedData, User } from '@/types';
import { getUserColumns } from './columns';

type UserWithRoles = User & {
    roles: { id: number; name: string }[];
};

type PageProps = {
    users: PaginatedResponse<UserWithRoles>;
};

export default function Index({ users }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/users');
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const { can } = useAuthorization();

    const [dialogUser, setDialogUser] = useState<UserWithRoles | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | 'suspend' | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: app.users.index(),
        },
    ];

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
        router.delete(app.users.destroy(id), {
            onSuccess: () => toast.success(t('toast.deleted')),
            onError: () => toast.error(t('toast.delete_failed')),
        });
    };

    const toggleSuspend = (user: User) => {
        router.put(
            app.users.suspend({ id: user.id }),
            {
                suspended_at: user.suspended_at ? null : new Date().toISOString(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(user.suspended_at ? t('toast.unsuspended') : t('toast.suspended'));
                },
                onError: () => {
                    toast.error(t('toast.suspend_failed'));
                },
            },
        );
    };

    const columns = getUserColumns(can, auth.user, openDialog, { t, tGlobal });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="px-4 py-6 sm:px-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">{t('head.index')}</h1>
                        {can('user.create') && (
                            <Button variant="outline" asChild>
                                <Link href={app.users.create()}>
                                    <Plus className="h-4 w-4" />
                                    {t('buttons.add')}
                                </Link>
                            </Button>
                        )}
                    </div>
                    <p className="text-muted-foreground">{t('head.description')}</p>

                    <DataTable columns={columns} data={users.data} />
                    <DataTablePagination pagination={users} />
                </div>
            </div>

            {dialogUser && dialogType === 'delete' && (
                <ConfirmDialog
                    variant="destructive"
                    title={t('confirm.delete.title')}
                    description={t('confirm.delete.description', { name: dialogUser.name })}
                    confirmText={t('confirm.delete.confirm')}
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
                    title={dialogUser.suspended_at ? t('confirm.unsuspend.title') : t('confirm.suspend.title')}
                    description={
                        dialogUser.suspended_at
                            ? t('confirm.unsuspend.description', { name: dialogUser.name })
                            : t('confirm.suspend.description', { name: dialogUser.name })
                    }
                    confirmText={dialogUser.suspended_at ? t('confirm.unsuspend.confirm') : t('confirm.suspend.confirm')}
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
