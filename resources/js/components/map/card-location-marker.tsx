import { getBlueMarkerIcon, getParkingStatusIcon } from '@/lib/icon-factory';
import { ParkingSpace } from '@/types';
import React, { useMemo } from 'react';
import { FeatureGroup, LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ZoomControl from './zoom-control';

type Props = {
    latitude: number;
    longitude: number;
    onChange?: (lat: number, lng: number) => void;
    draggable?: boolean;
    nearbySpaces?: ParkingSpace[];
};

const { BaseLayer, Overlay } = LayersControl;

const NearbyParkingMarkers = React.memo(function NearbyParkingMarkers({ spaces }: { spaces: ParkingSpace[] }) {
    const markers = useMemo(
        () =>
            spaces.map((space) => (
                <Marker key={space.id} position={[space.latitude, space.longitude]} icon={getParkingStatusIcon(space.status)} interactive={false} />
            )),
        [spaces],
    );
    return <FeatureGroup>{markers}</FeatureGroup>;
});

export default function LocationMarkerCard({ latitude, longitude, onChange, draggable, nearbySpaces }: Props) {
    const isDraggable = draggable ?? typeof onChange === 'function';

    return (
        <div className="relative z-0">
            <MapContainer
                center={[latitude, longitude]}
                zoom={19}
                scrollWheelZoom
                zoomControl={false}
                className="h-80 w-full rounded-xl border md:h-[500px]"
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
                    {/* Overlay for nearby parking spaces */}
                    {nearbySpaces && nearbySpaces.length > 0 && (
                        <Overlay checked name="Nearby Parking Spaces">
                            <NearbyParkingMarkers spaces={nearbySpaces} />
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
