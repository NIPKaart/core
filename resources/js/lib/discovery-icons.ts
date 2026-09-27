import type { ParkingResult } from '@/types/destination';
import L from 'leaflet';

const icons = new Map<string, L.DivIcon>();

/** Neutral garage signs never imply live accessible-space availability. */
export function discoveryIcon(source: ParkingResult['source'], selected = false): L.DivIcon {
    const garage = source === 'offstreet';
    const key = `${garage ? 'garage' : 'street'}:${selected}`;
    let icon = icons.get(key);
    if (!icon) {
        icon = L.divIcon({
            html: `<span class="parking-marker-selected__ripple"></span><span class="parking-marker-selected__body"><img src="${garage ? '/assets/images/boards/e105-grey.png' : '/assets/images/boards/accessible-pin.png'}" alt="" /></span>`,
            className: `discovery-pin${garage ? ' discovery-pin-garage' : ''}${selected ? ' discovery-pin-selected' : ''}`,
            iconSize: garage ? [36, 36] : [54, 72],
            iconAnchor: garage ? [18, 36] : [27, 60],
        });
        icons.set(key, icon);
    }
    return icon;
}

/** Matches the original deselection duration in app.css; reselection cancels the pending icon swap. */
const deselections = new WeakMap<L.Marker, ReturnType<typeof setTimeout>>();

export function cancelMarkerDeselection(marker: L.Marker): void {
    clearTimeout(deselections.get(marker));
    deselections.delete(marker);
}

export function setMarkerSelected(marker: L.Marker, source: ParkingResult['source'], selected: boolean): void {
    cancelMarkerDeselection(marker);
    if (selected) {
        marker.setIcon(discoveryIcon(source, true)).setZIndexOffset(1000);
        return;
    }
    const restore = () => {
        deselections.delete(marker);
        marker.setIcon(discoveryIcon(source)).setZIndexOffset(0);
    };
    const element = marker.getElement();
    if (element && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.classList.add('parking-marker-deselecting');
        deselections.set(marker, setTimeout(restore, 200));
    } else restore();
}
