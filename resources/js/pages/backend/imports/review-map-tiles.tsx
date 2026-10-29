import type { MapStyle } from '@/components/map/map-display-controls';
import { TileLayer } from 'react-leaflet';

export default function ReviewTiles({ style }: { style: MapStyle }) {
    return style === 'streets' ? (
        <TileLayer
            key="streets"
            attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`}
            maxZoom={22}
            keepBuffer={4}
        />
    ) : (
        <TileLayer
            key="satellite"
            attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
            url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={20}
            keepBuffer={4}
        />
    );
}
