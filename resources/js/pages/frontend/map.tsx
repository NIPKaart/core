import Navbar from '@/components/frontend/nav/nav-bar';
import { Head } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

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

    return (
        <>
            <Head title="Map" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />

                <div className="flex-1">
                    <MapContainer center={position} zoom={13} scrollWheelZoom={false} className="z-0 h-full w-full">
                        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={position} icon={defaultIcon}>
                            <Popup>This is Amsterdam! 🇳🇱</Popup>
                        </Marker>
                    </MapContainer>
                </div>
            </div>
        </>
    );
}
