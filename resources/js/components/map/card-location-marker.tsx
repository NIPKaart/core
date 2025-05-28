import { getBlueMarkerIcon, getParkingStatusIcon } from '@/lib/icon-factory';
import { ParkingSpot } from '@/types';
import React, { useMemo } from 'react';
import { FeatureGroup, LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ZoomControl from './zoom-control';

type Props = {
    latitude: number;
    longitude: number;
    onChange?: (lat: number, lng: number) => void;
    draggable?: boolean;
    nearbySpots?: ParkingSpot[];
};

const { BaseLayer, Overlay } = LayersControl;

const NearbyParkingMarkers = React.memo(function NearbyParkingMarkers({ spots }: { spots: ParkingSpot[] }) {
    const markers = useMemo(
        () =>
            spots.map((spot) => (
                <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={getParkingStatusIcon(spot.status)} interactive={false} />
            )),
        [spots],
    );
    return <FeatureGroup>{markers}</FeatureGroup>;
});

export default function LocationMarkerCard({ latitude, longitude, onChange, draggable, nearbySpots }: Props) {
    const isDraggable = draggable ?? typeof onChange === 'function';

    return (
        <div className="relative z-0">
            <MapContainer
                center={[latitude, longitude]}
                zoom={19}
                scrollWheelZoom
                zoomControl={false}
                className="h-80 w-full rounded-md border md:h-[500px]"
            >
                <LayersControl position="topright">
                    <BaseLayer checked name="Google Hybrid">
                        <TileLayer
                            attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                            url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                            maxZoom={22}
                        />
                    </BaseLayer>

                    <BaseLayer name="Google Streets">
                        <TileLayer
                            attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                            maxZoom={22}
                        />
                    </BaseLayer>
                    {/* Overlay for nearby parking spots */}
                    {nearbySpots && nearbySpots.length > 0 && (
                        <Overlay checked name="Nearby Parking Spots">
                            <NearbyParkingMarkers spots={nearbySpots} />
                        </Overlay>
                    )}
                </LayersControl>

                <ZoomControl position="topleft" />

                <Marker
                    position={[latitude, longitude]}
                    icon={getBlueMarkerIcon()}
                    draggable={isDraggable}
                    eventHandlers={
                        isDraggable && onChange
                            ? {
                                  dragend: (e) => {
                                      const { lat, lng } = e.target.getLatLng();
                                      onChange(lat, lng);
                                  },
                              }
                            : undefined
                    }
                />
            </MapContainer>
        </div>
    );
}
