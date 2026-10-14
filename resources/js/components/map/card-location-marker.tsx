import { getBlueMarkerIcon, getParkingStatusIcon, getVioletMarkerIcon } from '@/lib/icon-factory';
import { cn } from '@/lib/utils';
import { ParkingMunicipal, ParkingSpace } from '@/types';
import type L from 'leaflet';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/** React Leaflet registers layer names once; updating the control leaves the active map layers intact. */
export function synchronizeLayerLabel(control: L.Control.Layers | null, layer: L.Layer | null, label: string, overlay = false): void {
    if (!control || !layer) return;
    control.removeLayer(layer);
    if (overlay) control.addOverlay(layer, label);
    else control.addBaseLayer(layer, label);
}

/** Marker title and alternative text are initialization options in React Leaflet. */
export function synchronizeMarkerLabel(marker: L.Marker | null, label: string): void {
    if (!marker) return;
    marker.options.alt = label;
    marker.options.title = label;
    const element = marker.getElement();
    element?.setAttribute('title', label);
    element?.setAttribute('aria-label', label);
}

const NearbyParkingMarkers = React.memo(function NearbyParkingMarkers({
    spaces,
    onGroup,
}: {
    spaces: ParkingSpace[];
    onGroup: (group: L.FeatureGroup | null) => void;
}) {
    const markers = useMemo(
        () =>
            spaces.map((space) => (
                <Marker
                    key={space.id}
                    position={[space.latitude, space.longitude]}
                    icon={getParkingStatusIcon(space.status)}
                    interactive={false}
                    keyboard={false}
                    alt=""
                />
            )),
        [spaces],
    );
    return <FeatureGroup ref={onGroup}>{markers}</FeatureGroup>;
});

const NearbyMunicipalMarkers = React.memo(function NearbyMunicipalMarkers({
    spaces,
    onGroup,
}: {
    spaces: NonNullable<Props['nearbyMunicipalSpaces']>;
    onGroup: (group: L.FeatureGroup | null) => void;
}) {
    const markers = useMemo(
        () =>
            spaces.map((space) => (
                <Marker
                    key={space.id}
                    position={[space.latitude, space.longitude]}
                    icon={getVioletMarkerIcon()}
                    interactive={false}
                    keyboard={false}
                    alt=""
                />
            )),
        [spaces],
    );
    return <FeatureGroup ref={onGroup}>{markers}</FeatureGroup>;
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
    const { t } = useTranslation('frontend/map/main');
    const [layersControl, setLayersControl] = useState<L.Control.Layers | null>(null);
    const [satelliteLayer, setSatelliteLayer] = useState<L.TileLayer | null>(null);
    const [streetLayer, setStreetLayer] = useState<L.TileLayer | null>(null);
    const [nearbyGroup, setNearbyGroup] = useState<L.FeatureGroup | null>(null);
    const [municipalGroup, setMunicipalGroup] = useState<L.FeatureGroup | null>(null);
    const [selectedMarker, setSelectedMarker] = useState<L.Marker | null>(null);

    useEffect(() => {
        synchronizeLayerLabel(layersControl, satelliteLayer, t('controls.satellite'));
        synchronizeLayerLabel(layersControl, streetLayer, t('controls.streets'));
        synchronizeLayerLabel(layersControl, nearbyGroup, t('controls.nearby_spaces'), true);
        synchronizeLayerLabel(layersControl, municipalGroup, t('controls.municipal_spaces'), true);
        const toggle = layersControl?.getContainer()?.querySelector('.leaflet-control-layers-toggle');
        toggle?.setAttribute('title', t('controls.layers'));
        toggle?.setAttribute('aria-label', t('controls.layers'));
    }, [layersControl, satelliteLayer, streetLayer, nearbyGroup, municipalGroup, t]);

    useEffect(() => {
        synchronizeMarkerLabel(selectedMarker, t('results.selected'));
    }, [selectedMarker, t]);

    return (
        <div className="relative z-0">
            <MapContainer
                center={[latitude, longitude]}
                zoom={19}
                scrollWheelZoom={scrollWheelZoom}
                zoomControl={false}
                className={cn('w-full rounded-xl border', className)}
            >
                <LayersControl ref={setLayersControl} position="topright">
                    <BaseLayer checked name={t('controls.satellite')}>
                        <TileLayer
                            ref={setSatelliteLayer}
                            attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                            url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                            maxZoom={22}
                        />
                    </BaseLayer>

                    <BaseLayer name={t('controls.streets')}>
                        <TileLayer
                            ref={setStreetLayer}
                            attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                            maxZoom={22}
                        />
                    </BaseLayer>
                    {/* Overlay for nearby parking spaces */}
                    {nearbySpaces && nearbySpaces.length > 0 && (
                        <Overlay checked name={t('controls.nearby_spaces')}>
                            <NearbyParkingMarkers spaces={nearbySpaces} onGroup={setNearbyGroup} />
                        </Overlay>
                    )}
                    {nearbyMunicipalSpaces && nearbyMunicipalSpaces.length > 0 && (
                        <Overlay checked name={t('controls.municipal_spaces')}>
                            <NearbyMunicipalMarkers spaces={nearbyMunicipalSpaces} onGroup={setMunicipalGroup} />
                        </Overlay>
                    )}
                </LayersControl>

                <ZoomControl position="topleft" />
                {children}

                <Marker
                    ref={setSelectedMarker}
                    title={t('results.selected')}
                    alt={t('results.selected')}
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
