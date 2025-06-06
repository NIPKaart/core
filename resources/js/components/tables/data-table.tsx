import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    Header,
    OnChangeFn,
    Row,
    RowSelectionState,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    filters?: React.ReactNode;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    initialState?: {
        sorting?: SortingState;
        globalFilter?: string;
    };
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filters,
    rowSelection,
    onRowSelectionChange,
    initialState,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>(initialState?.sorting ?? []);
    const [globalFilter, setGlobalFilter] = useState(initialState?.globalFilter ?? '');

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection: rowSelection ?? {},
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: true,
        globalFilterFn: customGlobalFilterFn,
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                    placeholder="Search..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="w-full sm:max-w-sm"
                />
                {filters && <div className="w-full sm:w-auto">{filters}</div>}
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted">
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
                        {table.getRowModel().rows.length ? (
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
            className={`flex items-center gap-1 text-sm font-medium text-muted-foreground ${
                isSortable ? 'cursor-pointer hover:text-foreground' : ''
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

function customGlobalFilterFn<TData>(row: Row<TData>, _columnId: string, filterValue: string) {
    const search = filterValue.toLowerCase();

    return row.getAllCells().some((cell) => {
        const value = cell.getValue();

        if (typeof value === 'string' || typeof value === 'number') {
            return String(value).toLowerCase().includes(search);
        }

        if (typeof value === 'object' && value !== null) {
            return Object.values(value)
                .filter((v) => typeof v === 'string')
                .some((v) => v.toLowerCase().includes(search));
        }

        return false;
    });
}
