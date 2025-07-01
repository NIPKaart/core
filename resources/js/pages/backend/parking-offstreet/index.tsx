import OutdatedMunicipalitiesBanner from '@/components/alerts/outdated-municipalities';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { DataTable } from '@/components/tables/data-table';
import { DataTableFacetFilter } from '@/components/tables/data-table-facet-filter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, ParkingOffstreet } from '@/types';
import { Head, router } from '@inertiajs/react';
import { RowSelectionState } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getParkingOffstreetColumns } from './columns';

type Option = { id: number; name: string };
type PageProps = {
    spaces: PaginatedResponse<ParkingOffstreet>;
    filters: { country_id: string | null; province_id: string | null; municipality_id: string | null; visibility: string | null };
    options: { countries: Option[]; provinces: Option[]; municipalities: Option[] };
};

export default function Index({ spaces, filters, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking-offstreet');
    const { can } = useAuthorization();

    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [selectedVisibility, setSelectedVisibility] = useState<string | ''>('');
    const [countryFilter, setCountryFilter] = useState<string[]>(filters.country_id ? [filters.country_id] : []);
    const [provinceFilter, setProvinceFilter] = useState<string[]>(filters.province_id ? [filters.province_id] : []);
    const [municipalityFilter, setMunicipalityFilter] = useState<string[]>(filters.municipality_id ? [filters.municipality_id] : []);
    const [visibilityFilter, setVisibilityFilter] = useState<string[]>(filters.visibility ? [filters.visibility] : []);

    useEffect(() => {
        setSelectedVisibility('');
        setRowSelection({});
    }, [countryFilter, provinceFilter, municipalityFilter, visibilityFilter, spaces.data]);

    // Update filters based on selected options
    const countryOptions = options.countries
        .map((c) => ({
            value: String(c.id),
            label: c.name,
            count: spaces.data.filter((space) => String(space.country?.id) === String(c.id)).length,
        }))
        .filter((o) => o.count > 0);

    const provinceOptions = options.provinces
        .map((p) => ({
            value: String(p.id),
            label: p.name,
            count: spaces.data.filter((space) => String(space.province?.id) === String(p.id)).length,
        }))
        .filter((o) => o.count > 0);

    const municipalityOptions = options.municipalities
        .map((m) => ({
            value: String(m.id),
            label: m.name,
            count: spaces.data.filter((space) => String(space.municipality?.id) === String(m.id)).length,
        }))
        .filter((o) => o.count > 0);

    const visibilityOptions = [
        { value: 'true', label: t('filters.visible'), count: spaces.data.filter((s) => s.visibility).length },
        { value: 'false', label: t('filters.hidden'), count: spaces.data.filter((s) => !s.visibility).length },
    ];

    const updateFilters = (country: string[], province: string[], municipality: string[], visibility: string[]) => {
        const query: Record<string, string | null> = {};
        if (country.length > 0) query.country_id = country.join(',');
        if (province.length > 0) query.province_id = province.join(',');
        if (municipality.length > 0) query.municipality_id = municipality.join(',');
        if (visibility.length > 0) query.visibility = visibility.join(',');

        router.get(route('app.parking-offstreet.index'), query, {
            preserveState: true,
            replace: true,
        });
    };

    // Get the columns for the data table
    const columns = getParkingOffstreetColumns(can, { t, tGlobal });

    const handleBulkVisibility = () => {
        const ids: string[] = spaces.data.filter((_, index) => rowSelection[index]).map((space) => space.id);
        if (!selectedVisibility || ids.length === 0) return;

        router.patch(
            route('app.parking-offstreet.bulk.toggle-visibility'),
            {
                ids,
                visibility: selectedVisibility === 'visible',
            },
            {
                preserveState: true,
                onSuccess: () => {
                    setRowSelection({});
                    setSelectedVisibility('');
                    toast.success(t('bulk.success'));
                },
                onError: (errors) => {
                    if (errors.ids) {
                        toast.error(t('bulk.error.invalid'));
                    } else {
                        toast.error(t('bulk.error.generic'));
                    }
                },
            },
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('breadcrumbs.index'), href: route('app.parking-offstreet.index') }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.index')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">{t('head.index')}</h1>
                <p className="text-muted-foreground">{t('description')}</p>

                <OutdatedMunicipalitiesBanner spaces={spaces.data} minDaysOutdated={2} />

                {can('parking-offstreet.update') && Object.keys(rowSelection).length > 0 && (
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-muted/50">
                        <div className="relative flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{t('bulk.selected', { count: Object.keys(rowSelection).length })}</span>
                            </div>
                            <button
                                onClick={() => setRowSelection({})}
                                className="absolute top-0 right-0 cursor-pointer text-xs underline underline-offset-2 transition hover:text-foreground sm:static sm:ml-3 sm:text-sm sm:no-underline"
                            >
                                {tGlobal('common.clear')}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Select value={selectedVisibility} onValueChange={setSelectedVisibility}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder={t('bulk.select_visibility')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">{t('filters.visible')}</SelectItem>
                                    <SelectItem value="false">{t('filters.hidden')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleBulkVisibility} disabled={!selectedVisibility} className="w-full cursor-pointer sm:w-auto">
                                {tGlobal('common.update')}
                            </Button>
                        </div>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={spaces.data}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    filters={
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                            <DataTableFacetFilter
                                title={t('filters.country')}
                                selected={countryFilter}
                                options={countryOptions}
                                onChange={(selected) => {
                                    setCountryFilter(selected);
                                    updateFilters(selected, provinceFilter, municipalityFilter, visibilityFilter);
                                }}
                                onClear={() => {
                                    setCountryFilter([]);
                                    updateFilters([], provinceFilter, municipalityFilter, visibilityFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.province')}
                                selected={provinceFilter}
                                options={provinceOptions}
                                onChange={(selected) => {
                                    setProvinceFilter(selected);
                                    updateFilters(countryFilter, selected, municipalityFilter, visibilityFilter);
                                }}
                                onClear={() => {
                                    setProvinceFilter([]);
                                    updateFilters(countryFilter, [], municipalityFilter, visibilityFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.municipality')}
                                selected={municipalityFilter}
                                options={municipalityOptions}
                                onChange={(selected) => {
                                    setMunicipalityFilter(selected);
                                    updateFilters(countryFilter, provinceFilter, selected, visibilityFilter);
                                }}
                                onClear={() => {
                                    setMunicipalityFilter([]);
                                    updateFilters(countryFilter, provinceFilter, [], visibilityFilter);
                                }}
                            />
                            <DataTableFacetFilter
                                title={t('filters.visibility')}
                                selected={visibilityFilter}
                                options={visibilityOptions}
                                onChange={(selected) => {
                                    setVisibilityFilter(selected);
                                    updateFilters(countryFilter, provinceFilter, municipalityFilter, selected);
                                }}
                                onClear={() => {
                                    setVisibilityFilter([]);
                                    updateFilters(countryFilter, provinceFilter, municipalityFilter, []);
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
