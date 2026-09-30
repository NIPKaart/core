export type ParkingSpaceDetail = {
    id: string;
    latitude: number;
    longitude: number;
    orientation: EnumOption | null;
    country: string | null;
    province: string | null;
    municipality: string | null;
    street: string | null;
    amenity?: string | null;
    description?: string | null;
    rule_url?: string | null;
    parking_time?: number | null;
    under_sign?: EnumOption | null;
    under_sign_text?: string | null;
    restriction_days?: string[] | null;
    restriction_starts_at?: string | null;
    restriction_ends_at?: string | null;
    created_at: datetime;
    updated_at: datetime;
    is_favorited?: boolean;
    confirmed_today?: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: datetime | null;
    reported_by_you?: boolean;
};

export type MunicipalParkingDetail = {
    provenance: {
        name: string | null;
        attribution: string | null;
        url: string | null;
        terms_url: string | null;
        fetched_at: string | null;
        source_updated_at: string | null;
    };
    id: string;
    latitude: number;
    longitude: number;
    orientation: EnumOption | null;
    country: string | null;
    province: string | null;
    municipality: string | null;
    street: string | null;
    rule_url?: string | null;
    updated_at: datetime;
    is_favorited?: boolean;
    confirmed_today?: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: datetime | null;
    reported_by_you?: boolean;
};

export type OffstreetParkingDetail = {
    id: string;
    latitude: number;
    longitude: number;
    name: string;
    type: 'garage' | 'parkandride';
    country: string | null;
    province: string | null;
    municipality: string | null;
    availability: 'current' | 'closed' | 'stale' | 'unavailable' | 'unknown';
    /** Operator status of a current measurement: a live count, or open/full for sites without counts. */
    occupancy_status: 'counting' | 'open' | 'full' | null;
    observed_at: datetime | null;
    capacity: number | null;
    free_space: number | null;
    url: string | null;
    prices: json | null;
    updated_at: datetime;
    is_favorited?: boolean;
};

export type EnumOption = {
    value: string;
    label: string;
    description: string;
};
