import { DomEvent, type LatLng, type Point } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const WHEEL_PIXELS_PER_LEVEL = 240;
const ZOOM_DURATION_SECONDS = 0.16;

/** Retarget the zoom during a wheel gesture, with at most one update per frame. */
export function SmoothWheelZoom() {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let frame: number | null = null;
        let targetZoom: number | null = null;
        let anchor: { pointer: Point; location: LatLng } | null = null;

        const resetTarget = () => {
            targetZoom = null;
            anchor = null;
            if (frame !== null) window.cancelAnimationFrame(frame);
            frame = null;
        };

        const move = () => {
            frame = null;
            if (targetZoom === null || !anchor) return;

            const offset = anchor.pointer.subtract(map.getSize().divideBy(2));
            const center = map.unproject(map.project(anchor.location, targetZoom).subtract(offset), targetZoom);
            if (reducedMotion.matches) {
                map.setView(center, targetZoom, { animate: false });
            } else {
                map.flyTo(center, targetZoom, { duration: ZOOM_DURATION_SECONDS });
            }
        };

        const onWheel = (event: WheelEvent) => {
            const delta = DomEvent.getWheelDelta(event);
            if (!delta) return;

            event.preventDefault();
            const zoom = targetZoom ?? map.getZoom();
            const nextZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom + delta / WHEEL_PIXELS_PER_LEVEL));
            if (nextZoom === zoom) return;

            targetZoom = nextZoom;
            const pointer = map.mouseEventToContainerPoint(event);
            if (!anchor?.pointer.equals(pointer)) {
                anchor = { pointer, location: map.containerPointToLatLng(pointer) };
            }
            if (frame === null) frame = window.requestAnimationFrame(move);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        map.on('moveend dragstart', resetTarget);

        return () => {
            container.removeEventListener('wheel', onWheel);
            map.off('moveend dragstart', resetTarget);
            resetTarget();
        };
    }, [map]);

    return null;
}
