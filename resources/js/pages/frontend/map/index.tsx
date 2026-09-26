import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ParkingMarkerLayer from '@/components/map/parking-marker-layer';
import ZoomControl from '@/components/map/zoom-control';
import type { DestinationResult, ParkingResult } from '@/types/destination';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { HashSync } from '@/components/map/hash-sync';
import ParkingMunicipalModal from '@/components/map/modal-parking-municipal/modal-main';
import ParkingOffstreetModal from '@/components/map/modal-parking-offstreet/modal-main';
import ParkingSpaceModal from '@/components/map/modal-parking-space/modal-main';
import MapLayout from '@/layouts/map-layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { BaseLayer } = LayersControl;

function ViewportDiscovery({
    onResults,
}: {
    onResults: (results: ParkingResult[], bounds: { west: number; south: number; east: number; north: number }) => void;
}) {
    const map = useMap();
    const controller = useRef<AbortController | null>(null);
    const timeout = useRef<number | null>(null);
    const loadedBounds = useRef<ReturnType<typeof map.getBounds> | null>(null);

    const load = useCallback(
        (force = false) => {
            const visibleBounds = map.getBounds();
            if (!force && loadedBounds.current?.contains(visibleBounds)) return;

            if (timeout.current !== null) window.clearTimeout(timeout.current);
            timeout.current = window.setTimeout(async () => {
                const currentVisibleBounds = map.getBounds();
                if (!force && loadedBounds.current?.contains(currentVisibleBounds)) return;

                controller.current?.abort();
                controller.current = new AbortController();

                const bounds = currentVisibleBounds.pad(0.5);
                const params = new URLSearchParams({
                    west: String(bounds.getWest()),
                    south: String(bounds.getSouth()),
                    east: String(bounds.getEast()),
                    north: String(bounds.getNorth()),
                    limit: '500',
                });

                try {
                    const response = await fetch(`/api/parking/viewport?${params}`, {
                        signal: controller.current.signal,
                        headers: { Accept: 'application/json' },
                    });
                    if (response.ok) {
                        loadedBounds.current = bounds;
                        onResults((await response.json()).results ?? [], {
                            west: bounds.getWest(),
                            south: bounds.getSouth(),
                            east: bounds.getEast(),
                            north: bounds.getNorth(),
                        });
                    }
                } catch (error) {
                    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
                }
            }, 250);
        },
        [map, onResults],
    );

    useMapEvents({ moveend: () => load() });

    useEffect(() => {
        load(true);
        return () => {
            if (timeout.current !== null) window.clearTimeout(timeout.current);
            controller.current?.abort();
        };
    }, [load]);

    return null;
}

function DestinationFocus({ destination }: { destination: DestinationResult | null }) {
    const map = useMap();
    useEffect(() => {
        if (destination) map.setView([destination.latitude, destination.longitude], Math.max(map.getZoom(), 15));
    }, [destination, map]);
    return destination ? <Marker position={[destination.latitude, destination.longitude]} /> : null;
}

type PageProps = {
    selectOptions: {
        confirmationStatus: Record<string, string>;
    };
};

type MarkerType = 'community' | 'municipal' | 'offstreet';

function getInitialPosition(): [number, number, number] {
    if (window.location.hash) {
        const match = window.location.hash.match(/^#(\d+(\.\d+)?)\/(-?\d+(\.\d+)?)\/(-?\d+(\.\d+)?)/);
        if (match) {
            const zoom = parseFloat(match[1]);
            const lat = parseFloat(match[3]);
            const lng = parseFloat(match[5]);
            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
                return [lat, lng, zoom];
            }
        }
    }
    return [52.3667136, 4.9808665, 8];
}

export default function ParkingMap() {
    const { t } = useTranslation('frontend/map/main');
    const { t: tGlobal } = useTranslation('frontend/global');
    const initial = getInitialPosition();
    const position: LatLngTuple = [initial[0], initial[1]];
    const initialZoom = initial[2];

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const { selectOptions } = usePage<PageProps>().props;

    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedLat, setSelectedLat] = useState<number | null>(null);
    const [selectedLng, setSelectedLng] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<MarkerType>('community');
    const [destination] = useState<DestinationResult | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const latitude = Number(params.get('lat'));
        const longitude = Number(params.get('lng'));
        const label = params.get('destination');
        return label && Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { key: 'url:destination', label, sub: null, type: 'destination', latitude, longitude }
            : null;
    });

    const [viewportResults, setViewportResults] = useState<ParkingResult[]>([]);

    function mergeViewportResults(incoming: ParkingResult[], bounds: { west: number; south: number; east: number; north: number }) {
        setViewportResults((current) => {
            const next = new globalThis.Map(current.map((result) => [result.key, result]));

            for (const result of incoming) next.set(result.key, result);

            for (const [key, result] of next) {
                const insideLongitude =
                    bounds.west <= bounds.east
                        ? result.longitude >= bounds.west && result.longitude <= bounds.east
                        : result.longitude >= bounds.west || result.longitude <= bounds.east;
                const insideLatitude = result.latitude >= bounds.south && result.latitude <= bounds.north;
                if (!insideLongitude || !insideLatitude) next.delete(key);
            }

            const merged = [...next.values()];
            if (
                merged.length === current.length &&
                merged.every((result, index) => result.key === current[index]?.key && result === current[index])
            ) {
                return current;
            }

            return merged;
        });
    }

    const selectParkingResult = useCallback((marker: ParkingResult) => {
        setSelectedSpaceId(marker.id);
        setSelectedLat(marker.latitude);
        setSelectedLng(marker.longitude);
        setSelectedType(marker.source);
        setModalOpen(true);
    }, []);

    return (
        <MapLayout>
            <Head title={t('head.title')} />
            <div className="flex-1">
                <MapContainer center={position} zoom={initialZoom} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                    <HashSync />
                    <DestinationFocus destination={destination} />
                    <ViewportDiscovery onResults={mergeViewportResults} />
                    <LayersControl position="topright">
                        <BaseLayer checked name={tGlobal('layers.mapbox')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                tileSize={512}
                                zoomOffset={-1}
                            />
                        </BaseLayer>

                        <BaseLayer name={tGlobal('layers.google')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxZoom={20}
                            />
                        </BaseLayer>
                    </LayersControl>

                    <ParkingMarkerLayer results={viewportResults} onSelect={selectParkingResult} />

                    <LegendControl />
                    <LocateControl />
                    <ZoomControl />
                </MapContainer>
            </div>

            {selectedType === 'community' && selectedSpaceId && selectedLat !== null && selectedLng !== null && (
                <ParkingSpaceModal
                    spaceId={selectedSpaceId}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    latitude={selectedLat}
                    longitude={selectedLng}
                    confirmationStatusOptions={selectOptions.confirmationStatus}
                />
            )}

            {selectedType === 'municipal' && selectedSpaceId && selectedLat !== null && selectedLng !== null && (
                <ParkingMunicipalModal
                    spaceId={selectedSpaceId}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    latitude={selectedLat}
                    longitude={selectedLng}
                />
            )}

            {selectedType === 'offstreet' && selectedSpaceId && selectedLat !== null && selectedLng !== null && (
                <ParkingOffstreetModal
                    spaceId={selectedSpaceId}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    latitude={selectedLat}
                    longitude={selectedLng}
                />
            )}
        </MapLayout>
    );
}
