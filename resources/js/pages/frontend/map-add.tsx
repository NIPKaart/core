import Navbar from '@/components/frontend/nav/nav-bar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Head } from '@inertiajs/react';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

const orangeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
    iconSize: [33, 48],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function ClickHandler({ onMapClick }: { onMapClick: (e: LeafletMouseEvent) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e);
        },
    });
    return null;
}

export default function AddLocation() {
    const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const handleMapClick = (e: LeafletMouseEvent) => {
        setMarkerPosition([e.latlng.lat, e.latlng.lng]);
    };

    const handleMarkerClick = () => {
        setModalOpen(true);
    };

    const handleDragEnd = (e: L.LeafletEvent) => {
        const marker = e.target as L.Marker;
        const pos = marker.getLatLng();
        setMarkerPosition([pos.lat, pos.lng]);
    };

    const formatLatLng = (pos: LatLngExpression | null) => {
        if (Array.isArray(pos)) {
            const [lat, lng] = pos;
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
        return '';
    };

    return (
        <>
            <Head title="Add Location" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />
                <MapContainer center={[52.3676, 4.9041]} zoom={15} scrollWheelZoom className="z-0 h-full w-full">
                    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ClickHandler onMapClick={handleMapClick} />
                    {markerPosition && (
                        <Marker
                            position={markerPosition}
                            icon={orangeIcon}
                            draggable
                            eventHandlers={{
                                dragend: handleDragEnd,
                                click: handleMarkerClick,
                            }}
                        />
                    )}
                </MapContainer>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add new location</DialogTitle>
                        <DialogDescription>
                            You have clicked on the map at the following coordinates:
                            <br />
                            <code className="font-mono text-sm">{formatLatLng(markerPosition)}</code>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end">
                        <Button onClick={() => setModalOpen(false)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
