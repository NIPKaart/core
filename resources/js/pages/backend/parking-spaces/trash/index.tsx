import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { Info, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWhen } from '../parts';
import { ParkingSpaceTabs, type SpaceCounts } from '../tabs';
import { getParkingTrashColumns, type TrashedSpace } from './columns';

type PageProps = {
    spaces: PaginatedResponse<TrashedSpace>;
    tabCounts: SpaceCounts;
    options: { rejectionReasons: { value: string; label: string }[] };
};

/** Parking spaces in the trash: off the map until someone restores them or deletes them for good. */
export default function Index({ spaces, tabCounts, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/trash');
    const { t: tMain } = useTranslation('backend/parking/main');
    const { can } = useAuthorization();
    const when = useWhen();
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const { openDialog, dialogElement } = useSpaceActionDialog({ onSuccess: () => setRowSelection({}) });

    useEffect(() => setRowSelection({}), [spaces.data]);

    const selectedIds = spaces.data.filter((_, index) => rowSelection[index]).map((space) => space.id);
    const columns = getParkingTrashColumns({ can, openDialog, when, rejectionReasons: options.rejectionReasons }, { t, tGlobal });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: tMain('breadcrumbs.index'), href: app.parkingSpaces.index() },
        { title: t('breadcrumbs.trash'), href: app.parkingSpaces.trash() },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="flex flex-col gap-6 px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:px-10">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{tMain('head.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('head.description')}</p>
                </header>

                <ParkingSpaceTabs current="trash" counts={tabCounts} />

                <p className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Info className="size-4 shrink-0" aria-hidden />
                    {t('notice')}
                </p>

                <DataTable
                    columns={columns}
                    data={spaces.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    toolbar={null}
                    emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>}
                />
                {spaces.total > 0 && <DataTablePagination pagination={spaces} />}
            </div>

            {selectedIds.length > 0 && (
                <div
                    role="region"
                    aria-label={tMain('index.selection.label')}
                    className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-fit flex-wrap items-center gap-2 rounded-xl bg-neutral-900 p-2 pl-4 text-neutral-50 shadow-xl sm:gap-3 dark:bg-neutral-800"
                >
                    <span className="text-sm font-medium whitespace-nowrap">{tMain('index.selection.count', { count: selectedIds.length })}</span>
                    <span className="hidden h-5 w-px bg-neutral-700 sm:block" aria-hidden />
                    {can('parking-space.restore') && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-neutral-700 bg-transparent text-neutral-50 hover:bg-neutral-800 hover:text-neutral-50"
                            onClick={() => openDialog('bulkRestore', { ids: selectedIds })}
                        >
                            <RotateCcw />
                            {t('table.actions.restoreSelected')}
                        </Button>
                    )}
                    {can('parking-space.force-delete') && (
                        <Button size="sm" variant="destructive" onClick={() => openDialog('bulkForceDelete', { ids: selectedIds })}>
                            {t('table.actions.deleteSelected')}
                        </Button>
                    )}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
                        aria-label={tMain('bulk.clear')}
                        onClick={() => setRowSelection({})}
                    >
                        <X />
                    </Button>
                </div>
            )}
            {dialogElement}
        </AppLayout>
    );
}
