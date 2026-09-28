import { occupancyStatus } from '@/components/map/parking-detail/utils';

/** Current garage occupancy from the server: operator status, general free spaces and capacity of the same measurement. */
export type GarageOccupancy = [status: 'counting' | 'open' | 'full' | 'closed', free: number | null, capacity: number | null];

export type GarageBadge = { text: string; tone: 'green' | 'orange' | 'red' | 'grey'; label: string };

type Labels = { full: string; closed: string; open: string; free: (count: number, formatted: string) => string };

/**
 * What a garage marker shows next to its pin. Only a current measurement gets a badge; without one the pin stays bare,
 * so the map never suggests availability that is unknown. Tones match the occupancy bar in the detail.
 */
export function garageBadge(occupancy: GarageOccupancy | undefined, labels: Labels): GarageBadge | null {
    if (!occupancy) return null;
    const [status, free, capacity] = occupancy;
    if (status === 'closed') return { text: labels.closed, tone: 'grey', label: labels.closed };
    if (status === 'full' || free === 0) return { text: labels.full, tone: 'red', label: labels.full };
    if (free === null) return status === 'open' ? { text: labels.open, tone: 'green', label: labels.open } : null;

    // No thousands separator: a marker badge stays short and reads the same in every language.
    const count = String(free);
    // More free than capacity is a source inconsistency: show the count, without judging how full it is.
    const tone = capacity !== null && free <= capacity ? occupancyStatus(free, capacity) : 'green';

    return { text: count, tone: tone ?? 'green', label: labels.free(free, count) };
}
