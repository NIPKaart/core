import Heading from '@/components/heading';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse, ParkingSpace } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { getParkingTrashColumns } from './columns';

type PageProps = {
    spaces: PaginatedResponse<ParkingSpace>;
};

export default function Index({ spaces }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/trash');
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
    const { openDialog, dialogElement } = useSpaceActionDialog();

    const selectedIds = spaces.data.filter((space) => rowSelection[space.id]).map((space) => space.id);
    const columns = getParkingTrashColumns(can, openDialog, { t, tGlobal });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: app.parkingSpaces.index() },
        { title: t('breadcrumbs.trash'), href: app.parkingSpaces.trash() },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <Heading title={t('head.title')} description={t('head.description')} />

                {selectedIds.length > 0 && (
                    <div className="mb-4 flex flex-col rounded-md border bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-muted/40">
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{selectedIds.length}</span> {t('selected')}
                        </div>

                        <div className="mt-2 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-3">
                            {can('parking-space.restore') && (
                                <Button variant="outline" className="cursor-pointer" onClick={() => openDialog('bulkRestore', { ids: selectedIds })}>
                                    {t('table.actions.restoreSelected')}
                                </Button>
                            )}
                            {can('parking-space.force-delete') && (
                                <Button
                                    variant="destructive"
                                    className="cursor-pointer"
                                    onClick={() => openDialog('bulkForceDelete', { ids: selectedIds })}
                                >
                                    {t('table.actions.deleteSelected')}
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={spaces.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    initialState={{
                        sorting: [{ id: 'deleted_at', desc: true }],
                    }}
                />
                <DataTablePagination pagination={spaces} />
                {dialogElement}
            </div>
        </AppLayout>
    );
}
