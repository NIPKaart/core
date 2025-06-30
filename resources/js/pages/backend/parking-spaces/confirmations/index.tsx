import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useConfirmationActionDialog } from '@/hooks/use-dialog-confirmation-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, ParkingSpaceConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConfirmationColumns } from './columns';

type PageProps = {
    confirmations: PaginatedResponse<ParkingSpaceConfirmation>;
    parkingSpace: { id: number; street: string; city: string; municipality: string };
    options: { confirmationStatuses: Record<string, string> };
};

export default function Index({ confirmations, parkingSpace, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/confirmations');
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useConfirmationActionDialog({ parkingSpaceId: parkingSpace.id });

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const selectedIds = confirmations.data.filter((_, index) => rowSelection[index]).map((confirmation) => String(confirmation.id));

    // Get the columns for the data table
    const columns = getConfirmationColumns(options.confirmationStatuses, can, openDialog, { t, tGlobal });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.spaces'), href: route('app.parking-spaces.index') },
        { title: t('breadcrumbs.show'), href: route('app.parking-spaces.show', { id: parkingSpace.id }) },
        { title: t('breadcrumbs.confirmations'), href: '' },
    ];

    useEffect(() => {
        setRowSelection({});
    }, [confirmations.data]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title', { id: parkingSpace.id })} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">{t('head.title', { id: parkingSpace.id })}</h1>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={route('app.parking-spaces.show', { id: parkingSpace.id })}>
                            <ArrowLeft className="h-4 w-4" />
                            {t('back')}
                        </Link>
                    </Button>
                </div>
                <p className="text-muted-foreground">{t('head.description')}</p>

                {/* Bulk delete toolbar */}
                {can('parking-space-confirmation.delete') && selectedIds.length > 0 && (
                    <div className="mb-4 flex flex-col gap-3 rounded-md border bg-muted/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-muted/50">
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{selectedIds.length}</span> {t('selected')}
                            <button
                                onClick={() => setRowSelection({})}
                                className="ml-4 cursor-pointer text-xs underline underline-offset-2 transition hover:text-foreground"
                            >
                                {t('bulk.clear')}
                            </button>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => openDialog('bulkDelete', { ids: selectedIds })}
                            className="w-full cursor-pointer sm:w-auto"
                        >
                            {t('table.actions.deleteSelected')}
                        </Button>
                    </div>
                )}

                <DataTable columns={columns} data={confirmations.data} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} />
                <DataTablePagination pagination={confirmations} />
                {dialogElement}
            </div>
        </AppLayout>
    );
}
