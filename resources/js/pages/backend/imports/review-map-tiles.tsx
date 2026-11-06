import { AerialTiles, type AerialLayer } from '@/components/map/aerial-imagery';
import type { MapStyle } from '@/components/map/map-display-controls';
import { TileLayer } from 'react-leaflet';

export default function ReviewTiles({ style, aerial }: { style: MapStyle; aerial: AerialLayer | undefined }) {
    return style === 'streets' ? (
        <TileLayer
            key="streets"
            attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`}
            maxZoom={22}
            keepBuffer={4}
        />
    ) : (
        <AerialTiles layer={aerial} />
    );
}
