import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

type Translations = {
    t: TFunction;
    tGlobal: TFunction;
};

export interface NavGroup {
    title?: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    target?: string;
    badge?: string | number | JSX.Element;
    children?: NavItem[];
}

export interface SharedData {
    name: string;
    locale: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
    counts: {
        users: number;
        parkingSpaces: {
            active: number;
            trashed: number;
        };
        userParkingSpaces: {
            active: number;
        };
    };
    [key: string]: unknown;
}

export interface PaginatedResponse<T = Task | null> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface Country {
    id: number;
    name: string;
    code: string;
    created_at: string;
    updated_at: string;
}

export interface Province {
    id: number;
    country_id: number;
    name: string;
    geocode: string;
    created_at: string;
    updated_at: string;
}

export interface Municipality {
    id: number;
    name: string;
    country_id: number;
    province_id: number;
    created_at: string;
    updated_at: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    locale: string;
    avatar?: string;
    email_verified_at: string | null;
    suspended_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}

export interface Role {
    id: number;
    name: string;
    guard_name: string;
    created_at: string;
    updated_at: string;
}

export interface Permission {
    id: number;
    name: string;
    guard_name: string;
    created_at: string;
    updated_at: string;
}

export type ParkingRule = {
    id: number;
    country_id: number;
    municipality_id: number;
    url: string;
    nationwide: boolean;
    created_at: string;
    // Relations
    country?: Country;
    municipality?: Municipality;
};

export interface ParkingSpace {
    id: string;
    user_id: number | null;
    user?: User;

    status: ParkingStatus;
    ip_address: string | null;

    country_id: number;
    country?: Country;
    province_id: number;
    province?: Province;
    municipality_id: number;
    municipality?: Municipality;

    city: string;
    suburb: string | null;
    neighbourhood: string | null;
    postcode: string;
    street: string;
    amenity: string | null;

    longitude: float;
    latitude: float;

    parking_time: number | null;
    parking_hours?: number;
    parking_minutes?: number;
    orientation: ParkingOrientation;
    parking_disc: boolean;
    window_times: boolean;
    description: string | null;

    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export type ParkingMunicipal = {
    id: string;
    country_id: number;
    country: Country;
    province_id: number;
    province: Province;
    municipality_id: number;
    municipality: Municipality;
    street: string | null;
    number: number;
    orientation: string | null;
    longitude: float;
    latitude: float;
    visibility: boolean;
    created_at: string;
    updated_at: string;
};

export type ParkingOffstreet = {
    id: string;
    name: string;
    free_space_short: number;
    free_space_long: number | null;
    short_capacity: number;
    long_capacity: number | null;
    parking_type: 'garage' | 'parkandride';
    prices: json | null;
    api_state: string | null;
    visibility: boolean;

    country_id: number;
    country?: Country;
    province_id: number;
    province?: Province;
    municipality_id: number;
    municipality?: Municipality;

    longitude: float;
    latitude: float;

    created_at: string;
    updated_at: string;
};

export type NominatimAddress = {
    country_code: string;
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    road?: string;
    street?: string;
    postcode?: string;
    suburb?: string;
    hamlet?: string;
    neighbourhood?: string;
    quarter?: string;
    house_number?: string;
    'ISO3166-2-lvl4'?: string;
    'ISO3166-2-lvl6'?: string;
    [key: string]: unknown;
};

export type FavoriteType = 'Community' | 'Municipal' | 'Offstreet';

export type Favorite = {
    id: string | null;
    type: FavoriteType;
    title: string;
    latitude: float;
    longitude: float;
    municipality?: Municipality;
    country?: string;
    address?: string;
    city?: string;
};

export type ParkingSpaceConfirmation = {
    id: number;
    parking_space_id: string;
    status: string;
    user: { id: number; name: string; email: string } | null;
    comment: string | null;
    confirmed_at: string;
    created_at: string;
    updated_at: string;
};

export type NotificationItem = {
    id: string;
    type: string;
    data: {
        type: string;
        spot_id?: string;
        spot_label?: string;
        submitted_by?: number;
        url?: string;
    };
    read_at: string | null;
    created_at: string;
};
