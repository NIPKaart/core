import { getEcho } from '@/echo';
import type { GarageOccupancy } from '@/lib/garage-occupancy';
import { garageOccupancy } from '@/routes/map/parking';
import { useEffect, useState } from 'react';

/** Re-checked on this interval too, so a badge disappears once its measurement is no longer current. */
const REFRESH_MS = 120_000;

/** Current garage occupancy by ID, refreshed when new observations are applied and on a fallback interval. */
export function useGarageOccupancy(): globalThis.Map<string, GarageOccupancy> {
    const [occupancy, setOccupancy] = useState(() => new globalThis.Map<string, GarageOccupancy>());

    useEffect(() => {
        let request: AbortController | null = null;
        const load = () => {
            request?.abort();
            request = new AbortController();
            fetch(garageOccupancy.url(), { signal: request.signal, headers: { Accept: 'application/json' } })
                .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Garage occupancy request failed'))))
                .then((data: { garages: Record<string, GarageOccupancy> }) => setOccupancy(new globalThis.Map(Object.entries(data.garages))))
                .catch(() => {});
        };
        load();
        const interval = setInterval(load, REFRESH_MS);
        const echo = getEcho();
        const channel = echo?.channel('parking-offstreet');
        channel?.listen('.observations.applied', load);

        return () => {
            request?.abort();
            clearInterval(interval);
            // Only this listener is removed: an open garage detail shares the channel.
            channel?.stopListening('.observations.applied', load);
        };
    }, []);

    return occupancy;
}
