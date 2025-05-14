import 'leaflet/dist/leaflet.css';
import { LayersControl, MapContainer, Marker, TileLayer } from 'react-leaflet';
import ZoomControl from './zoom-control';

type Props = {
    latitude: number;
    longitude: number;
    onChange: (lat: number, lng: number) => void;
};

const { BaseLayer } = LayersControl;

export default function LocationPickerCard({ latitude, longitude, onChange }: Props) {
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    return (
        <MapContainer
            center={[latitude, longitude]}
            zoom={19}
            scrollWheelZoom
            zoomControl={false}
            className="h-full min-h-[300px] w-full rounded-md border md:min-h-[500px]"
        >
            <LayersControl position="topright">
                <BaseLayer name="Mapbox Streets">
                    <TileLayer
                        attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                        url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                        tileSize={512}
                        zoomOffset={-1}
                    />
                </BaseLayer>

                <BaseLayer checked name="Google Hybrid">
                    <TileLayer
                        attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                        url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
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
            eventHandlers={{
                dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onChange(lat, lng);
                },
            }}
        />
    );
}
