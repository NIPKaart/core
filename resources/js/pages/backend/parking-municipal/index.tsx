import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, Municipality, PaginatedResponse, ParkingMunicipal } from '@/types';
import { ParkingOrientation } from '@/types/enum';
import { Head, Link, router } from '@inertiajs/react';
import type { RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getParkingMunicipalColumns } from './columns';

type PageProps = {
    municipality: Municipality;
    spaces: PaginatedResponse<ParkingMunicipal>;
    filters: { orientation: string | null; visibility: string | null };
    options: { orientations: Record<ParkingOrientation, string> };
};

export default function Index({ municipality, spaces, filters, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking-municipal');
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [orientationFilter, setOrientationFilter] = useState<string[]>(filters.orientation ? [filters.orientation] : []);
    const [visibilityFilter, setVisibilityFilter] = useState<string[]>(filters.visibility ? [filters.visibility] : []);

    useEffect(() => {
        setRowSelection({});
    }, [visibilityFilter, orientationFilter, spaces.data]);

    const orientationCounts = spaces.data.reduce(
        (acc, space) => {
            const key = space.orientation ?? 'unknown';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );

    const visibilityOptions = [
        { value: 'true', label: t('filters.options.true'), count: spaces.data.filter((s) => s.visibility).length },
        { value: 'false', label: t('filters.options.false'), count: spaces.data.filter((s) => !s.visibility).length },
    ];

    const orientationOptions = [
        ...Object.entries(options.orientations).map(([value, label]) => ({
            value,
            label,
            count: orientationCounts[value] ?? 0,
        })),
        { value: 'unknown', label: t('filters.options.unknown'), count: orientationCounts['unknown'] ?? 0 },
    ];

    const columns = getParkingMunicipalColumns(can, options.orientations, { t, tGlobal });

    const updateFilters = (visibility: string[], orientation: string[]) => {
        const query: Record<string, string | null> = {};
        if (visibility.length > 0) query.visibility = visibility.join(',');
        if (orientation.length > 0) query.orientation = orientation.join(',');

        router.get(route('app.parking-municipal.municipalities.index', { municipality: municipality.id }), query, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: route('app.parking-municipal.municipalities') },
        { title: municipality.name, href: route('app.parking-municipal.municipalities.index', { municipality: municipality.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.detail', { municipality: municipality.name })} />

            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('detail.title', { municipality: municipality.name })}</h1>
                    <p className="mt-2 text-muted-foreground">
                        {t('detail.description')} {municipality.name}.
                    </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={route('app.parking-municipal.municipalities')}>
                            <ArrowLeft className="h-4 w-4" />
                            {tGlobal('common.back')}
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <DataTable
                    columns={columns}
                    data={spaces.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    filters={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <DataTableFacetFilter
                                title={t('filters.visibility')}
                                selected={visibilityFilter}
                                options={visibilityOptions}
                                onChange={(next) => {
                                    setVisibilityFilter(next);
                                    updateFilters(next, orientationFilter);
                                }}
                                onClear={() => {
                                    setVisibilityFilter([]);
                                    updateFilters([], orientationFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.orientation')}
                                selected={orientationFilter}
                                options={orientationOptions}
                                onChange={(next) => {
                                    setOrientationFilter(next);
                                    updateFilters(visibilityFilter, next);
                                }}
                                onClear={() => {
                                    setOrientationFilter([]);
                                    updateFilters(visibilityFilter, []);
                                }}
                            />
                        </div>
                    }
                />
                <DataTablePagination pagination={spaces} />
            </div>
        </AppLayout>
    );
}
