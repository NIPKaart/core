import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { locationMap as mapPage } from '@/routes';
import app from '@/routes/app';
import locationMap from '@/routes/location-map';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { ParkingStatus } from '@/types/enum';
import { Head, Link, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { Map as MapIcon, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getParkingSpaceColumns, type SpaceRow } from './columns';
import { SignalBadges, StatusPill, useWhen } from './parts';
import { ParkingSpaceTabs, type SpaceCounts, type SpaceTab } from './tabs';

type Filters = { status: string | null; municipality_id: string | null; signal: string | null; search: string; sort: 'newest' | 'oldest' };
type PageProps = {
    spaces: PaginatedResponse<SpaceRow>;
    tabCounts: SpaceCounts;
    filters: Filters;
    options: {
        statuses: Record<ParkingStatus, string>;
        rejectionReasons: { value: string; label: string }[];
        municipalities: { id: number; name: string }[];
    };
};

const SIGNALS = ['nearby_municipal', 'reports', 'improvement'] as const;

/**
 * Community parking spaces as one list per status. A moderator finds a parking space by address, place or contributor,
 * sees on each row what asks for attention and acts on several at once from the selection bar.
 */
export default function Index({ spaces, tabCounts, filters, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/main');
    const { can } = useAuthorization();
    const when = useWhen();
    const { openDialog, dialogElement } = useSpaceActionDialog({ onSuccess: () => setRowSelection({}) });

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [rejectionReason, setRejectionReason] = useState('');
    const [search, setSearch] = useState(filters.search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => setRowSelection({}), [spaces.data]);

    const current: SpaceTab = filters.status && ['pending', 'approved', 'rejected'].includes(filters.status) ? (filters.status as SpaceTab) : 'all';
    const list = (value: string | null) => (value ? value.split(',') : []);

    /** Reload the list with one filter changed, keeping the others and starting at the first page. */
    const visit = (changes: Partial<Record<keyof Filters, string | null>>) => {
        const query = Object.fromEntries(
            Object.entries({ ...filters, ...changes }).filter(
                ([key, value]) => value !== null && value !== '' && !(key === 'sort' && value === 'newest'),
            ),
        );

        router.get(app.parkingSpaces.index(), query, { preserveScroll: true, preserveState: true, replace: true });
    };

    const onSearch = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => visit({ search: value.trim() }), 300);
    };

    const selectedIds = spaces.data.filter((_, index) => rowSelection[index]).map((space) => space.id);

    /** Reject several parking spaces at once, for example spam; approving happens one at a time in moderation. */
    const rejectSelected = () => {
        if (!rejectionReason || selectedIds.length === 0) return;

        router.patch(
            app.parkingSpaces.bulk.update(),
            { ids: selectedIds, status: 'rejected', rejection_reason: rejectionReason },
            {
                preserveState: true,
                onSuccess: () => {
                    setRowSelection({});
                    setRejectionReason('');
                    toast.success(t('toast.success'));
                },
                onError: (errors) => toast.error(errors.rejection_reason ? t('toast.error.rejection_reason') : t('toast.error.default')),
            },
        );
    };

    const columns = getParkingSpaceColumns({ can, openDialog, when, rejectionReasons: options.rejectionReasons }, { t, tGlobal });
    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: app.parkingSpaces.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />

            <div className="flex flex-col gap-6 px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:px-10">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{t('head.title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('index.description')}{' '}
                            <Link href={app.moderation.index()} className="underline underline-offset-4 hover:text-foreground">
                                {t('index.moderation')}
                            </Link>
                            .
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href={mapPage()}>
                                <MapIcon />
                                {t('index.view_map')}
                            </Link>
                        </Button>
                        <Button asChild className="bg-orange-700 text-white hover:bg-orange-600">
                            <Link href={locationMap.add()}>
                                <Plus />
                                {t('index.add')}
                            </Link>
                        </Button>
                    </div>
                </header>

                <ParkingSpaceTabs current={current} counts={tabCounts} />

                <div className="flex flex-wrap items-center gap-2">
                    <label className="relative w-full sm:w-96">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            type="search"
                            value={search}
                            onChange={(event) => onSearch(event.target.value)}
                            placeholder={t('index.search')}
                            aria-label={t('index.search')}
                            className="pl-9"
                        />
                    </label>
                    <DataTableFacetFilter
                        title={t('filters.municipality')}
                        selected={list(filters.municipality_id)}
                        options={options.municipalities.map((municipality) => ({ value: String(municipality.id), label: municipality.name }))}
                        onChange={(next) => visit({ municipality_id: next.join(',') })}
                        onClear={() => visit({ municipality_id: null })}
                    />
                    <DataTableFacetFilter
                        title={t('filters.signals')}
                        selected={list(filters.signal)}
                        options={SIGNALS.map((signal) => ({ value: signal, label: t(`filters.signal.${signal}`) }))}
                        onChange={(next) => visit({ signal: next.join(',') })}
                        onClear={() => visit({ signal: null })}
                    />
                    <Select value={filters.sort} onValueChange={(sort) => visit({ sort })}>
                        <SelectTrigger className="w-auto gap-1.5 sm:ml-auto" aria-label={t('index.sort.label')}>
                            <span className="text-muted-foreground">{t('index.sort.label')}:</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="newest">{t('index.sort.newest')}</SelectItem>
                            <SelectItem value="oldest">{t('index.sort.oldest')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="hidden md:block">
                    <DataTable
                        columns={columns}
                        data={spaces.data}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        toolbar={null}
                        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t('index.empty')}</p>}
                    />
                </div>

                <ul className="border-t md:hidden">
                    {spaces.data.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">{t('index.empty')}</li>}
                    {spaces.data.map((space) => (
                        <li key={space.id} className="border-b">
                            <Link href={app.parkingSpaces.show({ parking_space: space.id })} className="flex flex-col gap-1.5 py-3.5">
                                <span className="flex items-baseline justify-between gap-3">
                                    <span className="font-medium">{space.street}</span>
                                    <span className="shrink-0 text-[13px] text-muted-foreground">{when(space.created_at)}</span>
                                </span>
                                <span className="text-[13px] text-muted-foreground">
                                    {[
                                        space.municipality?.name,
                                        space.user?.name,
                                        space.confirmations_count > 0 && t('index.confirmed', { count: space.confirmations_count }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                                <span className="flex flex-wrap gap-1.5">
                                    <StatusPill status={space.status} />
                                    <SignalBadges
                                        nearbyMunicipalMetres={space.nearby_municipal_metres}
                                        openReports={space.open_reports_count}
                                        openImprovements={space.open_improvements_count}
                                    />
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>

                <DataTablePagination pagination={spaces} />
            </div>

            {selectedIds.length > 0 && (
                <div
                    role="region"
                    aria-label={t('index.selection.label')}
                    className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-fit flex-wrap items-center gap-2 rounded-xl bg-neutral-900 p-2 pl-4 text-neutral-50 shadow-xl sm:gap-3 dark:bg-neutral-800"
                >
                    <span className="text-sm font-medium whitespace-nowrap">{t('index.selection.count', { count: selectedIds.length })}</span>
                    <span className="hidden h-5 w-px bg-neutral-700 sm:block" aria-hidden />
                    {can('parking-space.update') && (
                        <>
                            <Select value={rejectionReason} onValueChange={setRejectionReason}>
                                <SelectTrigger
                                    className="h-8 w-52 border-neutral-700 bg-neutral-800 text-neutral-50 data-placeholder:text-neutral-400"
                                    aria-label={t('edit.form.labels.rejectionReason')}
                                >
                                    <SelectValue placeholder={t('index.selection.reason')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {options.rejectionReasons.map(({ value, label }) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button size="sm" variant="destructive" disabled={!rejectionReason} onClick={rejectSelected}>
                                {t('bulk.reject', { count: selectedIds.length })}
                            </Button>
                        </>
                    )}
                    {can('parking-space.delete') && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-neutral-700 bg-transparent text-neutral-50 hover:bg-neutral-800 hover:text-neutral-50"
                            onClick={() => openDialog('bulkDelete', { ids: selectedIds })}
                        >
                            <Trash2 />
                            {t('index.move_to_trash')}
                        </Button>
                    )}
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
