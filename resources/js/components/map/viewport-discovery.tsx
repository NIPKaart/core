import { viewport } from '@/routes/map/parking';
import type { ParkingResult } from '@/types/destination';
import { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { DiscoveryStatus } from './parking-results';

export default function ViewportDiscovery({
    origin = null,
    onResults,
    onStatus,
    retry,
    page = 1,
    onPageChange,
    onHasMore,
}: {
    /** Destination that result distances are measured from. */
    origin?: { latitude: number; longitude: number } | null;
    onResults: (results: ParkingResult[]) => void;
    onStatus: (status: DiscoveryStatus) => void;
    retry: number;
    page?: number;
    onPageChange?: (page: number) => void;
    onHasMore?: (hasMore: boolean) => void;
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
            if (!force && page !== 1) {
                loadedBounds.current = null;
                onPageChange?.(1);
                return;
            }
            onStatus('loading');
            timeout.current = window.setTimeout(async () => {
                const request = new AbortController();
                controller.current = request;
                const bounds = force && loadedBounds.current ? loadedBounds.current : map.getBounds().pad(0.5);
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
                                page: String(page),
                                ...(origin ? { origin_latitude: String(origin.latitude), origin_longitude: String(origin.longitude) } : {}),
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
                    onHasMore?.(data.has_more ?? false);
                    onStatus('ready');
                } catch {
                    if (!request.signal.aborted) {
                        onHasMore?.(false);
                        onResults([]);
                        onStatus('error');
                    }
                }
            }, 250);
        },
        [map, onResults, onStatus, page, onPageChange, onHasMore, origin],
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
