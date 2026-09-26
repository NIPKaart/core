import { getInvalidParkingIcon } from '@/lib/icon-factory';
import type { ParkingResult } from '@/types/destination';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

type Props = {
    results: ParkingResult[];
    onSelect: (result: ParkingResult) => void;
};

export default function ParkingMarkerLayer({ results, onSelect }: Props) {
    const map = useMap();
    const cluster = useRef<L.MarkerClusterGroup | null>(null);
    const markers = useRef(new globalThis.Map<string, L.Marker>());
    const resultsByKey = useRef(new globalThis.Map<string, ParkingResult>());

    useEffect(() => {
        const group = L.markerClusterGroup({
            spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 16,
            maxClusterRadius: 80,
            removeOutsideVisibleBounds: true,
            animateAddingMarkers: false,
        });

        cluster.current = group;
        map.addLayer(group);

        return () => {
            map.removeLayer(group);
            cluster.current = null;
            markers.current.clear();
            resultsByKey.current.clear();
        };
    }, [map]);

    useEffect(() => {
        const group = cluster.current;
        if (!group) return;

        const incoming = new Set(results.map((result) => result.key));
        const toRemove: L.Marker[] = [];
        const toAdd: L.Marker[] = [];

        for (const [key, marker] of markers.current) {
            if (!incoming.has(key)) {
                toRemove.push(marker);
                markers.current.delete(key);
                resultsByKey.current.delete(key);
            }
        }

        for (const result of results) {
            resultsByKey.current.set(result.key, result);

            const existing = markers.current.get(result.key);
            if (existing) {
                const position = existing.getLatLng();
                if (position.lat !== result.latitude || position.lng !== result.longitude) {
                    existing.setLatLng([result.latitude, result.longitude]);
                }
                continue;
            }

            const marker = L.marker([result.latitude, result.longitude], { icon: getInvalidParkingIcon() });
            marker.on('click', () => {
                const current = resultsByKey.current.get(result.key);
                if (current) onSelect(current);
            });
            markers.current.set(result.key, marker);
            toAdd.push(marker);
        }

        if (toRemove.length > 0) group.removeLayers(toRemove);
        if (toAdd.length > 0) group.addLayers(toAdd);
    }, [results, onSelect]);

    return null;
}
