import { cn } from '@/lib/utils';
import L from 'leaflet';

const PATH = 'M22 2C11 2 3 10.4 3 21c0 14 19 33 19 33s19-19 19-33C41 10.4 33 2 22 2z';

/** SVG markup of the orange pin that marks a place being added; grey when the location cannot be used. */
export function newPlacePinSvg(muted = false): string {
    return `<svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true"><path d="${PATH}" fill="${muted ? '#a3a3a3' : '#ea580c'}" stroke="#fff" stroke-width="3"/><path d="M22 14v14M15 21h14" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>`;
}

export const newPlaceIcon = L.divIcon({ html: newPlacePinSvg(), className: 'new-place-pin', iconSize: [44, 56], iconAnchor: [22, 55] });

/**
 * A pin fixed at the centre of the map; the contributor moves the map underneath it.
 */
export function CenterPin({ muted = false, lifted = false }: { muted?: boolean; lifted?: boolean }) {
    return (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-[500]" aria-hidden>
            <span className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/30" style={{ width: 18, height: 6 }} />
            <span
                className={cn(
                    'absolute -translate-x-1/2 -translate-y-full transition-transform duration-150',
                    lifted && '-translate-y-[calc(100%+8px)]',
                )}
                dangerouslySetInnerHTML={{ __html: newPlacePinSvg(muted) }}
            />
        </div>
    );
}
