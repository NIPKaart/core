import MunicipalNavigation from '@/components/municipal-navigation';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import parkingMunicipal from '@/routes/app/parking-municipal';
import type { BreadcrumbItem, Municipality, PaginatedResponse, ParkingMunicipal } from '@/types';
import { ParkingOrientation } from '@/types/enum';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
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

    const [orientationFilter, setOrientationFilter] = useState<string[]>(filters.orientation ? [filters.orientation] : []);
    const [visibilityFilter, setVisibilityFilter] = useState<string[]>(filters.visibility ? [filters.visibility] : []);

    const visibilityOptions = [
        { value: 'true', label: t('filters.options.true') },
        { value: 'false', label: t('filters.options.false') },
    ];

    const orientationOptions = [
        ...Object.entries(options.orientations).map(([value, label]) => ({
            value,
            label,
        })),
        { value: 'unknown', label: t('filters.options.unknown') },
    ];

    const columns = getParkingMunicipalColumns(can, options.orientations, { t, tGlobal });

    const updateFilters = (visibility: string[], orientation: string[]) => {
        const query: Record<string, string | null> = {};
        if (visibility.length > 0) query.visibility = visibility.join(',');
        if (orientation.length > 0) query.orientation = orientation.join(',');

        router.get(app.parkingMunicipal.municipality({ municipality: municipality.id }), query, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: parkingMunicipal.index() },
        { title: municipality.name, href: app.parkingMunicipal.municipality({ municipality: municipality.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.detail', { municipality: municipality.name })} />
            <div className="w-full px-4 py-6 sm:px-8 sm:py-8">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t('detail.title', { municipality: municipality.name })}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t('detail.description')} {municipality.name}.
                        </p>
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                            <Link href={app.parkingMunicipal.index()}>
                                <ArrowLeft className="h-4 w-4" />
                                {tGlobal('common.back')}
                            </Link>
                        </Button>
                    </div>
                </div>

                <MunicipalNavigation active="locations" />
                {/* Data Table */}
                <div className="space-y-6 pt-6">
                    <DataTable
                        initialState={{ columnVisibility: { id: false, province_name: false, updated_at: false } }}
                        columns={columns}
                        data={spaces.data}
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
            </div>
        </AppLayout>
    );
}
