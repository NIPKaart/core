import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

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
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    sidebarOpen: boolean;
    counts: {
        users: number;
        parkingSpots: {
            active: number;
            trashed: number;
        }
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

export interface User {
    id: number;
    name: string;
    email: string;
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
    municipality: string;
    url: string;
    nationwide: boolean;
    created_at: string;
    country?: {
        id: number;
        name: string;
        code: string;
    };
};

export interface ParkingSpot {
    id: string;
    user_id: number | null;
    user?: User;

    status: ParkingStatus;
    ip_address: string | null;

    country_id: number;
    country: Country;
    province_id: number;
    province: Province;

    municipality: string;
    city: string;
    suburb: string | null;
    neighbourhood: string | null;
    postcode: string;
    street: string;
    amenity: string | null;

    longitude: number;
    latitude: number;

    parking_time: number | null;
    orientation: ParkingOrientation;
    parking_disc: boolean;
    window_times: boolean;
    description: string | null;

    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

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
