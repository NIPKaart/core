import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, Role } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Roles',
        href: route('app.roles.index'),
    },
];

type PageProps = {
    roles: PaginatedResponse<Role>;
};

export default function Index({ roles }: PageProps) {
    const { can } = useAuthorization();

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
            onSuccess: () => toast.success('Role deleted successfully'),
            onError: () => toast.error('Failed to delete role'),
        });
    };

    const columns: ColumnDef<Role>[] = [
        {
            accessorKey: 'name',
            header: 'Name',
            enableSorting: true,
        },
        {
            accessorKey: 'guard_name',
            header: 'Guard',
            enableSorting: false,
        },
        {
            accessorKey: 'created_at',
            header: 'Created at',
            enableSorting: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
            meta: { align: 'right' },
            cell: ({ row }) => {
                const role = row.original;

                return (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground data-[state=open]:bg-muted flex size-8 cursor-pointer"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {/* {can('role.view') && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={route('app.roles.show', { id: role.id })}>View</Link>
                                    </DropdownMenuItem>
                                )} */}
                                {can('role.update') && (
                                    <div>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.roles.edit', { id: role.id })}>Edit</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </div>
                                )}
                                {can('role.delete') && (
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            openDialog(role, 'delete');
                                        }}
                                        className="text-destructive cursor-pointer"
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                            <Button variant="outline" asChild>
                                <Link href={route('app.roles.create')}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Role
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
                    title="Delete role?"
                    description={`Are you sure you want to delete the role "${dialogRole.name}"?`}
                    confirmText="Delete"
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
