import type { ParkingResult } from '@/types/destination';

type LinkedSource = 'community' | 'municipal' | 'offstreet';

const SOURCES: LinkedSource[] = ['community', 'municipal', 'offstreet'];

/**
 * A map path that reopens one parking place, e.g. after logging in to confirm or report it.
 *
 * The position travels in the query rather than the `#zoom/lat/lng` fragment, because a server redirect drops the fragment.
 */
export function placeLinkPath(place: Pick<ParkingResult, 'source' | 'id' | 'latitude' | 'longitude'>): string {
    const params = new URLSearchParams({ place: `${place.source}:${place.id}`, at: `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}` });

    return `/map?${params.toString()}`;
}

/** The place a map link asks to reopen, or null when the link is missing or malformed. */
export function readPlaceLink(params: URLSearchParams): ParkingResult | null {
    const [source, ...idParts] = (params.get('place') ?? '').split(':');
    const id = idParts.join(':');
    const [latitude, longitude] = (params.get('at') ?? '').split(',').map(Number);

    if (!SOURCES.includes(source as LinkedSource) || !id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

    return { key: `${source}:${id}`, id, source: source as LinkedSource, latitude, longitude, title: '', distance_metres: null };
}

/** The same map address without the place link, positioned on the place so the usual map fragment takes over. */
export function withoutPlaceLink(url: URL, place: ParkingResult, zoom = 19): string {
    url.searchParams.delete('place');
    url.searchParams.delete('at');
    url.hash = `#${zoom}/${place.latitude.toFixed(5)}/${place.longitude.toFixed(5)}`;

    return url.pathname + url.search + url.hash;
}
