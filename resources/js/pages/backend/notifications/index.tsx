import Heading from '@/components/heading';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import notifications from '@/routes/notifications';
import type { BreadcrumbItem, NotificationItem, PaginatedResponse } from '@/types';
import { resolveTypeLabelBackend } from '@/utils/notifications';
import { Head, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getNotificationColumns } from './columns';

type PageProps = {
    notificationList: PaginatedResponse<NotificationItem>;
    filters: { read: string | null; type: string | null };
    options: { types: Record<string, string> };
};

export default function NotificationsIndex({ notificationList, filters, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/notifications');

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [selectedAction, setSelectedAction] = useState<string | ''>('');
    const [readFilter, setReadFilter] = useState<string[]>(filters.read ? filters.read.split(',') : []);
    const [typeFilter, setTypeFilter] = useState<string[]>(filters.type ? filters.type.split(',') : []);

    useEffect(() => {
        setSelectedAction('');
        setRowSelection({});
    }, [readFilter, typeFilter, notificationList.data]);

    const typeOptions = useMemo(
        () =>
            Object.keys(options.types).map((value) => {
                const label = resolveTypeLabelBackend(t, value);
                const isWildcard = value.endsWith('.*');
                const prefix = isWildcard ? value.slice(0, -2) + '.' : null;

                const count = notificationList.data.filter((n) => (isWildcard ? (n.type ?? '').startsWith(prefix!) : n.type === value)).length;

                return { value, label, count };
            }),
        [options.types, notificationList.data, t],
    );

    const readOptions = useMemo(
        () => [
            { value: 'unread', label: t('filters.unread'), count: notificationList.data.filter((n) => !n.read_at).length },
            { value: 'read', label: t('filters.read'), count: notificationList.data.filter((n) => !!n.read_at).length },
        ],
        [notificationList.data, t],
    );

    const updateFilters = (read: string[], type: string[]) => {
        const query: Record<string, string | null> = {};
        if (read.length > 0) query.read = read.join(',');
        if (type.length > 0) query.type = type.join(',');

        router.get(notifications.index(), query, { preserveScroll: true, preserveState: true });
    };

    const columns = getNotificationColumns({ t, tGlobal });

    const handleBulkAction = () => {
        const ids: string[] = notificationList.data.filter((_, index) => rowSelection[index]).map((n) => n.id);
        if (!selectedAction || ids.length === 0) return;

        router.patch(
            notifications.bulk(),
            { ids, action: selectedAction },
            {
                preserveState: true,
                onSuccess: () => {
                    setRowSelection({});
                    setSelectedAction('');
                    router.reload({ only: ['notifications'] });
                },
                onError: () => {
                    toast.error(t('toast.error'));
                },
            },
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: notifications.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <Heading title={t('head.title')} description={t('head.description')} />

                {Object.keys(rowSelection).length > 0 && (
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-muted/50">
                        <div className="relative flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{Object.keys(rowSelection).length}</span> {t('selected')}
                            </div>
                            <button
                                onClick={() => setRowSelection({})}
                                className="absolute top-0 right-0 cursor-pointer text-xs underline underline-offset-2 transition hover:text-foreground sm:static sm:ml-3 sm:text-sm sm:no-underline"
                            >
                                {t('bulk.clear')}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value)}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder={t('bulk.placeholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mark_read">{t('bulk.mark_read')}</SelectItem>
                                    <SelectItem value="mark_unread">{t('bulk.mark_unread')}</SelectItem>
                                    <SelectItem value="delete">{t('bulk.delete')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleBulkAction} disabled={!selectedAction} className="w-full cursor-pointer sm:w-auto">
                                {t('bulk.apply')}
                            </Button>
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={notificationList.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    filters={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <DataTableFacetFilter
                                title={t('filters.read_status')}
                                selected={readFilter}
                                options={readOptions}
                                onChange={(next) => {
                                    setReadFilter(next);
                                    updateFilters(next, typeFilter);
                                }}
                                onClear={() => {
                                    setReadFilter([]);
                                    updateFilters([], typeFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.type')}
                                selected={typeFilter}
                                options={typeOptions}
                                onChange={(next) => {
                                    setTypeFilter(next);
                                    updateFilters(readFilter, next);
                                }}
                                onClear={() => {
                                    setTypeFilter([]);
                                    updateFilters(readFilter, []);
                                }}
                            />
                        </div>
                    }
                />

                <DataTablePagination pagination={notificationList} />
            </div>
        </AppLayout>
    );
}
