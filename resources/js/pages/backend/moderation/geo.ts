export type MapPoint = { latitude: number; longitude: number };

/** One step of the pin with the arrow keys, and with Shift held. */
export const NUDGE_METRES = 0.5;
export const NUDGE_FAR_METRES = 5;

const EARTH_METRES = 6371000;
const RAD = Math.PI / 180;

/** Metres between two points, for the distances the moderator sees. */
export function metres(a: MapPoint, b: MapPoint): number {
    const dLat = (b.latitude - a.latitude) * RAD;
    const dLon = (b.longitude - a.longitude) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLon / 2) ** 2;
    return Math.round(EARTH_METRES * 2 * Math.asin(Math.sqrt(h)));
}

/** The nearest of several points within a radius, in metres, or null when none is that close. */
export function nearestWithin(point: MapPoint, points: MapPoint[], radius: number): number | null {
    const distances = points.map((other) => metres(point, other)).filter((distance) => distance <= radius);
    return distances.length ? Math.min(...distances) : null;
}

export type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** The point a number of metres north, south, east or west, so the pin can be placed without dragging. */
export function nudge(point: MapPoint, direction: Direction, distance: number): MapPoint {
    const latitude = distance / EARTH_METRES / RAD;
    const longitude = latitude / Math.cos(point.latitude * RAD);
    const round = (value: number) => Math.round(value * 1e7) / 1e7;

    switch (direction) {
        case 'ArrowUp':
            return { latitude: round(point.latitude + latitude), longitude: point.longitude };
        case 'ArrowDown':
            return { latitude: round(point.latitude - latitude), longitude: point.longitude };
        case 'ArrowRight':
            return { latitude: point.latitude, longitude: round(point.longitude + longitude) };
        case 'ArrowLeft':
            return { latitude: point.latitude, longitude: round(point.longitude - longitude) };
    }
}

type PanelMode = 'queue' | 'item' | 'selection';

/** What the panel beside the map shows: a selection wins over an open item, an open item over the queue. */
export function panelMode(hasItem: boolean, selected: number): PanelMode {
    if (selected > 0) return 'selection';
    return hasItem ? 'item' : 'queue';
}
