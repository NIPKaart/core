import { occupancyPercent, occupancyStatus } from '@/components/map/parking-detail/utils';

/** One visible garage or P+R as the overview receives it; occupancy follows the detail's freshness rules. */
export type OverviewGarage = {
    id: string;
    name: string;
    type: 'garage' | 'parkandride' | null;
    latitude: number;
    longitude: number;
    availability: 'current' | 'closed' | 'stale' | 'unavailable' | 'unknown';
    occupancy_status: 'counting' | 'open' | 'full' | null;
    observed_at: string | null;
    capacity: number | null;
    free_space: number | null;
};

export type OverviewMunicipality = { name: string; garages: OverviewGarage[] };

/** What a garage card shows: a status key, its tone and, only for a current count, the general occupancy bar. */
export type GarageLiveState = {
    status: 'free' | 'full' | 'open' | 'closed' | 'stale' | 'unavailable' | 'unknown';
    tone: 'green' | 'red' | 'zinc';
    free: number | null;
    total: number | null;
    percent: number | null;
    bar: 'green' | 'orange' | 'red' | null;
};

/**
 * The card state of one garage. Counts appear only for a current measurement; closed, stale and missing data are words,
 * never a zero, and a status without a count ("open") never becomes a number.
 */
export function garageLiveState(garage: OverviewGarage): GarageLiveState {
    const none = { free: null, total: null, percent: null, bar: null };
    if (garage.availability !== 'current') {
        return { status: garage.availability, tone: garage.availability === 'unavailable' ? 'red' : 'zinc', ...none };
    }
    if (garage.occupancy_status === 'full' || garage.free_space === 0) return { status: 'full', tone: 'red', ...none };
    if (garage.free_space === null) return { status: 'open', tone: 'green', ...none };

    return {
        status: 'free',
        tone: 'green',
        free: garage.free_space,
        total: garage.capacity,
        percent: occupancyPercent(garage.free_space, garage.capacity),
        bar: occupancyStatus(garage.free_space, garage.capacity),
    };
}

export type GarageTypeFilter = 'all' | 'garage' | 'parkandride';
export type GarageSort = 'name' | 'free';

/**
 * Applies the type filter, then the search: municipalities whose name matches keep all their garages; otherwise only
 * the garages whose name matches. Municipalities left without garages disappear.
 */
export function filterMunicipalities(
    municipalities: OverviewMunicipality[],
    query: string,
    type: GarageTypeFilter = 'all',
    locale?: string,
): OverviewMunicipality[] {
    const needle = query.trim().toLocaleLowerCase(locale);
    const matches = (value: string) => value.toLocaleLowerCase(locale).includes(needle);

    return municipalities
        .map((municipality) => {
            const garages = type === 'all' ? municipality.garages : municipality.garages.filter((garage) => garage.type === type);

            return { ...municipality, garages: !needle || matches(municipality.name) ? garages : garages.filter((garage) => matches(garage.name)) };
        })
        .filter((municipality) => municipality.garages.length > 0);
}

/**
 * `name` keeps the server's name order. `free` puts current counts first, most free spaces first; garages without a
 * current count follow in name order, so unknown never ranks as zero or as plenty.
 */
export function sortGarages(garages: OverviewGarage[], sort: GarageSort): OverviewGarage[] {
    if (sort === 'name') return garages;
    const free = (garage: OverviewGarage) => (garage.availability === 'current' ? garage.free_space : null);

    return garages
        .map((garage, index) => ({ garage, index, free: free(garage) }))
        .sort((a, b) => (a.free === null ? (b.free === null ? a.index - b.index : 1) : b.free === null ? -1 : b.free - a.free || a.index - b.index))
        .map(({ garage }) => garage);
}

export type OverviewSummary = {
    total: number;
    garages: number;
    parkandride: number;
    current: number;
    closed: number;
    withoutLiveData: number;
    /** Newest measurement of any facility, or null when none was ever measured. */
    latestObservedAt: string | null;
};

/** Counts for the type filter and the live summary; stale, failing and never-measured facilities are "without live data". */
export function overviewSummary(municipalities: OverviewMunicipality[]): OverviewSummary {
    const summary: OverviewSummary = { total: 0, garages: 0, parkandride: 0, current: 0, closed: 0, withoutLiveData: 0, latestObservedAt: null };
    for (const garage of municipalities.flatMap((municipality) => municipality.garages)) {
        summary.total++;
        if (garage.type === 'garage') summary.garages++;
        if (garage.type === 'parkandride') summary.parkandride++;
        if (garage.availability === 'current') summary.current++;
        else if (garage.availability === 'closed') summary.closed++;
        else summary.withoutLiveData++;
        if (garage.observed_at && (!summary.latestObservedAt || Date.parse(garage.observed_at) > Date.parse(summary.latestObservedAt))) {
            summary.latestObservedAt = garage.observed_at;
        }
    }

    return summary;
}
