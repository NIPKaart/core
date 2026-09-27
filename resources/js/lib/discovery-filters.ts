import type { DestinationResult } from '@/types/destination';

export const defaultDiscoveryFilters = { source: 'all', radius: 1000, sort: 'balanced' } as const;
export type DiscoveryFilters = { source: 'all' | 'community' | 'municipal' | 'offstreet'; radius: number; sort: 'balanced' | 'distance' };

export function readDiscoveryFilters(params: URLSearchParams): DiscoveryFilters {
    const source = params.get('source');
    const radius = Number(params.get('radius'));
    return {
        source: source === 'community' || source === 'municipal' || source === 'offstreet' ? source : 'all',
        radius: [250, 500, 1000, 2000, 5000, 10000].includes(radius) ? radius : 1000,
        sort: params.get('sort') === 'distance' ? 'distance' : 'balanced',
    };
}

export function discoveryFilterUrl(url: URL, filters: DiscoveryFilters): string {
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, String(value));
    return url.pathname + url.search + url.hash;
}

export function discoveryDestinationUrl(url: URL, destination: DestinationResult): string {
    url.searchParams.set('destination', destination.label);
    url.searchParams.set('destination_type', destination.type ?? 'destination');
    url.searchParams.set('lat', String(destination.latitude));
    url.searchParams.set('lng', String(destination.longitude));
    url.searchParams.delete('view');
    for (const key of ['south', 'north', 'west', 'east'] as const) {
        url.searchParams.delete(key);
        if (destination.bounds) url.searchParams.set(key, String(destination.bounds[key]));
    }
    return url.pathname + url.search;
}

export function isApproximateDestination(destination: Pick<DestinationResult, 'type'>): boolean {
    return !['address', 'building', 'amenity', 'house', 'poi', 'community', 'municipal', 'offstreet'].includes(destination.type);
}
