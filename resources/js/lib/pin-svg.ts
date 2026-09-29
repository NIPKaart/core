import type { GarageBadge } from '@/lib/garage-occupancy';

const TONES: Record<GarageBadge['tone'], string> = { green: '#15803d', orange: '#c2410c', red: '#b91c1c', grey: '#6b7280' };

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** One pin shape for every source: blue with a wheelchair for street places, dark with a P for garages. */
const PIN = 'M18 46C18 46 3 29.5 3 18a15 15 0 0 1 30 0c0 11.5-15 28-15 28z';
const WHEELCHAIR =
    '<g transform="translate(8.5 7.5) scale(.85)" fill="#fff"><circle cx="9.5" cy="2.6" r="2.4"/><path d="M8.2 6h2.4l.4 5h5.1l3.1 6.6-2 .9-2.5-5.2H8.9z"/><path d="M6.4 9.3l.3 2.1a4.9 4.9 0 1 0 6.9 5.6l1.9.8A7 7 0 1 1 6.4 9.3z"/></g>';
const LETTER_P = '<text x="18" y="24.5" text-anchor="middle" font-family="inherit" font-weight="700" font-size="17" fill="#fff">P</text>';

export function pinSvg(garage: boolean, badge: GarageBadge | null): string {
    // Only a closed garage turns grey; missing live data keeps the dark pin with a warning dot.
    const fill = !garage ? '#1d4ed8' : badge?.tone === 'grey' && !badge.unavailable ? '#6b7280' : '#27313a';
    let label = '';
    if (badge?.unavailable) {
        // Live data temporarily missing: a warning dot where the badge would be, never a count.
        label =
            '<g transform="translate(24 -4)"><circle cx="11" cy="11" r="11" fill="#d97706" stroke="#fff" stroke-width="2"/><rect x="9.6" y="4.5" width="2.8" height="8.5" rx="1.4" fill="#fff"/><circle cx="11" cy="16.6" r="1.7" fill="#fff"/></g>';
    } else if (badge) {
        // Bold and at least 14px: the free count is the main information on a garage marker.
        const size = /^[\d.,\s]+$/.test(badge.text) ? 14 : 12.5;
        const width = Math.round(badge.text.length * size * 0.62 + 16);
        label = `<g transform="translate(24 -4)"><rect width="${width}" height="22" rx="11" fill="${TONES[badge.tone]}" stroke="#fff" stroke-width="2"/><text x="${width / 2}" y="15.5" text-anchor="middle" font-family="inherit" font-weight="800" font-size="${size}" fill="#fff">${escape(badge.text)}</text></g>`;
    }

    return `<svg viewBox="0 0 36 48" width="36" height="48" aria-hidden="true" focusable="false"><path d="${PIN}" fill="${fill}" stroke="#fff" stroke-width="2.4"/>${garage ? LETTER_P : WHEELCHAIR}${label}</svg>`;
}
