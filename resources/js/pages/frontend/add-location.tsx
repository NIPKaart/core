import Navbar from '@/components/frontend/nav/nav-bar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { AddLocationForm } from './form/location';

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
    const { props } = usePage();
    const selectOptions = props.selectOptions as {
        orientation: Record<string, string>;
    };

    const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [addressValid, setAddressValid] = useState<boolean>(false);

    const handleMapClick = (e: LeafletMouseEvent) => {
        setMarkerPosition([e.latlng.lat, e.latlng.lng]);
        setModalOpen(false);
    };

    const handleMarkerClick = () => {
        setModalOpen(true);
    };

    const handleDragEnd = (e: L.LeafletEvent) => {
        const marker = e.target as L.Marker;
        const pos = marker.getLatLng();
        setMarkerPosition([pos.lat, pos.lng]);
    };

    useEffect(() => {
        if (!markerPosition || !Array.isArray(markerPosition)) return;

        const [lat, lng] = markerPosition;

        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
            headers: {
                'User-Agent': 'NIPKaart (https://nipkaart.nl)',
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.address && data.address.country_code) {
                    setAddressValid(true);
                } else {
                    setAddressValid(false);
                }
            })
            .catch(() => {
                setAddressValid(false);
            });
    }, [markerPosition]);

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

            {modalOpen && markerPosition && Array.isArray(markerPosition) && (
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add new location</DialogTitle>
                            <DialogDescription>Fill in the form below to add a new location.</DialogDescription>
                        </DialogHeader>

                        {!addressValid && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Address lookup failed</AlertTitle>
                                <AlertDescription>
                                    We could not determine the address for this location. Try moving the pin slightly.
                                </AlertDescription>
                            </Alert>
                        )}

                        <AddLocationForm
                            lat={markerPosition[0]}
                            lng={markerPosition[1]}
                            onClose={() => setModalOpen(false)}
                            orientationOptions={selectOptions.orientation}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
