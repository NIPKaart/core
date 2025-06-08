export type ParkingSpaceDetail = {
    id: string;
    orientation: string | null;
    municipality: string | null;
    province: string | null;
    country: string | null;
    street: string | null;
    amenity?: string | null;
    description?: string | null;
    rule_url?: string | null;
    parking_time?: number | null;
    created_at: string;
    is_favorited?: boolean;
    confirmed_today?: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: string | null;
};

export type MunicipalParkingDetail = {
    id: string;
    orientation: string | null;
    municipality: string | null;
    province: string | null;
    country: string | null;
    street: string | null;
    rule_url?: string | null;
    updated_at: string;
    is_favorited?: boolean;
};
