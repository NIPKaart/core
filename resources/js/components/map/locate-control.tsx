import { LocateControl as LeafletLocateControl } from 'leaflet.locatecontrol';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface Props {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

export default function LocateControl({ position = 'topleft' }: Props) {
    const map = useMap();

    useEffect(() => {
        const locateControl = new LeafletLocateControl({
            position,
            flyTo: true,
            showPopup: false,
            drawCircle: true,
            keepCurrentZoomLevel: false,
            strings: {
                title: 'Show my location',
            },
            locateOptions: {
                enableHighAccuracy: true,
            },
        });

        map.addControl(locateControl);

        return () => {
            locateControl.stop();
            map.removeControl(locateControl);
        };
    }, [map, position]);

    return null;
}
