export type AreaLink = { name: string; href: string };

export type AreaTotals = {
    spaces: number;
    garages: number;
    park_and_ride: number;
    verified: number;
    live_garages: number;
    live_park_and_ride: number;
    municipalities?: number;
    last_confirmed_at: string | null;
    observed_at: string | null;
};

export type AreaPreview = {
    bounds: { south: number; north: number; west: number; east: number };
    clusters: { latitude: number; longitude: number; count: number }[];
};

export type RuleLink = { url: string; host: string | null };

export type AreaPage = {
    level: 'country' | 'region' | 'municipality';
    name: string;
    indexable: boolean;
    totals: AreaTotals;
    map_url: string | null;
    preview: AreaPreview | null;
    canonical: string;
    breadcrumbs: { name: string; href: string | null }[];
};

export type CountryArea = AreaPage & {
    regions: (AreaLink & AreaCounts & { municipalities: number })[];
    municipalities: (AreaLink & { spaces: number })[];
    sources: { open_data: number; community: number; live: number };
    without_open_data: number;
    national_rule: RuleLink | null;
    countries: (AreaLink & { municipalities: number })[];
};

export type AreaCounts = {
    spaces: number;
    garages: number;
    park_and_ride: number;
    verified: number;
    live_garages: number;
    live_park_and_ride: number;
};

export type RegionArea = AreaPage & {
    country: AreaLink;
    municipalities: (AreaLink & AreaCounts & { municipal: boolean })[];
    live_municipalities: string[];
    municipal_rules: { name: string; url: string }[];
    national_rule: RuleLink | null;
    other_regions: (AreaLink & { spaces: number })[];
};

export type MunicipalityArea = AreaPage & {
    check_area: { country: string; municipality: string };
    country: AreaLink;
    region: AreaLink | null;
    rules: (RuleLink & { scope: 'municipality' | 'country'; name: string })[];
    sources: {
        municipal: { publisher: string; updated_at: string | null }[];
        community: boolean;
        observed_at: string | null;
        facilities: boolean;
    };
    neighbours: AreaLink[];
};
