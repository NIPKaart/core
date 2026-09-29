import { cn } from '@/lib/utils';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { newPlaceIcon } from './new-place-pin';

/**
 * A small, non-interactive map preview of one place.
 */
export default function StaticPinMap({
    latitude,
    longitude,
    className,
    zoom = 18,
}: {
    latitude: number;
    longitude: number;
    className?: string;
    zoom?: number;
}) {
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    return (
        <div className={cn('overflow-hidden', className)} aria-hidden>
            <MapContainer
                center={[latitude, longitude]}
                zoom={zoom}
                className="z-0 h-full w-full"
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                boxZoom={false}
                keyboard={false}
            >
                <TileLayer url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`} maxZoom={22} />
                <Marker position={[latitude, longitude]} icon={newPlaceIcon} interactive={false} keyboard={false} />
            </MapContainer>
        </div>
    );
}
