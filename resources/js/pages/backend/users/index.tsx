import Heading from '@/components/heading';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import { BreadcrumbItem, PaginatedResponse, SharedData, User } from '@/types';
import { getUserColumns } from './columns';
import { SuspendDialog } from './suspend-dialog';

type UserWithRoles = User & {
    roles: { id: number; name: string }[];
    active_suspension: { reason: string; suspended_at: string } | null;
};

type FilterKey = 'role' | 'status' | 'verification' | 'login';

type PageProps = {
    users: PaginatedResponse<UserWithRoles>;
    filters: Record<FilterKey, string[]>;
    facets: Record<FilterKey, Record<string, number>>;
    roleOptions: { value: string; label: string }[];
};

export default function Index({ users, filters, facets, roleOptions }: PageProps) {
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

    const liftSuspension = (user: User) => {
        router.put(
            app.users.suspend({ id: user.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success(t('toast.unsuspended')),
                onError: () => toast.error(t('toast.suspend_failed')),
            },
        );
    };

    const closeDialog = () => {
        setDialogUser(null);
        setDialogType(null);
    };

    const columns = getUserColumns(can, auth.user, openDialog, { t, tGlobal });

    const applyFilter = (key: FilterKey, selected: string[]) => {
        const query: Record<string, string> = {};
        for (const [name, values] of Object.entries({ ...filters, [key]: selected })) {
            if (values.length > 0) query[name] = values.join(',');
        }

        router.get(app.users.index(), query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const facetFilters: { key: FilterKey; options: { value: string; label: string }[] }[] = [
        { key: 'role', options: [...roleOptions, { value: 'none', label: t('filters.role_none') }] },
        {
            key: 'status',
            options: [
                { value: 'active', label: t('table.active') },
                { value: 'suspended', label: t('table.suspended') },
            ],
        },
        {
            key: 'verification',
            options: [
                { value: 'verified', label: t('table.verified') },
                { value: 'unverified', label: t('table.unverified') },
            ],
        },
        {
            key: 'login',
            options: [
                { value: 'recent', label: t('filters.login_recent') },
                { value: 'none', label: t('table.never_logged_in') },
            ],
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="px-4 py-6 sm:px-8 sm:py-8">
                <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <Heading level={1} title={t('head.index')} description={t('head.description')} />
                        {can('user.create') && (
                            <Button variant="outline" asChild>
                                <Link href={app.users.create()}>
                                    <Plus className="h-4 w-4" />
                                    {t('buttons.add')}
                                </Link>
                            </Button>
                        )}
                    </div>

                    <DataTable
                        initialState={{ columnVisibility: { email_verified: false, created_at: false } }}
                        columns={columns}
                        data={users.data}
                        filters={
                            <div className="flex flex-wrap items-center gap-2">
                                {facetFilters.map(({ key, options }) => (
                                    <DataTableFacetFilter
                                        key={key}
                                        title={t(`filters.${key}`)}
                                        selected={filters[key]}
                                        options={options.map((option) => ({ ...option, count: facets[key][option.value] ?? 0 }))}
                                        onChange={(selected) => applyFilter(key, selected)}
                                        onClear={() => applyFilter(key, [])}
                                    />
                                ))}
                            </div>
                        }
                    />
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

            {dialogUser && dialogType === 'suspend' && !dialogUser.suspended_at && <SuspendDialog user={dialogUser} onClose={closeDialog} />}

            {dialogUser && dialogType === 'suspend' && dialogUser.suspended_at && (
                <ConfirmDialog
                    variant="default"
                    title={t('confirm.unsuspend.title')}
                    description={t('confirm.unsuspend.description', { name: dialogUser.name })}
                    confirmText={t('confirm.unsuspend.confirm')}
                    onConfirm={() => liftSuspension(dialogUser)}
                    onClose={closeDialog}
                />
            )}
        </AppLayout>
    );
}
