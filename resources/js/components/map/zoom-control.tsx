import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface ZoomControlProps {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    /** When set, the buttons zoom towards this point (for example the selected location) instead of the view centre. */
    focus?: L.LatLngTuple | null;
}

function zoomTowards(map: L.Map, focus: L.LatLngTuple | null, direction: 1 | -1, event: MouseEvent): void {
    // Same step as Leaflet's own buttons, including the larger step with Shift.
    const delta = (map.options.zoomDelta ?? 1) * (event.shiftKey ? 3 : 1) * direction;
    const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), map.getZoom() + delta));
    if (zoom === map.getZoom()) return;

    if (!focus) {
        map.setZoom(zoom);
    } else if (map.getBounds().contains(focus)) {
        map.setView(focus, zoom);
    } else {
        // Leaflet cannot animate a zoom to a point outside the view, so fly there instead of jumping.
        map.flyTo(focus, zoom, { duration: 0.5 });
    }
}

export default function ZoomControl({ position = 'bottomright', focus = null }: ZoomControlProps) {
    const map = useMap();
    const focusRef = useRef(focus);

    useEffect(() => {
        focusRef.current = focus;
    }, [focus]);

    useEffect(() => {
        const FocusZoom = L.Control.Zoom.extend({
            _zoomIn: (event: MouseEvent) => zoomTowards(map, focusRef.current, 1, event),
            _zoomOut: (event: MouseEvent) => zoomTowards(map, focusRef.current, -1, event),
        });
        const zoomControl: L.Control.Zoom = new FocusZoom({ position });
        map.addControl(zoomControl);

        return () => {
            map.removeControl(zoomControl);
        };
    }, [map, position]);

    return null;
}
