import Navbar from '@/components/frontend/nav/nav-bar';
import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ZoomControl from '@/components/map/zoom-control';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getOrangeMarkerIcon, getParkingStatusIcon } from '@/lib/icon-factory';
import { NominatimAddress, ParkingSpot } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
import L from 'leaflet';
import { AlertCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayersControl, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { AddLocationForm } from './form/form-create-location';

const { BaseLayer, Overlay } = LayersControl;

type PageProps = {
    selectOptions: {
        orientation: Record<string, string>;
    };
    parkingSpots: ParkingSpot[];
};

function ClickHandler({ onMapClick }: { onMapClick: (e: LeafletMouseEvent) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e);
        },
    });
    return null;
}

/**
 * Custom hook to track if the user just dragged the marker.
 * Resets after a specified timeout.
 */
function useJustDragged(timeout = 250): [boolean, () => void] {
    const [justDragged, setJustDragged] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerDrag = useCallback(() => {
        setJustDragged(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setJustDragged(false), timeout);
    }, [timeout]);

    // Clean up timer on unmount
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    return [justDragged, triggerDrag];
}

/**
 * Clustered parking markers component.
 * Uses MarkerClusterGroup to cluster parking spots on the map.
 */
const ClusteredParkingMarkers = React.memo(function ClusteredParkingMarkers({ spots }: { spots: ParkingSpot[] }) {
    const clusterMarkers = useMemo(
        () =>
            spots.map((spot) => (
                <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={getParkingStatusIcon(spot.status)} interactive={false} />
            )),
        [spots],
    );
    return (
        <MarkerClusterGroup
            spiderfyOnMaxZoom={false}
            disableClusteringAtZoom={16}
            maxClusterRadius={100}
            removeOutsideVisibleBounds={true}
            chunkedLoading
        >
            {clusterMarkers}
        </MarkerClusterGroup>
    );
});

export default function AddLocation() {
    const { props } = usePage<PageProps>();
    const { selectOptions, parkingSpots } = props;
    const generalError = props.errors?.general;

    const [nominatimData, setNominatimData] = useState<NominatimAddress | null>(null);
    const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [addressValid, setAddressValid] = useState<boolean>(false);
    const [justDragged, triggerDrag] = useJustDragged(50);

    const handleMapClick = (e: LeafletMouseEvent) => {
        setMarkerPosition([e.latlng.lat, e.latlng.lng]);
        setModalOpen(false);
    };

    const handleMarkerClick = () => {
        if (justDragged) return;
        setModalOpen(true);
    };

    const handleDragEnd = (e: L.LeafletEvent) => {
        const marker = e.target as L.Marker;
        const pos = marker.getLatLng();
        setMarkerPosition([pos.lat, pos.lng]);
        triggerDrag();
    };

    // Fetch address data from Nominatim when marker position changes
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
                // console.log(data.address);
                if (data?.address && data.address.country_code) {
                    setNominatimData(data.address as NominatimAddress);
                    setAddressValid(true);
                } else {
                    setNominatimData(null);
                    setAddressValid(false);
                }
            })
            .catch(() => {
                setNominatimData(null);
                setAddressValid(false);
            });
    }, [markerPosition]);

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    return (
        <>
            <Head title="Add Location" />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />
                <MapContainer center={[52.3676, 4.9041]} zoom={13} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                    <LayersControl position="topright">
                        <BaseLayer name="Mapbox Streets">
                            <TileLayer
                                attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                tileSize={512}
                                zoomOffset={-1}
                            />
                        </BaseLayer>

                        <BaseLayer checked name="Google Hybrid">
                            <TileLayer
                                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxZoom={20}
                            />
                        </BaseLayer>

                        {/* Overlay for nearby parking spots */}
                        <Overlay checked={true} name="Nearby Parking Spots">
                            <ClusteredParkingMarkers spots={parkingSpots} />
                        </Overlay>
                    </LayersControl>

                    {/* Click handler to set marker position */}
                    <ClickHandler onMapClick={handleMapClick} />
                    {markerPosition && (
                        <Marker
                            position={markerPosition}
                            icon={getOrangeMarkerIcon()}
                            draggable
                            eventHandlers={{
                                dragend: handleDragEnd,
                                click: handleMarkerClick,
                            }}
                        />
                    )}

                    <LegendControl />
                    <LocateControl />
                    <ZoomControl />
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

                        {generalError && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Submission failed</AlertTitle>
                                <AlertDescription>{generalError}</AlertDescription>
                            </Alert>
                        )}

                        <AddLocationForm
                            lat={markerPosition[0]}
                            lng={markerPosition[1]}
                            nominatim={nominatimData}
                            onClose={() => setModalOpen(false)}
                            orientationOptions={selectOptions.orientation}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
