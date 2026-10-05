import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useConfirmationActionDialog } from '@/hooks/use-dialog-confirmation-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse, ParkingSpaceConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWhen } from '../parts';
import { CONFIRMATION_DOTS, getConfirmationColumns } from './columns';

type PageProps = {
    confirmations: PaginatedResponse<ParkingSpaceConfirmation>;
    parkingSpace: { id: string; street: string; city: string | null };
    outcomes: { total: number } & Record<string, number>;
    options: { confirmationStatuses: Record<string, string> };
};

/** What visitors reported on site about one parking space; staff remove only abuse or mistakes. */
export default function Index({ confirmations, parkingSpace, outcomes, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/confirmations');
    const { can } = useAuthorization();
    const when = useWhen();
    const { openDialog, dialogElement } = useConfirmationActionDialog({ parkingSpaceId: parkingSpace.id });

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const selectedIds = confirmations.data.filter((_, index) => rowSelection[index]).map((confirmation) => String(confirmation.id));

    useEffect(() => setRowSelection({}), [confirmations.data]);

    const columns = getConfirmationColumns({ statuses: options.confirmationStatuses, can, openDialog, when }, { t, tGlobal });
    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.spaces'), href: app.parkingSpaces.index() },
        { title: parkingSpace.street, href: app.parkingSpaces.show({ parking_space: parkingSpace.id }) },
        { title: t('breadcrumbs.confirmations'), href: app.parkingSpaces.confirmations.index({ parking_space: parkingSpace.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title', { street: parkingSpace.street })} />
            <div className="flex flex-col gap-6 px-4 py-6 pb-24 sm:px-8 sm:py-7 lg:px-10">
                <header className="space-y-1.5">
                    <Link
                        href={app.parkingSpaces.show({ parking_space: parkingSpace.id })}
                        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-3.5" aria-hidden />
                        {parkingSpace.street}
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('breadcrumbs.confirmations')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('head.description', { place: [parkingSpace.street, parkingSpace.city].filter(Boolean).join(', ') })}
                    </p>
                </header>

                <dl className="grid grid-cols-2 rounded-lg border sm:grid-cols-4">
                    <div className="px-5 py-3.5">
                        <dt className="text-sm text-muted-foreground">{t('total')}</dt>
                        <dd className="mt-0.5 text-[26px] leading-8 font-semibold tabular-nums">{outcomes.total}</dd>
                    </div>
                    {Object.entries(options.confirmationStatuses).map(([status, label], index) => (
                        <div
                            key={status}
                            className={cn('px-5 py-3.5', index % 2 === 0 && 'border-l', index > 0 && 'max-sm:border-t', index === 1 && 'sm:border-l')}
                        >
                            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <span className={cn('size-2 rounded-full', CONFIRMATION_DOTS[status])} aria-hidden />
                                {label}
                            </dt>
                            <dd className="mt-0.5 text-[26px] leading-8 font-semibold tabular-nums">{outcomes[status] ?? 0}</dd>
                        </div>
                    ))}
                </dl>

                <DataTable
                    columns={columns}
                    data={confirmations.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    toolbar={null}
                    emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>}
                />
                {confirmations.total > 0 && <DataTablePagination pagination={confirmations} />}
            </div>

            {can('parking-space-confirmation.delete') && selectedIds.length > 0 && (
                <div
                    role="region"
                    aria-label={t('selection')}
                    className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-fit items-center gap-3 rounded-xl bg-neutral-900 p-2 pl-4 text-neutral-50 shadow-xl dark:bg-neutral-800"
                >
                    <span className="text-sm font-medium whitespace-nowrap">{t('selected', { count: selectedIds.length })}</span>
                    <Button size="sm" variant="destructive" onClick={() => openDialog('bulkDelete', { ids: selectedIds })}>
                        {t('table.actions.deleteSelected')}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
                        aria-label={t('bulk.clear')}
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
