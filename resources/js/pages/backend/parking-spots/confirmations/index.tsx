import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useConfirmationActionDialog } from '@/hooks/use-dialog-confirmation-action';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, ParkingSpotConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConfirmationColumns } from './columns';

type PageProps = {
    confirmations: PaginatedResponse<ParkingSpotConfirmation>;
    parkingSpot: { id: number; street: string; city: string; municipality: string };
    statuses: Record<string, string>;
};

export default function Index({ confirmations, parkingSpot, statuses }: PageProps) {
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useConfirmationActionDialog({ parkingSpotId: parkingSpot.id });

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const selectedIds = confirmations.data.filter((_, index) => rowSelection[index]).map((confirmation) => String(confirmation.id));

    // Get the columns for the data table
    const columns = getConfirmationColumns(statuses, can, openDialog);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Parking Spots', href: route('app.parking-spots.index') },
        { title: 'Show', href: route('app.parking-spots.show', { id: parkingSpot.id }) },
        { title: 'Confirmations', href: route('app.parking-spots.confirmations.index', { id: ':id' }) },
    ];

    useEffect(() => {
        setRowSelection({});
    }, [confirmations.data]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parking Spot Confirmations" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Confirmations for {parkingSpot.id}</h1>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={route('app.parking-spots.show', { id: parkingSpot.id })}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to parking spot
                        </Link>
                    </Button>
                </div>

                {/* Bulk delete toolbar */}
                {can('parking-spot-confirmation.delete') && selectedIds.length > 0 && (
                    <div className="bg-muted/70 dark:border-muted/50 mb-4 flex flex-col gap-3 rounded-md border p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground text-sm">
                            <span className="text-foreground font-medium">{selectedIds.length}</span> selected
                            <button
                                onClick={() => setRowSelection({})}
                                className="hover:text-foreground ml-4 cursor-pointer text-xs underline underline-offset-2 transition"
                            >
                                Clear
                            </button>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => openDialog('bulkDelete', { ids: selectedIds })}
                            className="w-full cursor-pointer sm:w-auto"
                        >
                            Delete selected
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
