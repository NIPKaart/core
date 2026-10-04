import { getParkingStatusIcon, getVioletMarkerIcon } from '@/lib/icon-factory';
import { cn } from '@/lib/utils';
import { latLngBounds } from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import ZoomControl from './zoom-control';

export type MapPlace = { id: string | number; latitude: number; longitude: number; label: string | null; url: string };

/** The Netherlands, for a person who has not added or saved anything yet. */
const NETHERLANDS: [number, number] = [52.2, 5.3];

/**
 * A person's own parking spaces, coloured by review status, and the places they saved, framed to fit them all.
 */
export default function ContributionsMap({
    spaces,
    favorites,
    className,
}: {
    spaces: (MapPlace & { status: string })[];
    favorites: MapPlace[];
    className?: string;
}) {
    const bounds = useMemo(() => {
        const points = [...spaces, ...favorites].map((place) => [place.latitude, place.longitude] as [number, number]);
        return points.length > 1 ? latLngBounds(points).pad(0.15) : null;
    }, [spaces, favorites]);
    const single = spaces[0] ?? favorites[0];

    return (
        <div className="relative z-0">
            <MapContainer
                bounds={bounds ?? undefined}
                center={bounds ? undefined : single ? [single.latitude, single.longitude] : NETHERLANDS}
                zoom={bounds ? undefined : single ? 16 : 7}
                scrollWheelZoom={false}
                zoomControl={false}
                className={cn('w-full rounded-xl border', className)}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    maxZoom={22}
                />
                <ZoomControl position="topleft" />
                {spaces.map((space) => (
                    <Marker
                        key={`space-${space.id}`}
                        position={[space.latitude, space.longitude]}
                        icon={getParkingStatusIcon(space.status)}
                        eventHandlers={{ click: () => window.location.assign(space.url) }}
                    >
                        {space.label && <Tooltip>{space.label}</Tooltip>}
                    </Marker>
                ))}
                {favorites.map((favorite) => (
                    <Marker
                        key={`favorite-${favorite.id}`}
                        position={[favorite.latitude, favorite.longitude]}
                        icon={getVioletMarkerIcon()}
                        eventHandlers={{ click: () => window.location.assign(favorite.url) }}
                    >
                        {favorite.label && <Tooltip>{favorite.label}</Tooltip>}
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
