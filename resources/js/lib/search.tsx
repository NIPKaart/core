import type { Hit } from '@/types/search';
import { Building2, LucideIcon, MapPin, SquareParking } from 'lucide-react';
import { ReactNode } from 'react';

export type SearchResponse = {
    hits: Hit[];
    estimatedTotalHits?: number;
};

type HitIconProps = {
    type: Hit['type'] | 'other';
    className?: string;
    iconMap?: typeof ICON_MAP_DEFAULT;
    label?: string;
};

export const ICON_MAP_DEFAULT: Record<Hit['type'] | 'other', LucideIcon> = {
    offstreet: Building2,
    community: SquareParking,
    municipal: MapPin,
    other: MapPin,
};

/**
 * Perform a search query to our API route, which proxies to Meilisearch.
 */
export async function searchApi(q: string, signal?: AbortSignal, limit = 10): Promise<SearchResponse> {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    const res = await fetch(`/api/search?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
}

/**
 * Standard zoom per type when linking directly to the map.
 */
export const ZOOM_BY_TYPE: Record<Hit['type'] | 'other', number> = {
    community: 18,
    municipal: 18,
    offstreet: 16,
    other: 14,
};

/**
 * Generate a map deep link if we have lat/lng, otherwise fall back to hit.href.
 * You can optionally provide your own zoomMap to override defaults.
 */
export function mapHref(h: Hit, zoomMap: Partial<Record<Hit['type'], number>> = {}): string {
    const z = zoomMap[h.type] ?? ZOOM_BY_TYPE[h.type] ?? 16;
    const { lat, lng, href } = h;

    if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
        return `/map#${z}/${lat.toFixed(5)}/${lng.toFixed(5)}`;
    }
    return href;
}

/**
 * Highlight only the first (case-insensitive) match of q in text with a <mark>.
 */
export function highlight(text: string, q: string): ReactNode {
    const s = q.trim();
    if (!s) return text;

    const hay = text.toLowerCase();
    const needle = s.toLowerCase();
    const i = hay.indexOf(needle);
    if (i === -1) return text;

    return (
        <>
            {text.slice(0, i)}
            <mark className="rounded bg-yellow-200/50 px-0.5 font-medium dark:bg-yellow-300/20">{text.slice(i, i + s.length)}</mark>
            {text.slice(i + s.length)}
        </>
    );
}

export function HitIcon({ type, className = 'h-4 w-4', iconMap = ICON_MAP_DEFAULT, label }: HitIconProps) {
    const Icon = iconMap[type] ?? iconMap.other ?? MapPin;

    const a11yProps = label ? ({ role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true } as const);

    return (
        <Icon className={className} focusable={false} {...a11yProps}>
            {label ? <title>{label}</title> : null}
        </Icon>
    );
}
