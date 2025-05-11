import LocateControl from '@/components/frontend/map/locate-control';
import ZoomControl from '@/components/frontend/map/zoom-control';
import Navbar from '@/components/frontend/nav/nav-bar';
import { Head } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayersControl, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const { BaseLayer } = LayersControl;

const defaultIcon = L.icon({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export default function Map() {
    const position: LatLngTuple = [52.3676, 4.9041]; // Amsterdam
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    return (
        <>
            <Head title="Map" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />

                <div className="flex-1">
                    <MapContainer center={position} zoom={13} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
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

                        <Marker position={position} icon={defaultIcon}>
                            <Popup>This is Amsterdam! 🇳🇱</Popup>
                        </Marker>

                        <LocateControl />
                        <ZoomControl />
                    </MapContainer>
                </div>
            </div>
        </>
    );
}
