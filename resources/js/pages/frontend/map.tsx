import Navbar from '@/components/frontend/nav/nav-bar';
import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ZoomControl from '@/components/map/zoom-control';
import { ParkingSpot } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';

import LocationModal from '@/components/map/modal-location';
import { getInvalidParkingIcon } from '@/lib/icon-factory';
import { useMemo, useState } from 'react';

const { BaseLayer } = LayersControl;

type PageProps = {
    parkingSpots: ParkingSpot[];
};

export default function Map() {
    const position: LatLngTuple = [52.3667136, 4.9808665];
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const { parkingSpots } = usePage<PageProps>().props;

    const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
    const [selectedLat, setSelectedLat] = useState<number | null>(null);
    const [selectedLng, setSelectedLng] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const parkingSpotMarkers = useMemo(
        () =>
            parkingSpots.map((spot) => (
                <Marker
                    key={spot.id}
                    position={[spot.latitude, spot.longitude]}
                    icon={getInvalidParkingIcon()}
                    eventHandlers={{
                        click: () => {
                            setSelectedSpotId(spot.id);
                            setSelectedLat(spot.latitude);
                            setSelectedLng(spot.longitude);
                            setModalOpen(true);
                        },
                    }}
                />
            )),
        [parkingSpots],
    );

    return (
        <>
            <Head title="Map" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />

                <div className="flex-1">
                    <MapContainer center={position} zoom={8} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
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
                            spiderfyOnMaxZoom={false}
                            disableClusteringAtZoom={16}
                            maxClusterRadius={80}
                            removeOutsideVisibleBound={true}
                        >
                            {parkingSpotMarkers}
                        </MarkerClusterGroup>

                        <LegendControl />
                        <LocateControl />
                        <ZoomControl />
                    </MapContainer>
                </div>

                <LocationModal
                    spotId={selectedSpotId}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    latitude={selectedLat}
                    longitude={selectedLng}
                />
            </div>
        </>
    );
}
