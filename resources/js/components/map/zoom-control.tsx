import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface ZoomControlProps {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

export default function ZoomControl({ position = 'bottomright' }: ZoomControlProps) {
    const map = useMap();

    useEffect(() => {
        const zoomControl = L.control.zoom({ position });
        map.addControl(zoomControl);

        return () => {
            map.removeControl(zoomControl);
        };
    }, [map, position]);

    return null;
}
