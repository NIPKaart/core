import type { DiscoveryFilters } from '@/lib/discovery-filters';
import { nearby } from '@/routes/map/parking';
import type { ParkingResult } from '@/types/destination';
import { useEffect } from 'react';
import type { DiscoveryStatus } from './parking-results';

export default function NearbyDiscovery({
    origin,
    filters,
    page,
    retry,
    onResults,
    onStatus,
    onHasMore,
}: {
    origin: { latitude: number; longitude: number };
    filters: DiscoveryFilters;
    page: number;
    retry: number;
    onResults: (results: ParkingResult[]) => void;
    onStatus: (status: DiscoveryStatus) => void;
    onHasMore: (hasMore: boolean) => void;
}) {
    useEffect(() => {
        const request = new AbortController();
        onStatus('loading');
        onResults([]);
        onHasMore(false);
        async function load() {
            try {
                const response = await fetch(nearby.url({ query: { ...origin, ...filters, page, limit: 100 } }), {
                    signal: request.signal,
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error('Discovery request failed');
                const data = await response.json();
                if (request.signal.aborted) return;
                onResults(data.results);
                onHasMore(data.has_more);
                onStatus('ready');
            } catch {
                if (!request.signal.aborted) onStatus('error');
            }
        }
        void load();
        return () => request.abort();
    }, [origin, filters, page, retry, onResults, onStatus, onHasMore]);
    return null;
}
