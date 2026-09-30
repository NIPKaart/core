import type { EnumOption } from './types';

/** Illustration shown at the top of a garage's detail. */
export const GARAGE_ILLUSTRATION = '/assets/images/garage.svg';

/**
 * Picks the orientation illustration: square for choice cards, wide (12:5) for the detail hero.
 * An unknown orientation falls back to a generic car illustration.
 */
export function getOrientationIllustration(orientation: EnumOption | null | undefined, variant: 'square' | 'wide' = 'square'): string {
    if (orientation?.value === 'perpendicular' || orientation?.value === 'parallel' || orientation?.value === 'angle') {
        return `/assets/images/orientation/${orientation.value}${variant === 'wide' ? '-wide' : ''}.svg`;
    }

    return '/assets/images/car-illu.svg';
}

/** Occupancy status used to color the general-availability progress bar; never the only signal (text stays next to it). */
export function occupancyStatus(free: number | null | undefined, total: number | null | undefined): 'green' | 'orange' | 'red' | null {
    if (typeof free !== 'number' || typeof total !== 'number' || total <= 0 || free > total) {
        return null;
    }
    const occupied = 1 - free / total;
    if (occupied < 0.7) return 'green';
    if (occupied < 0.9) return 'orange';
    return 'red';
}

export function occupancyPercent(free: number | null | undefined, total: number | null | undefined): number | null {
    // Sources can report more free spaces than capacity; no percentage is better than a wrong one.
    if (typeof free !== 'number' || typeof total !== 'number' || total <= 0 || free > total) {
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

/** Day and short month, European order also in English; the year only when it is not the current one. */
export function formatShortDate(value: string, language: string, now: Date = new Date()): string {
    const date = new Date(value);
    const locale = language.startsWith('en') ? 'en-GB' : language;

    return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
}
