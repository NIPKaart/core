import { Button } from '@/components/ui/button';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import UserForm from '@/pages/backend/form-user';
import app from '@/routes/app';
import { BreadcrumbItem, Role, User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

type PageProps = {
    user: User;
    userRole: string;
    roles: Role[];
};

export default function Edit({ user, userRole, roles }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/users');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: app.users.index() },
        { title: t('breadcrumbs.edit', { name: user.name }), href: app.users.edit({ user: user.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.edit', { name: user.name })} />

            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">{t('head.edit', { name: user.name })}</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={app.users.index()}>
                        <ArrowLeft className="h-4 w-4" />
                        {tGlobal('common.back')}
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <UserForm
                    roles={roles}
                    action={app.users.update({ user: user.id }).url}
                    method="put"
                    initial={{ name: user.name, email: user.email, role: userRole }}
                    isEdit
                />
            </div>
        </AppLayout>
    );
}
