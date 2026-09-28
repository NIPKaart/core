import { occupancyStatus } from '@/components/map/parking-detail/utils';

/** Current garage occupancy from the server: operator status, general free spaces and capacity of the same measurement. */
export type GarageOccupancy = [status: 'counting' | 'open' | 'full' | 'closed' | 'unavailable', free: number | null, capacity: number | null];

/** `unavailable` draws the no-data pin instead of a badge. */
export type GarageBadge = { text: string; tone: 'green' | 'orange' | 'red' | 'grey'; label: string; unavailable?: boolean };

type Labels = { full: string; closed: string; unavailable: string; free: (count: number, formatted: string) => string };

/**
 * What a garage marker shows next to its pin. Only a current count, full or closed gets a badge; temporarily missing
 * live data gets its own pin, and a garage never measured stays bare, so the map never suggests unknown availability. Tones match the occupancy bar in the detail.
 */
export function garageBadge(occupancy: GarageOccupancy | undefined, labels: Labels): GarageBadge | null {
    if (!occupancy) return null;
    const [status, free, capacity] = occupancy;
    if (status === 'unavailable') return { text: '', tone: 'grey', label: labels.unavailable, unavailable: true };
    if (status === 'closed') return { text: labels.closed, tone: 'grey', label: labels.closed };
    if (status === 'full' || free === 0) return { text: labels.full, tone: 'red', label: labels.full };
    // A P+R that only reports "free" gets no badge: without a count, "free" is easily misread (free of charge, accessible).
    if (free === null) return null;

    // No thousands separator: a marker badge stays short and reads the same in every language.
    const count = String(free);
    // More free than capacity is a source inconsistency: show the count, without judging how full it is.
    const tone = capacity !== null && free <= capacity ? occupancyStatus(free, capacity) : 'green';

    return { text: count, tone: tone ?? 'green', label: labels.free(free, count) };
}
