import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import RoleForm, { FormValues } from '@/pages/backend/form-role';
import { BreadcrumbItem, Permission, Role } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';

type PageProps = {
    role: Role;
    rolePermissions: number[];
    allPermissions: Permission[];
};

export default function Edit({ role, rolePermissions, allPermissions }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Roles',
            href: route('app.roles.index'),
        },
        {
            title: `Edit role (${role.name})`,
            href: route('app.roles.edit', { role: role.id }),
        },
    ];

    const form = useForm<FormValues>({
        defaultValues: {
            name: role.name,
            permissions: rolePermissions,
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        router.put(route('app.roles.update', { role: role.id }), data, {
            preserveScroll: true,
            onError: (errors) => {
                Object.entries(errors).forEach(([field, message]) => {
                    form.setError(field as keyof FormValues, {
                        type: 'server',
                        message: message as string,
                    });
                });
            },
        });
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${role.name}`} />
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Edit {role.name}</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={route('app.roles.index')}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <RoleForm form={form} role={role} allPermissions={allPermissions} onSubmit={handleSubmit} submitting={form.formState.isSubmitting} />
            </div>
        </AppLayout>
    );
}
