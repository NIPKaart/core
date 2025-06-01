export type LocationDetail = {
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
    is_favorited: boolean;
    confirmed_today: boolean;
    confirmations_count?: {
        confirmed: number;
    };
    last_confirmed_at?: string | null;
};

export type ParkingSpaceModalProps = {
    spaceId: string | null;
    open: boolean;
    onClose: () => void;
    latitude: number | null;
    longitude: number | null;
    confirmationStatusOptions: Record<string, string>;
};
