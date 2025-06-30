import Navbar from '@/components/frontend/nav/nav-bar';
import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ZoomControl from '@/components/map/zoom-control';
import { ParkingMunicipal, ParkingOffstreet, ParkingSpace } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';

import { HashSync } from '@/components/map/hash-sync';
import ParkingMunicipalModal from '@/components/map/modal-parking-municipal/modal-main';
import ParkingOffstreetModal from '@/components/map/modal-parking-offstreet/modal-main';
import ParkingSpaceModal from '@/components/map/modal-parking-space/modal-main';
import { getGarageOccupancyStatus, getGarageStatusIcon, getInvalidParkingIcon } from '@/lib/icon-factory';
import { useMemo, useState } from 'react';

const { BaseLayer } = LayersControl;

type PageProps = {
    selectOptions: {
        confirmationStatus: Record<string, string>;
    };
    parkingSpaces: ParkingSpace[];
    municipalSpaces: ParkingMunicipal[];
    offstreetSpaces: ParkingOffstreet[];
};

type MarkerType = 'community' | 'municipal' | 'offstreet';

type MapMarker = {
    id: string;
    type: MarkerType;
    latitude: number;
    longitude: number;
    orientation?: string | null;
};

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
    const initial = getInitialPosition();
    const position: LatLngTuple = [initial[0], initial[1]];
    const initialZoom = initial[2];

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const { parkingSpaces, municipalSpaces, offstreetSpaces, selectOptions } = usePage<PageProps>().props;

    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedLat, setSelectedLat] = useState<number | null>(null);
    const [selectedLng, setSelectedLng] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<MarkerType>('community');

    // Create markers list for parking spaces
    const parkingMarkersList: MapMarker[] = useMemo(
        () => [
            ...parkingSpaces.map((space) => ({
                id: space.id,
                type: 'community' as const,
                latitude: space.latitude,
                longitude: space.longitude,
                orientation: space.orientation,
            })),
            ...municipalSpaces.map((space) => ({
                id: space.id,
                type: 'municipal' as const,
                latitude: space.latitude,
                longitude: space.longitude,
                orientation: space.orientation ?? null,
            })),
        ],
        [parkingSpaces, municipalSpaces],
    );

    // Create markers for parking spaces
    const parkingMarkers = useMemo(
        () =>
            parkingMarkersList.map((marker) => (
                <Marker
                    key={`${marker.type}:${marker.id}`}
                    position={[marker.latitude, marker.longitude]}
                    icon={getInvalidParkingIcon()}
                    eventHandlers={{
                        click: () => {
                            setSelectedSpaceId(marker.id);
                            setSelectedLat(marker.latitude);
                            setSelectedLng(marker.longitude);
                            setSelectedType(marker.type);
                            setModalOpen(true);
                        },
                    }}
                />
            )),
        [parkingMarkersList],
    );

    // Create markers for offstreet parking spaces
    const offstreetMarkers = useMemo(
        () =>
            offstreetSpaces.map((marker) => (
                <Marker
                    key={`offstreet:${marker.id}`}
                    position={[marker.latitude, marker.longitude]}
                    icon={getGarageStatusIcon(getGarageOccupancyStatus(marker))}
                    eventHandlers={{
                        click: () => {
                            setSelectedSpaceId(marker.id);
                            setSelectedLat(marker.latitude);
                            setSelectedLng(marker.longitude);
                            setSelectedType('offstreet');
                            setModalOpen(true);
                        },
                    }}
                />
            )),
        [offstreetSpaces],
    );

    return (
        <>
            <Head title="Map" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />

                <div className="flex-1">
                    <MapContainer center={position} zoom={initialZoom} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                        <HashSync />
                        <LayersControl position="topright">
                            <BaseLayer checked name="Mapbox Streets">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                    url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                    tileSize={512}
                                    zoomOffset={-1}
                                />
                            </BaseLayer>

                            <BaseLayer name="Google Hybrid">
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
                        <MarkerClusterGroup
                            key={'offstreet'}
                            spiderfyOnMaxZoom={false}
                            disableClusteringAtZoom={16}
                            maxClusterRadius={80}
                            removeOutsideVisibleBound={true}
                        >
                            {offstreetMarkers}
                        </MarkerClusterGroup>

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
            </div>
        </>
    );
}
