import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ZoomControl from './zoom-control';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

type Props = {
    latitude: number;
    longitude: number;
    onChange: (lat: number, lng: number) => void;
};

const { BaseLayer } = LayersControl;

const defaultIcon = L.icon({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export default function LocationPickerCard({ latitude, longitude, onChange }: Props) {
    return (
        <MapContainer
            center={[latitude, longitude]}
            zoom={19}
            scrollWheelZoom
            zoomControl={false}
            className="h-full min-h-[300px] w-full rounded-md border md:min-h-[500px]"
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
            </LayersControl>

            <ZoomControl position="topleft" />

            <DraggableMarker lat={latitude} lng={longitude} onChange={onChange} />
        </MapContainer>
    );
}

function DraggableMarker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
    return (
        <Marker
            draggable
            position={[lat, lng]}
            icon={defaultIcon}
            eventHandlers={{
                dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onChange(lat, lng);
                },
            }}
        />
    );
}
