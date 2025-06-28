export type ParkingSpaceDetail = {
    id: string;
    orientation: EnumOption | null;
    country: string | null;
    province: string | null;
    municipality: string | null;
    street: string | null;
    amenity?: string | null;
    description?: string | null;
    rule_url?: string | null;
    parking_time?: number | null;
    created_at: datetime;
    is_favorited?: boolean;
    confirmed_today?: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: datetime | null;
};

export type MunicipalParkingDetail = {
    id: string;
    orientation: EnumOption | null;
    country: string | null;
    province: string | null;
    municipality: string | null;
    street: string | null;
    rule_url?: string | null;
    updated_at: datetime;
    is_favorited?: boolean;
};

export type OffstreetParkingDetail = {
    id: string;
    name: string;
    type: 'garage' | 'parkandride';
    country: string | null;
    province: string | null;
    municipality: string | null;
    free_space_short: number;
    free_space_long: number | null;
    short_capacity: number;
    long_capacity: number | null;
    url: string | null;
    prices: json | null;
    api_state: string | null;
    updated_at: datetime;
    is_favorited?: boolean;
};

export type EnumOption = {
    value: string;
    label: string;
    description: string;
};
