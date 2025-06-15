import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Role } from '@/types';
import { Link } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';

export function getRoleColumns(can: (permission: string) => boolean, openDialog: (role: Role, type: 'delete') => void): ColumnDef<Role>[] {
    return [
        {
            accessorKey: 'name',
            header: 'Name',
            enableSorting: true,
            enableHiding: false,
        },
        {
            accessorKey: 'guard_name',
            header: 'Guard',
            enableSorting: false,
            enableHiding: true,
        },
        {
            accessorKey: 'created_at',
            header: 'Created at',
            enableSorting: true,
            enableHiding: true,
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
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
                                    className="flex size-8 cursor-pointer text-muted-foreground data-[state=open]:bg-muted"
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
                                    <>
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={route('app.roles.edit', { id: role.id })}>Edit</Link>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {can('role.delete') && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                openDialog(role, 'delete');
                                            }}
                                            className="cursor-pointer text-destructive"
                                        >
                                            Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
