import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, Role } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getRoleColumns } from './columns';

type PageProps = {
    roles: PaginatedResponse<Role>;
};

export default function Index({ roles }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('roles');
    const { can } = useAuthorization();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: route('app.roles.index'),
        },
    ];

    const [dialogRole, setDialogRole] = useState<Role | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | null>(null);

    const openDialog = (role: Role, type: 'delete') => {
        setDialogRole(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogRole(role);
            setDialogType(type);
        }, 0);
    };

    const deleteRole = (id: number) => {
        router.delete(route('app.roles.destroy', { id }), {
            onSuccess: () => toast.success(t('toasts.deleted')),
            onError: () => toast.error(t('toasts.error')),
        });
    };

    const columns = getRoleColumns(can, openDialog, { t, tGlobal });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="px-4 py-6 sm:px-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">{t('head.title')}</h1>
                        {can('role.create') && (
                            <Button variant="outline" asChild>
                                <Link href={route('app.roles.create')}>
                                    <Plus className="h-4 w-4" />
                                    {t('buttons.add')}
                                </Link>
                            </Button>
                        )}
                    </div>

                    <DataTable columns={columns} data={roles.data} />
                    <DataTablePagination pagination={roles} />
                </div>
            </div>

            {dialogRole && dialogType === 'delete' && (
                <ConfirmDialog
                    title={t('confirm.delete_title')}
                    description={t('confirm.delete_description', {
                        name: dialogRole.name,
                    })}
                    confirmText={t('confirm.delete')}
                    variant="destructive"
                    onConfirm={() => {
                        deleteRole(dialogRole.id);
                    }}
                    onClose={() => {
                        setDialogRole(null);
                        setDialogType(null);
                    }}
                />
            )}
        </AppLayout>
    );
}
