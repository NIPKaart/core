import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, Role } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Pencil, Plus } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Roles',
        href: route('app.roles.index'),
    },
];

export default function Index({ roles }: { roles: Role[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles" />
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Roles</h1>
                    <Button asChild>
                        <Link href={route('app.roles.create')}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Role
                        </Link>
                    </Button>
                </div>

                <div className="rounded border bg-white shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Guard name</TableHead>
                                <TableHead>Created at</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {roles.map((role) => (
                                <TableRow key={role.id}>
                                    <TableCell>{role.name}</TableCell>
                                    <TableCell>{role.guard_name}</TableCell>
                                    <TableCell>{new Date(role.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="secondary" size="sm">
                                            <Link href={route('app.roles.edit', role.id)}>
                                                <Pencil className="mr-1 h-4 w-4" />
                                                Edit
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
