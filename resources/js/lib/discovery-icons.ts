import type { GarageBadge } from '@/lib/garage-occupancy';
import { pinSvg } from '@/lib/pin-svg';
import type { ParkingResult } from '@/types/destination';
import L from 'leaflet';

const icons = new Map<string, L.DivIcon>();

/** Street places share one pin; garages add their current occupancy badge, never an accessible-space claim. */
export function discoveryIcon(source: ParkingResult['source'], selected = false, badge: GarageBadge | null = null): L.DivIcon {
    const garage = source === 'offstreet';
    const key = `${garage ? `garage:${badge?.unavailable ? 'unavailable' : `${badge?.tone ?? ''}:${badge?.text ?? ''}`}` : 'street'}:${selected}`;
    let icon = icons.get(key);
    if (!icon) {
        icon = L.divIcon({
            html: `<span class="parking-marker-selected__ripple"></span><span class="parking-marker-selected__body">${pinSvg(garage, badge)}</span>`,
            className: `discovery-pin${selected ? ' discovery-pin-selected' : ''}`,
            iconSize: [36, 48],
            iconAnchor: [18, 46],
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

export function setMarkerSelected(marker: L.Marker, source: ParkingResult['source'], selected: boolean, badge: GarageBadge | null = null): void {
    cancelMarkerDeselection(marker);
    if (selected) {
        marker.setIcon(discoveryIcon(source, true, badge)).setZIndexOffset(1000);
        return;
    }
    const restore = () => {
        deselections.delete(marker);
        marker.setIcon(discoveryIcon(source, false, badge)).setZIndexOffset(0);
    };
    const element = marker.getElement();
    if (element && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.classList.add('parking-marker-deselecting');
        deselections.set(marker, setTimeout(restore, 200));
    } else restore();
}
