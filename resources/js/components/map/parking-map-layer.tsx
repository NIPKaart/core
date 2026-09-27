import { cancelMarkerDeselection, discoveryIcon, setMarkerSelected } from '@/lib/discovery-icons';
import { AREA_ZOOM, expandPoint, type CompactPoint } from '@/lib/map-areas';
import { TileCache, tileKey, tilesCovering, type GeoBox, type TileCoordinate } from '@/lib/map-tiles';
import { area as areaRoute, areas as areasRoute } from '@/routes/map/parking';
import type { ParkingResult } from '@/types/destination';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMap, useMapEvents } from 'react-leaflet';

type Props = {
    results?: ParkingResult[] | null;
    onSelect: (result: ParkingResult) => void;
    selectedKey: string | null;
};

type Status = 'idle' | 'loading' | 'error';

/** Loaded areas kept on the map; the least recently viewed area beyond this is removed. */
const MAX_LOADED_AREAS = 40;

/** Keys of the areas that contain public parking, so empty areas (sea, other countries) are never requested. */
async function loadAreaIndex(): Promise<Set<string>> {
    const response = await fetch(areasRoute.url(), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Parking area index request failed');
    const data: { zoom: number; areas: [x: number, y: number, count: number][] } = await response.json();
    return new Set(data.areas.map(([x, y]) => tileKey({ zoom: data.zoom, x, y })));
}

async function loadArea({ x, y }: TileCoordinate): Promise<ParkingResult[]> {
    const response = await fetch(areaRoute.url({ x, y }), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Parking area request failed');
    const data: { points: CompactPoint[] } = await response.json();
    return data.points.map(expandPoint);
}

function boxOf(bounds: L.LatLngBounds, scale = 1): GeoBox {
    const centre = bounds.getCenter();
    const halfWidth = ((bounds.getEast() - bounds.getWest()) / 2) * scale;
    const halfHeight = ((bounds.getNorth() - bounds.getSouth()) / 2) * scale;
    return { west: centre.lng - halfWidth, east: centre.lng + halfWidth, south: centre.lat - halfHeight, north: centre.lat + halfHeight };
}

/**
 * Renders public parking with Leaflet.markercluster. Records are loaded once per area and stay on the map,
 * so zooming never reloads data and markercluster keeps its animations and coverage outlines.
 */
export default function ParkingMapLayer({ onSelect, selectedKey, results = null }: Props) {
    const map = useMap();
    const { t } = useTranslation('frontend/map/main');
    const [status, setStatus] = useState<Status>('idle');
    const cache = useRef(new TileCache<ParkingResult[]>(loadArea, MAX_LOADED_AREAS));
    const areaIndex = useRef<Promise<Set<string>> | null>(null);
    const areasInView = useRef(new Set<string>());
    const cluster = useRef<L.MarkerClusterGroup | null>(null);
    const areaMarkers = useRef(new globalThis.Map<string, L.Marker[]>());
    const markersByKey = useRef(new globalThis.Map<string, L.Marker>());
    const selected = useRef<string | null>(selectedKey);
    const generation = useRef(0);
    const onSelectRef = useRef(onSelect);

    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
        const group = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            disableClusteringAtZoom: 16,
            maxClusterRadius: 100,
            removeOutsideVisibleBounds: true,
            chunkedLoading: true,
        });
        cluster.current = group;
        const loaded = areaMarkers.current;
        const byKey = markersByKey.current;
        map.addLayer(group);
        return () => {
            byKey.forEach(cancelMarkerDeselection);
            map.removeLayer(group);
            cluster.current = null;
            loaded.clear();
            byKey.clear();
        };
    }, [map]);

    useEffect(() => {
        const previousKey = selected.current;
        if (previousKey === selectedKey) return;
        selected.current = selectedKey;
        if (previousKey) {
            const previous = markersByKey.current.get(previousKey);
            if (previous) setMarkerSelected(previous, previousKey.startsWith('offstreet:') ? 'offstreet' : 'community', false);
        }
        if (selectedKey) {
            const next = markersByKey.current.get(selectedKey);
            if (next) setMarkerSelected(next, selectedKey.startsWith('offstreet:') ? 'offstreet' : 'community', true);
        }
    }, [selectedKey]);

    const addArea = useCallback((area: TileCoordinate, results: ParkingResult[]) => {
        const group = cluster.current;
        const key = tileKey(area);
        if (!group || areaMarkers.current.has(key)) return;

        const markers = results.map((result) => {
            const isSelected = result.key === selected.current;
            const marker = L.marker([result.latitude, result.longitude], {
                icon: discoveryIcon(result.source, isSelected),
                zIndexOffset: isSelected ? 1000 : 0,
                title: result.title,
                alt: result.title,
            });
            marker.on('click', () => onSelectRef.current(result));
            markersByKey.current.set(result.key, marker);
            return marker;
        });
        areaMarkers.current.set(key, markers);
        group.addLayers(markers);

        // Bound memory: drop the areas viewed least recently (insertion order is refreshed on every view),
        // but never an area in the current view, which would only be requested again.
        for (const [areaKey, stale] of areaMarkers.current) {
            if (areaMarkers.current.size <= MAX_LOADED_AREAS) break;
            if (areasInView.current.has(areaKey)) continue;
            group.removeLayers(stale);
            areaMarkers.current.delete(areaKey);
            const evicted = new Set(stale);
            for (const [markerKey, marker] of markersByKey.current) {
                if (evicted.has(marker)) {
                    cancelMarkerDeselection(marker);
                    markersByKey.current.delete(markerKey);
                }
            }
        }
    }, []);

    const update = useCallback(() => {
        if (results !== null) {
            generation.current++;
            cluster.current?.clearLayers();
            areaMarkers.current.clear();
            markersByKey.current.forEach(cancelMarkerDeselection);
            markersByKey.current.clear();
            addArea({ zoom: AREA_ZOOM, x: 0, y: 0 }, results);
            setStatus('idle');
            return;
        }
        const current = ++generation.current;
        const view = tilesCovering(boxOf(map.getBounds(), 1.5), AREA_ZOOM);
        // Only announce loading when it is noticeable, so fast responses never flash a message.
        const loadingNotice = window.setTimeout(() => current === generation.current && setStatus('loading'), 300);
        const finish = (failed: boolean) => {
            window.clearTimeout(loadingNotice);
            if (current === generation.current) setStatus(failed ? 'error' : 'idle');
        };

        areaIndex.current ??= loadAreaIndex().catch((error) => {
            areaIndex.current = null;
            throw error;
        });
        areaIndex.current.then(
            (withParking) => {
                if (current !== generation.current) return window.clearTimeout(loadingNotice);
                const needed = view.filter((area) => withParking.has(tileKey(area)));
                areasInView.current = new Set(needed.map(tileKey));

                for (const key of areasInView.current) {
                    const markers = areaMarkers.current.get(key);
                    if (markers) {
                        areaMarkers.current.delete(key);
                        areaMarkers.current.set(key, markers);
                    }
                }

                const missing = needed.filter((area) => !areaMarkers.current.has(tileKey(area)));
                if (missing.length === 0) return finish(false);

                const requests = missing.map((area) =>
                    cache.current.fetch(area).then((points) => {
                        if (current === generation.current) addArea(area, points);
                    }),
                );
                Promise.allSettled(requests).then((outcomes) => finish(outcomes.some((outcome) => outcome.status === 'rejected')));
            },
            () => finish(true),
        );
    }, [addArea, map, results]);

    useMapEvents({
        moveend: () => {
            if (results === null) update();
        },
    });
    useEffect(() => {
        const pending = generation;
        update();
        return () => {
            pending.current++;
        };
    }, [update]);

    if (status === 'idle') return null;

    return (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2" role="status" aria-live="polite">
            {status === 'loading' ? (
                <span className="rounded-full bg-background/90 px-3 py-1 text-sm shadow">{t('map.loading')}</span>
            ) : (
                <button type="button" onClick={update} className="pointer-events-auto rounded-full bg-background px-3 py-1 text-sm shadow">
                    {t('map.error')}
                </button>
            )}
        </div>
    );
}
