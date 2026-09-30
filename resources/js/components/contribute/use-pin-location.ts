import { locate } from '@/routes/location-map';
import { viewport } from '@/routes/map/parking';
import type { ParkingResult } from '@/types/destination';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PinLocation } from './types';

/** The pin must be this close before a location can be used, so it lands on one bay. */
export const MIN_PIN_ZOOM = 17;

/** Known places within this distance are pointed out as a possible duplicate; moderators use the same distance (NearbyMunicipalPlaces::THRESHOLD_METRES). */
const NEARBY_METRES = 30;

/** About 60 m of latitude; enough to find known places near the pin. */
const NEARBY_DEGREES = 0.0006;

async function nearestKnownPlace(latitude: number, longitude: number, signal: AbortSignal): Promise<number | null> {
    const response = await fetch(
        viewport.url({
            query: {
                west: String(longitude - NEARBY_DEGREES * 1.6),
                east: String(longitude + NEARBY_DEGREES * 1.6),
                south: String(latitude - NEARBY_DEGREES),
                north: String(latitude + NEARBY_DEGREES),
                limit: '20',
                origin_latitude: String(latitude),
                origin_longitude: String(longitude),
            },
        }),
        { signal, headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const data: { results?: ParkingResult[] } = await response.json();
    const distances = (data.results ?? [])
        .filter((result) => result.source !== 'offstreet' && result.distance_metres !== null)
        .map((result) => result.distance_metres as number);
    const nearest = distances.length ? Math.min(...distances) : null;

    return nearest !== null && nearest <= NEARBY_METRES ? Math.round(nearest) : null;
}

/**
 * Resolves the address under the pin through the server once the map settles, and looks for known places nearby.
 */
export function usePinLocation(center: { latitude: number; longitude: number } | null, zoom: number, enabled: boolean) {
    const [state, setState] = useState<PinLocation>({ status: 'zoom' });
    const [attempt, setAttempt] = useState(0);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        controller.current?.abort();
        if (!enabled || !center) return;
        if (zoom < MIN_PIN_ZOOM) {
            setState({ status: 'zoom' });
            return;
        }

        const request = new AbortController();
        controller.current = request;
        setState({ status: 'resolving' });
        const timer = window.setTimeout(async () => {
            try {
                const [response, nearbyMetres] = await Promise.all([
                    fetch(locate.url({ query: { latitude: String(center.latitude), longitude: String(center.longitude) } }), {
                        signal: request.signal,
                        headers: { Accept: 'application/json' },
                    }),
                    nearestKnownPlace(center.latitude, center.longitude, request.signal).catch(() => null),
                ]);
                const data = await response.json();
                if (request.signal.aborted) return;
                setState(response.ok ? { status: 'resolved', location: data, nearbyMetres } : { status: 'failed', message: data.message ?? '' });
            } catch {
                if (!request.signal.aborted) setState({ status: 'failed', message: '' });
            }
        }, 400);

        return () => {
            window.clearTimeout(timer);
            request.abort();
        };
    }, [center, zoom, enabled, attempt]);

    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    return { state, retry };
}
