import DestinationSearch from '@/components/map/destination-search';
import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ZoomControl from '@/components/map/zoom-control';
import type { DestinationResult, ParkingResult } from '@/types/destination';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';

import { HashSync } from '@/components/map/hash-sync';
import ParkingMunicipalModal from '@/components/map/modal-parking-municipal/modal-main';
import ParkingOffstreetModal from '@/components/map/modal-parking-offstreet/modal-main';
import ParkingSpaceModal from '@/components/map/modal-parking-space/modal-main';
import MapLayout from '@/layouts/map-layout';
import { getInvalidParkingIcon } from '@/lib/icon-factory';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { BaseLayer } = LayersControl;

function ViewportDiscovery({ onResults }: { onResults: (results: ParkingResult[]) => void }) {
    const map = useMap();
    const controller = useRef<AbortController | null>(null);
    const timeout = useRef<number | null>(null);

    function load() {
        if (timeout.current !== null) window.clearTimeout(timeout.current);
        timeout.current = window.setTimeout(async () => {
            controller.current?.abort();
            controller.current = new AbortController();

            const bounds = map.getBounds().pad(0.2);
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
                if (response.ok) onResults((await response.json()).results ?? []);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
            }
        }, 250);
    }

    useMapEvents({ moveend: load, zoomend: load });

    useEffect(() => {
        load();
        return () => {
            if (timeout.current !== null) window.clearTimeout(timeout.current);
            controller.current?.abort();
        };
    }, []);

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

export default function Map() {
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
    const [destination, setDestination] = useState<DestinationResult | null>(null);
    const [nearbyResults, setNearbyResults] = useState<ParkingResult[]>([]);

    async function selectDestination(next: DestinationResult) {
        setDestination(next);
        const params = new URLSearchParams({
            latitude: String(next.latitude),
            longitude: String(next.longitude),
            radius: '1000',
            limit: '100',
        });
        const response = await fetch(`/api/parking/nearby?${params}`, { headers: { Accept: 'application/json' } });
        if (response.ok) setNearbyResults((await response.json()).results ?? []);
    }

    const [viewportResults, setViewportResults] = useState<ParkingResult[]>([]);

    const parkingMarkers = useMemo(
        () =>
            viewportResults.map((marker) => (
                <Marker
                    key={marker.key}
                    position={[marker.latitude, marker.longitude]}
                    icon={getInvalidParkingIcon()}
                    eventHandlers={{
                        click: () => {
                            setSelectedSpaceId(marker.id);
                            setSelectedLat(marker.latitude);
                            setSelectedLng(marker.longitude);
                            setSelectedType(marker.source);
                            setModalOpen(true);
                        },
                    }}
                />
            )),
        [viewportResults],
    );

    return (
        <MapLayout>
            <Head title={t('head.title')} />
            <div className="flex-1">
                <MapContainer center={position} zoom={initialZoom} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                    <HashSync />
                    <DestinationFocus destination={destination} />
                    <ViewportDiscovery onResults={setViewportResults} />
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

                    <MarkerClusterGroup
                        key={'parking'}
                        spiderfyOnMaxZoom={false}
                        disableClusteringAtZoom={16}
                        maxClusterRadius={80}
                        removeOutsideVisibleBound={true}
                    >
                        {parkingMarkers}
                    </MarkerClusterGroup>


                    <LegendControl />
                    <LocateControl />
                    <ZoomControl />
                    <DestinationSearch onSelect={selectDestination} />
                </MapContainer>
            </div>

            {destination && (
                <div className="sr-only" aria-live="polite">
                    {nearbyResults.length} parking options found near {destination.label}
                </div>
            )}

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
