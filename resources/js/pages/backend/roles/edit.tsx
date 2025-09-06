import { Button } from '@/components/ui/button';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import RoleForm from '@/pages/backend/form-role';
import app from '@/routes/app';
import { BreadcrumbItem, Permission, Role } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

type PageProps = {
    role: Role;
    rolePermissions: number[];
    allPermissions: Permission[];
};

export default function Edit({ role, rolePermissions, allPermissions }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/roles');

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: app.roles.index(),
        },
        {
            title: t('breadcrumbs.edit', { name: role.name }),
            href: app.roles.edit({ role: role.id }),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.edit', { name: role.name })} />
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">{t('head.edit', { name: role.name })}</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={app.roles.index()}>
                        <ArrowLeft className="h-4 w-4" />
                        {tGlobal('common.back')}
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <RoleForm
                    role={role}
                    allPermissions={allPermissions}
                    action={app.roles.update({ role: role.id }).url}
                    method="put"
                    initial={{ name: role.name, permissions: rolePermissions }}
                />
            </div>
        </AppLayout>
    );
}
