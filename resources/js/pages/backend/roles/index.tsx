import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, Role } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Pencil, Plus, Trash } from 'lucide-react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Roles',
        href: route('app.roles.index'),
    },
];

type PageProps = {
    roles: Role[];
};

export default function Index({ roles }: PageProps) {
    const { can } = useAuthorization();

    const deleteRole = (id: number) => {
        if (confirm('Are you sure you want to delete this role?')) {
            router.delete(route('app.roles.destroy', { role: id }), {
                onSuccess: () => toast.success('Role deleted successfully'),
            });
        }
    };

    const columns: ColumnDef<Role>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
        },
        {
            accessorKey: 'guard_name',
            header: 'Guard',
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => {
                return (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                        Created at
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => new Date(row.getValue('created_at')).toLocaleDateString(),
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const role = row.original;

                return (
                    <div className="flex justify-end gap-2">
                        {can('role.update') && (
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('app.roles.edit', { role: role.id })}>
                                    <Pencil className="mr-1 h-4 w-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {can('role.delete') && (
                            <Button variant="destructive" size="sm" onClick={() => deleteRole(role.id)}>
                                <Trash className="mr-1 h-4 w-4" />
                                Delete
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles" />
            <div className="px-4 py-6 sm:px-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Roles</h1>
                        {can('role.create') && (
                            <Button asChild>
                                <Link href={route('app.roles.create')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Role
                                </Link>
                            </Button>
                        )}
                    </div>

                    <DataTable columns={columns} data={roles} />
                </div>
            </div>
        </AppLayout>
    );
}
