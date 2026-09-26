import { viewport } from '@/routes/map/parking';
import type { ParkingResult } from '@/types/destination';
import { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { DiscoveryStatus } from './parking-results';

export default function ViewportDiscovery({
    onResults,
    onStatus,
    retry,
}: {
    onResults: (results: ParkingResult[]) => void;
    onStatus: (status: DiscoveryStatus) => void;
    retry: number;
}) {
    const map = useMap();
    const controller = useRef<AbortController | null>(null);
    const timeout = useRef<number | null>(null);
    const loadedZoom = useRef<number | null>(null);
    const loadedBounds = useRef<ReturnType<typeof map.getBounds> | null>(null);

    const load = useCallback(
        (force = false) => {
            controller.current?.abort();
            if (timeout.current !== null) window.clearTimeout(timeout.current);
            if (!force && loadedZoom.current === map.getZoom() && loadedBounds.current?.contains(map.getBounds())) {
                onStatus('ready');
                return;
            }
            onStatus('loading');
            timeout.current = window.setTimeout(async () => {
                const request = new AbortController();
                controller.current = request;
                const bounds = map.getBounds().pad(0.5);
                const zoom = map.getZoom();
                try {
                    const response = await fetch(
                        viewport.url({
                            query: {
                                west: String(Math.max(-180, bounds.getWest())),
                                south: String(Math.max(-90, bounds.getSouth())),
                                east: String(Math.min(180, bounds.getEast())),
                                north: String(Math.min(90, bounds.getNorth())),
                                limit: '500',
                            },
                        }),
                        { signal: request.signal, headers: { Accept: 'application/json' } },
                    );
                    if (!response.ok) throw new Error('Discovery request failed');
                    const data = await response.json();
                    if (request.signal.aborted) return;
                    loadedBounds.current = bounds;
                    loadedZoom.current = zoom;
                    onResults(data.results ?? []);
                    onStatus('ready');
                } catch {
                    if (!request.signal.aborted) {
                        loadedBounds.current = null;
                        onResults([]);
                        onStatus('error');
                    }
                }
            }, 250);
        },
        [map, onResults, onStatus],
    );

    useMapEvents({ moveend: () => load() });
    useEffect(() => {
        load(true);
        return () => {
            if (timeout.current !== null) window.clearTimeout(timeout.current);
            controller.current?.abort();
        };
    }, [load, retry]);
    return null;
}
