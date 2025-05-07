import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, Header, SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
}

export function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} colSpan={header.colSpan}>
                                        {header.isPlaceholder ? null : <TableHeadWrapper header={header} />}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className={getCellAlignment(cell.column.columnDef.meta)}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function TableHeadWrapper<TData, TValue>({ header }: { header: Header<TData, TValue> }) {
    const isSortable = header.column.getCanSort();
    const isSorted = header.column.getIsSorted();
    const alignment = getAlignment(header.column.columnDef.meta);

    return (
        <div
            onClick={isSortable ? () => header.column.toggleSorting(isSorted === 'asc') : undefined}
            className={`text-muted-foreground flex items-center gap-1 text-sm font-medium ${
                isSortable ? 'hover:text-foreground cursor-pointer' : ''
            } ${alignment}`}
        >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {isSortable &&
                (isSorted === 'asc' ? (
                    <ArrowUp className="h-4 w-4" />
                ) : isSorted === 'desc' ? (
                    <ArrowDown className="h-4 w-4" />
                ) : (
                    <ArrowUpDown className="h-4 w-4" />
                ))}
        </div>
    );
}

// Helpers for alignment
function getAlignment(meta?: { align?: 'left' | 'center' | 'right' }) {
    switch (meta?.align) {
        case 'center':
            return 'justify-center text-center';
        case 'right':
            return 'justify-end text-right';
        default:
            return 'justify-start text-left';
    }
}

function getCellAlignment(meta?: { align?: 'left' | 'center' | 'right' }) {
    switch (meta?.align) {
        case 'center':
            return 'text-center';
        case 'right':
            return 'text-right';
        default:
            return 'text-left';
    }
}
