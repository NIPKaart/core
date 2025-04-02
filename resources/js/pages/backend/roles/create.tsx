import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import RoleForm, { FormValues } from '@/pages/backend/form-role';
import { BreadcrumbItem, Permission } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Create new Role',
        href: route('app.roles.create'),
    },
];

type PageProps = {
    allPermissions: Permission[];
};

export default function Create({ allPermissions }: PageProps) {
    const form = useForm<FormValues>({
        defaultValues: {
            name: '',
            permissions: [],
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        router.post(route('app.roles.store'), data, {
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
            <Head title="Create Role" />
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Create Role</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={route('app.roles.index')}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to roles
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <RoleForm form={form} allPermissions={allPermissions} onSubmit={handleSubmit} submitting={form.formState.isSubmitting} />
            </div>
        </AppLayout>
    );
}
