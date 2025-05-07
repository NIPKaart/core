import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import UserForm, { FormValues } from '@/pages/backend/form-user';
import { BreadcrumbItem, Role } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: route('app.users.index'),
    },
    {
        title: 'Create new User',
        href: route('app.users.create'),
    },
];

type PageProps = {
    roles: Role[];
};

export default function Create({ roles }: PageProps) {
    const form = useForm<FormValues>({
        defaultValues: {
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
            role: '',
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        router.post(route('app.users.store'), data, {
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
            <Head title="Create User" />
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Create User</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={route('app.users.index')}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <UserForm form={form} roles={roles} onSubmit={handleSubmit} submitting={false} />
            </div>
        </AppLayout>
    );
}
