import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, ParkingRule } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Parking Rules',
        href: route('app.parking-rules.index'),
    },
];

type PageProps = {
    parkingRules: PaginatedResponse<ParkingRule>;
};

export default function Index({ parkingRules }: PageProps) {
    const { can } = useAuthorization();

    const [dialogParkingRule, setDialogParkingRule] = useState<ParkingRule | null>(null);
    const [dialogType, setDialogType] = useState<'delete' | null>(null);

    const openDialog = (parkingRule: ParkingRule, type: 'delete') => {
        setDialogParkingRule(null);
        setDialogType(null);
        setTimeout(() => {
            setDialogParkingRule(parkingRule);
            setDialogType(type);
        }, 0);
    };

    const deleteParkingRule = (id: number) => {
        router.delete(route('app.parking-rules.destroy', { id }), {
            onSuccess: () => toast.success('Parking Rule deleted successfully'),
            onError: () => toast.error('Failed to delete parking rule'),
        });
    };

    const columns: ColumnDef<ParkingRule>[] = [
        {
            accessorKey: 'id',
            header: 'ID',
            meta: { align: 'center' },
            enableSorting: true,
        },
        {
            accessorKey: 'country',
            header: 'Country',
            meta: { align: 'left' },
            enableSorting: false,
            cell: ({ row }) => {
                const country = row.original.country;
                return `${country?.name} (${country?.code})`;
            },
        },
        {
            accessorKey: 'municipality',
            header: 'Municipality',
            meta: { align: 'left' },
            enableSorting: true,
        },
        {
            accessorKey: 'nationwide',
            header: 'Nationwide',
            meta: { align: 'left' },
            enableSorting: true,
            cell: ({ row }) => (row.original.nationwide ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>),
        },
        {
            accessorKey: 'url',
            header: 'URL',
            meta: { align: 'left' },
            enableSorting: false,
            cell: ({ row }) => (
                <a href={row.original.url} target="_blank" rel="noopener noreferrer" className="break-all underline">
                    {row.original.url}
                </a>
            ),
        },
        {
            accessorKey: 'created_at',
            header: 'Created at',
            meta: { align: 'left' },
            enableSorting: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            meta: { align: 'right' },
            cell: ({ row }) => {
                const parkingRule = row.original;

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
                                {can('parking-rule.update') && (
                                    <>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link
                                                href={route('app.parking-rules.edit', {
                                                    id: parkingRule.id,
                                                })}
                                            >
                                                Edit
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                {can('parking-rule.delete') && (
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            openDialog(parkingRule, 'delete');
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
            <Head title="Parking Rules" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Parking Rules</h1>
                    {can('parking-rule.create') && (
                        <Button variant="outline" asChild>
                            <Link href={route('app.parking-rules.create')}>
                                <Plus className="mr-1 h-4 w-4" />
                                Parking Rule
                            </Link>
                        </Button>
                    )}
                </div>

                <DataTable columns={columns} data={parkingRules.data} />
                <DataTablePagination pagination={parkingRules} />
            </div>

            {dialogParkingRule && dialogType === 'delete' && (
                <ConfirmDialog
                    title="Delete parking rule?"
                    description={`Are you sure you want to delete the rule for: ${dialogParkingRule.country?.name} (${dialogParkingRule.country?.code}), ${dialogParkingRule.municipality}?`}
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={() => {
                        deleteParkingRule(dialogParkingRule.id);
                    }}
                    onClose={() => {
                        setDialogParkingRule(null);
                        setDialogType(null);
                    }}
                />
            )}
        </AppLayout>
    );
}
