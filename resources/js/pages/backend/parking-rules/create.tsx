import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, Country } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import ParkingRuleForm, { FormValues } from '@/pages/backend/form-parking-rules';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Parking Rules',
        href: route('app.parking-rules.index'),
    },
    {
        title: 'Add new Parking Rule',
        href: route('app.parking-rules.create'),
    },
];

type PageProps = {
    countries: Country[];
    municipalities: string[];
};

export default function Create({ countries, municipalities }: PageProps) {
    const form = useForm<FormValues>({
        defaultValues: {
            country_id: '',
            municipality: '',
            url: '',
            nationwide: false,
        },
    });

    const handleSubmit = form.handleSubmit((data) => {
        router.post(route('app.parking-rules.store'), data, {
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
            <Head title="Create Parking Rule" />
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">Add Parking Rule</h1>

                <Button asChild variant="outline" className="inline-flex items-center gap-2">
                    <Link href={route('app.parking-rules.index')}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </Button>
            </div>

            <div className="px-4 py-6 sm:px-6">
                <ParkingRuleForm form={form} countries={countries} municipalities={municipalities} onSubmit={handleSubmit} submitting={false} />
            </div>
        </AppLayout>
    );
}
