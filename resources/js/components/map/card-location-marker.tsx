import { getBlueMarkerIcon, getParkingStatusIcon, getVioletMarkerIcon } from '@/lib/icon-factory';
import { cn } from '@/lib/utils';
import { ParkingMunicipal, ParkingSpace } from '@/types';
import React, { useMemo } from 'react';
import { FeatureGroup, LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ZoomControl from './zoom-control';

type Props = {
    latitude: number;
    longitude: number;
    onChange?: (lat: number, lng: number) => void;
    draggable?: boolean;
    scrollWheelZoom?: boolean;
    nearbySpaces?: ParkingSpace[];
    /** Visible municipal places, shown in violet so they stand apart from community places. */
    nearbyMunicipalSpaces?: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
    children?: React.ReactNode;
    /** Size of the map; defaults to the full-page detail size. */
    className?: string;
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

const NearbyMunicipalMarkers = React.memo(function NearbyMunicipalMarkers({ spaces }: { spaces: NonNullable<Props['nearbyMunicipalSpaces']> }) {
    const markers = useMemo(
        () =>
            spaces.map((space) => (
                <Marker key={space.id} position={[space.latitude, space.longitude]} icon={getVioletMarkerIcon()} interactive={false} />
            )),
        [spaces],
    );
    return <FeatureGroup>{markers}</FeatureGroup>;
});

export default function LocationMarkerCard({
    latitude,
    longitude,
    onChange,
    draggable,
    nearbySpaces,
    nearbyMunicipalSpaces,
    children,
    scrollWheelZoom = true,
    className = 'h-80 md:h-[500px]',
}: Props) {
    const isDraggable = draggable ?? typeof onChange === 'function';

    return (
        <div className="relative z-0">
            <MapContainer
                center={[latitude, longitude]}
                zoom={19}
                scrollWheelZoom={scrollWheelZoom}
                zoomControl={false}
                className={cn('w-full rounded-xl border', className)}
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
                    {nearbyMunicipalSpaces && nearbyMunicipalSpaces.length > 0 && (
                        <Overlay checked name="Municipal Parking Spaces">
                            <NearbyMunicipalMarkers spaces={nearbyMunicipalSpaces} />
                        </Overlay>
                    )}
                </LayersControl>

                <ZoomControl position="topleft" />
                {children}

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
