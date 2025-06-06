import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

function parseHash(): { zoom: number; lat: number; lng: number } | null {
    if (!window.location.hash) return null;
    const match = window.location.hash.match(/^#(\d+(\.\d+)?)[/|,](-?\d+(\.\d+)?)[/|,](-?\d+(\.\d+)?)/);
    if (!match) return null;
    const zoom = parseFloat(match[1]);
    const lat = parseFloat(match[3]);
    const lng = parseFloat(match[5]);
    if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) return null;
    return { zoom, lat, lng };
}

export function HashSync() {
    const map = useMap();

    // On load: set map position from hash (only on mount)
    useEffect(() => {
        const pos = parseHash();
        if (pos) {
            // Prevent the card from immediately triggering itself again if it is already correct
            const current = map.getCenter();
            const currentZoom = map.getZoom();
            if (Math.abs(current.lat - pos.lat) > 1e-5 || Math.abs(current.lng - pos.lng) > 1e-5 || currentZoom !== pos.zoom) {
                map.setView([pos.lat, pos.lng], pos.zoom, { animate: false });
            }
        }
    }, [map]);

    // Every time the card moves: update hash
    useEffect(() => {
        const onMove = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            window.location.hash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
        };
        map.on('moveend', onMove);
        return () => {
            map.off('moveend', onMove);
        };
    }, [map]);

    // Optional: update the map if someone manually changes the hash (browser back/forward)
    useEffect(() => {
        const onHashChange = () => {
            const pos = parseHash();
            if (pos) {
                const center = map.getCenter();
                if (Math.abs(center.lat - pos.lat) > 1e-5 || Math.abs(center.lng - pos.lng) > 1e-5 || map.getZoom() !== pos.zoom) {
                    map.setView([pos.lat, pos.lng], pos.zoom, { animate: false });
                }
            }
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [map]);

    return null;
}
