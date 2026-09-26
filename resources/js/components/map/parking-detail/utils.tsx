import type { EnumOption } from './types';

/** Picks the orientation illustration shown in the hero block, falling back to a generic car illustration. */
export function getOrientationIllustration(orientation: EnumOption | null | undefined): string {
    switch (orientation?.value) {
        case 'perpendicular':
            return '/assets/images/orientation/perpendicular.png';
        case 'parallel':
            return '/assets/images/orientation/parallel.png';
        case 'angle':
            return '/assets/images/orientation/angle.png';
        default:
            return '/assets/images/car-illu.svg';
    }
}

/** Occupancy status used to color the general-availability progress bar; never the only signal (text stays next to it). */
export function occupancyStatus(free: number | null | undefined, total: number | null | undefined): 'green' | 'orange' | 'red' | null {
    if (typeof free !== 'number' || typeof total !== 'number' || total <= 0) {
        return null;
    }
    const occupied = 1 - free / total;
    if (occupied < 0.7) return 'green';
    if (occupied < 0.9) return 'orange';
    return 'red';
}

export function occupancyPercent(free: number | null | undefined, total: number | null | undefined): number | null {
    if (typeof free !== 'number' || typeof total !== 'number' || total <= 0) {
        return null;
    }
    return Math.round((1 - free / total) * 100);
}

/** Straight-line distance for display: metres below 1 km, otherwise kilometres with one decimal. */
export function formatDistance(metres: number, language: string): string {
    return metres < 1000
        ? `${Math.round(metres)} m`
        : `${(metres / 1000).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
