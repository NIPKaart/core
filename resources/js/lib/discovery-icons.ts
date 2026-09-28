import type { GarageBadge } from '@/lib/garage-occupancy';
import type { ParkingResult } from '@/types/destination';
import L from 'leaflet';

const icons = new Map<string, L.DivIcon>();

const TONES: Record<GarageBadge['tone'], string> = { green: '#15803d', orange: '#c2410c', red: '#b91c1c', grey: '#6b7280' };

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** One pin shape for every source: blue with a wheelchair for street places, dark with a P for garages. */
const PIN = 'M18 46C18 46 3 29.5 3 18a15 15 0 0 1 30 0c0 11.5-15 28-15 28z';
const WHEELCHAIR =
    '<g transform="translate(8.5 7.5) scale(.85)" fill="#fff"><circle cx="9.5" cy="2.6" r="2.4"/><path d="M8.2 6h2.4l.4 5h5.1l3.1 6.6-2 .9-2.5-5.2H8.9z"/><path d="M6.4 9.3l.3 2.1a4.9 4.9 0 1 0 6.9 5.6l1.9.8A7 7 0 1 1 6.4 9.3z"/></g>';
const LETTER_P = '<text x="18" y="24.5" text-anchor="middle" font-family="inherit" font-weight="700" font-size="17" fill="#fff">P</text>';

export function pinSvg(garage: boolean, badge: GarageBadge | null): string {
    const fill = !garage ? '#1d4ed8' : badge?.tone === 'grey' ? '#6b7280' : '#27313a';
    let label = '';
    if (badge) {
        // Bold and at least 14px: the free count is the main information on a garage marker.
        const size = /^[\d.,\s]+$/.test(badge.text) ? 14 : 12.5;
        const width = Math.round(badge.text.length * size * 0.62 + 16);
        label = `<g transform="translate(24 -4)"><rect width="${width}" height="22" rx="11" fill="${TONES[badge.tone]}" stroke="#fff" stroke-width="2"/><text x="${width / 2}" y="15.5" text-anchor="middle" font-family="inherit" font-weight="800" font-size="${size}" fill="#fff">${escape(badge.text)}</text></g>`;
    }

    return `<svg viewBox="0 0 36 48" width="36" height="48" aria-hidden="true" focusable="false"><path d="${PIN}" fill="${fill}" stroke="#fff" stroke-width="2.4"/>${garage ? LETTER_P : WHEELCHAIR}${label}</svg>`;
}

/** Street places share one pin; garages add their current occupancy badge, never an accessible-space claim. */
export function discoveryIcon(source: ParkingResult['source'], selected = false, badge: GarageBadge | null = null): L.DivIcon {
    const garage = source === 'offstreet';
    const key = `${garage ? `garage:${badge?.tone ?? ''}:${badge?.text ?? ''}` : 'street'}:${selected}`;
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
