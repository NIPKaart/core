import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '../ui/drawer';

interface ColumnsSelectorProps<TData> {
    table: Table<TData>;
    mobileBreakpoint?: number;
}

export function ColumnsSelector<TData>({ table, mobileBreakpoint = 768 }: ColumnsSelectorProps<TData>) {
    const { t } = useTranslation('backend/global');
    const isMobile = useMediaQuery(mobileBreakpoint);
    const columns = table.getAllLeafColumns().filter((col) => col.getCanHide());

    if (!columns.length) return null;

    if (isMobile) {
        // Mobile: Sheet (drawer)
        return (
            <Drawer>
                <DrawerTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <SlidersHorizontal className="h-4 w-4" />
                        {t('table.columns')}
                    </Button>
                </DrawerTrigger>
                <DrawerContent className="mx-auto max-w-md rounded-t-xl">
                    <DrawerHeader>
                        <DrawerTitle>{t('table.show_hide_columns')}</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-3 p-4 pb-0">
                        {columns.map((column) => (
                            <label
                                key={column.id}
                                htmlFor={`col-toggle-${column.id}`}
                                className="flex items-center gap-3 rounded px-2 py-2 transition hover:bg-muted"
                            >
                                <input
                                    id={`col-toggle-${column.id}`}
                                    type="checkbox"
                                    className="size-5 accent-primary"
                                    checked={column.getIsVisible()}
                                    onChange={() => column.toggleVisibility()}
                                />
                                <span className="text-base capitalize">
                                    {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                                </span>
                            </label>
                        ))}
                    </div>
                    <DrawerFooter className="mt-4 flex items-center border-t">
                        <DrawerClose asChild>
                            <Button variant="outline" className="w-full">
                                {t('common.close')}
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        );
    }

    // Desktop: DropdownMenu
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto cursor-pointer">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t('table.columns')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column.id}
                        className="cursor-pointer capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                        {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
