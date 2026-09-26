/**
 * Formats coordinates for a handoff. Coordinates are authoritative: an address may be incomplete or ambiguous.
 */
export function formatCoordinates(latitude: number, longitude: number): string | null {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return null;
    }

    return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Google Maps destination-only directions link. Returns null when the coordinates are not valid. */
export function navigationUrl(latitude: number, longitude: number): string | null {
    const coordinates = formatCoordinates(latitude, longitude);

    return coordinates ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinates)}` : null;
}

export function streetViewUrl(latitude: number, longitude: number): string | null {
    const coordinates = formatCoordinates(latitude, longitude);

    return coordinates ? `https://maps.google.com/maps?q=&layer=c&cbll=${coordinates}` : null;
}
