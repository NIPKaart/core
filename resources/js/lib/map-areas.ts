import type { ParkingResult } from '@/types/destination';

/** Mirrors ParkingDiscovery::AREA_ZOOM: records are loaded once per area tile at this zoom. */
export const AREA_ZOOM = 9;

export type CompactPoint = [key: string, latitude: number, longitude: number, title: string];

export function expandPoint([key, latitude, longitude, title]: CompactPoint): ParkingResult {
    const separator = key.indexOf(':');
    return {
        key,
        source: key.slice(0, separator) as ParkingResult['source'],
        id: key.slice(separator + 1),
        latitude,
        longitude,
        title,
        distance_metres: null,
    };
}
