import Navbar from '@/components/frontend/nav/nav-bar';
import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ZoomControl from '@/components/map/zoom-control';
import AddParkingModal from '@/components/modals/modal-add-parking';
import { getOrangeMarkerIcon, getParkingStatusIcon } from '@/lib/icon-factory';
import { NominatimAddress, ParkingSpace } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
import L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayersControl, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import Swal from 'sweetalert2';

const { BaseLayer, Overlay } = LayersControl;

type PageProps = {
    selectOptions: {
        orientation: Record<string, string>;
    };
    parkingSpaces: ParkingSpace[];
};

function ClickHandler({ onMapClick }: { onMapClick: (e: LeafletMouseEvent) => void }) {
    useMapEvents({
        click(e) {
            const target = e.originalEvent.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest('.leaflet-control')) return;
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
 * Uses MarkerClusterGroup to cluster parking spaces on the map.
 */
const ClusteredParkingMarkers = React.memo(function ClusteredParkingMarkers({ spaces }: { spaces: ParkingSpace[] }) {
    const clusterMarkers = useMemo(
        () =>
            spaces.map((space) => (
                <Marker key={space.id} position={[space.latitude, space.longitude]} icon={getParkingStatusIcon(space.status)} interactive={false} />
            )),
        [spaces],
    );
    return (
        <MarkerClusterGroup spiderfyOnMaxZoom={false} disableClusteringAtZoom={16} maxClusterRadius={100} removeOutsideVisibleBounds chunkedLoading>
            {clusterMarkers}
        </MarkerClusterGroup>
    );
});

export default function AddLocation() {
    const { props } = usePage<PageProps>();
    const { selectOptions, parkingSpaces } = props;
    const generalError = props.errors?.general as string | undefined;
    const { t } = useTranslation('frontend/map/add-parking');
    const { t: tGlobal } = useTranslation('frontend/global');

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
            headers: { 'User-Agent': 'NIPKaart (https://nipkaart.nl)' },
        })
            .then((res) => res.json())
            .then((data) => {
                // console.log('Nominatim data:', data.address);
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

    const successHandler = () => {
        Swal.fire({
            title: t('modal.success.title'),
            text: t('modal.success.text'),
            icon: 'success',
            confirmButtonText: t('modal.success.confirm'),
            confirmButtonColor: '#f97316',
        }).then(() => {
            setModalOpen(false);
        });
    };

    const [lat, lng] = (markerPosition as [number, number]) ?? [];

    const actionWithQuery =
        markerPosition && Array.isArray(markerPosition)
            ? `${route('map.store')}?latitude=${lat}&longitude=${lng}&nominatim=${encodeURIComponent(JSON.stringify(nominatimData ?? {}))}`
            : route('map.store');

    return (
        <>
            <Head title={t('head.title')} />
            <div className="flex h-[100dvh] flex-col">
                <Navbar />
                <MapContainer center={[52.3676, 4.9041]} zoom={13} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                    <LayersControl position="topright">
                        <BaseLayer name={tGlobal('layers.mapbox')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                tileSize={512}
                                zoomOffset={-1}
                            />
                        </BaseLayer>

                        <BaseLayer checked name={tGlobal('layers.google')}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxZoom={20}
                            />
                        </BaseLayer>

                        {/* Overlay for nearby parking spaces */}
                        <Overlay checked name={tGlobal('layers.parkingOverlay')}>
                            <ClusteredParkingMarkers spaces={parkingSpaces} />
                        </Overlay>
                    </LayersControl>

                    {/* Click handler to set marker position */}
                    <ClickHandler onMapClick={handleMapClick} />
                    {markerPosition && (
                        <Marker
                            position={markerPosition}
                            icon={getOrangeMarkerIcon()}
                            draggable
                            eventHandlers={{ dragend: handleDragEnd, click: handleMarkerClick }}
                        />
                    )}

                    <LegendControl />
                    <LocateControl />
                    <ZoomControl />
                </MapContainer>
            </div>

            {modalOpen && markerPosition && Array.isArray(markerPosition) && (
                <AddParkingModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    action={actionWithQuery}
                    method="post"
                    orientationOptions={selectOptions.orientation}
                    lat={lat}
                    lng={lng}
                    addressValid={addressValid}
                    generalError={generalError}
                    onSuccess={successHandler}
                />
            )}
        </>
    );
}
