import { pinSvg } from '@/lib/pin-svg';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';

export type MapPoint = { latitude: number; longitude: number };

const PIN = 'M18 46C18 46 3 29.5 3 18a15 15 0 0 1 30 0c0 11.5-15 28-15 28z';
const shadow = 'filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 4px #1d4ed8)';

/** The parking space under review: the same blue wheelchair pin as the public map. */
const mainIcon = L.divIcon({
    html: `<span style="${shadow}">${pinSvg(false, null)}</span>`,
    className: '',
    iconSize: [36, 48],
    iconAnchor: [18, 46],
});

/** Where the space is now, while an improvement proposes another place. */
const ghostIcon = L.divIcon({
    html: `<svg viewBox="0 0 36 48" width="30" height="40" aria-hidden="true"><path d="${PIN}" fill="#fff" fill-opacity=".85" stroke="#737373" stroke-width="2" stroke-dasharray="4 3"/></svg>`,
    className: '',
    iconSize: [30, 40],
    iconAnchor: [15, 38],
});

const dot = (color: string) =>
    L.divIcon({
        html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
const nearbyIcon = dot('#16a34a');
const municipalIcon = dot('#7c3aed');

const numberedIcon = (number: number) =>
    L.divIcon({
        html: `<svg viewBox="0 0 36 48" width="26" height="35" aria-hidden="true" style="filter:drop-shadow(0 0 2px #fff)"><path d="${PIN}" fill="#1d4ed8" stroke="#fff" stroke-width="2.4"/><text x="18" y="23" text-anchor="middle" font-family="inherit" font-size="14" font-weight="700" fill="#fff">${number}</text></svg>`,
        className: '',
        iconSize: [26, 35],
        iconAnchor: [13, 34],
    });

const TILES = {
    streets: {
        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`,
        attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>',
        subdomains: [] as string[],
        zoom: 17,
    },
    satellite: {
        url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        zoom: 19,
    },
};

/**
 * A quiet map for weighing one item: the public map's streets or an aerial photo, without controls, so the
 * moderator's own buttons and labels sit on top. Scrolling the page never zooms it.
 */
export function ModerationMap({
    center,
    layer,
    nearby = [],
    municipal = [],
    current,
    proposed,
    numbered,
    className,
    children,
}: {
    center: MapPoint;
    layer: keyof typeof TILES;
    nearby?: MapPoint[];
    municipal?: MapPoint[];
    /** Where the space is now, shown as a ghost when an improvement moves it. */
    current?: MapPoint | null;
    /** The location to show with the main pin when it differs from the centre. */
    proposed?: MapPoint | null;
    /** Several selected items, numbered in list order; replaces the main pin. */
    numbered?: MapPoint[];
    className?: string;
    children?: React.ReactNode;
}) {
    const tiles = TILES[layer];
    const points = numbered?.map((point) => `${point.latitude},${point.longitude}`).join(';') ?? '';
    const bounds = useMemo(
        () => (points.includes(';') ? L.latLngBounds(points.split(';').map((point) => point.split(',').map(Number) as [number, number])) : null),
        [points],
    );
    const pin = proposed ?? center;

    return (
        <div className={cn('relative isolate overflow-hidden rounded-xl border bg-[#e8e6e1]', className)}>
            <MapContainer
                center={[center.latitude, center.longitude]}
                zoom={tiles.zoom}
                zoomControl={false}
                attributionControl={false}
                scrollWheelZoom={false}
                className="absolute inset-0 z-0 size-full"
            >
                {bounds && <FitBounds bounds={bounds} />}
                <TileLayer url={tiles.url} attribution={tiles.attribution} subdomains={tiles.subdomains} maxZoom={21} />
                {nearby.map((point, index) => (
                    <Marker key={`n${index}`} position={[point.latitude, point.longitude]} icon={nearbyIcon} interactive={false} />
                ))}
                {municipal.map((point, index) => (
                    <Marker key={`m${index}`} position={[point.latitude, point.longitude]} icon={municipalIcon} interactive={false} />
                ))}
                {current && (
                    <>
                        <Polyline
                            positions={[
                                [current.latitude, current.longitude],
                                [pin.latitude, pin.longitude],
                            ]}
                            pathOptions={{ color: '#171717', dashArray: '5 4', weight: 2 }}
                            interactive={false}
                        />
                        <Marker position={[current.latitude, current.longitude]} icon={ghostIcon} interactive={false} />
                    </>
                )}
                {numbered ? (
                    numbered.map((point, index) => (
                        <Marker key={`p${index}`} position={[point.latitude, point.longitude]} icon={numberedIcon(index + 1)} interactive={false} />
                    ))
                ) : (
                    <Marker position={[pin.latitude, pin.longitude]} icon={mainIcon} interactive={false} />
                )}
            </MapContainer>
            {children}
        </div>
    );
}

/** Keep every selected item in view, also when the selection changes. */
function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
    const map = useMap();
    useEffect(() => {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }, [map, bounds]);
    return null;
}

/** A dark label in the map's top-left corner, naming what the view shows. */
export function MapTag({ children }: { children: React.ReactNode }) {
    return (
        <span className="pointer-events-none absolute top-2.5 left-2.5 z-[400] flex h-6 items-center rounded-md bg-black/65 px-2.5 text-xs font-medium text-white">
            {children}
        </span>
    );
}

/** A white button floating on the map. */
export function MapChip({ children, className, ...props }: React.ComponentProps<'a'>) {
    return (
        <a
            {...props}
            className={cn(
                'absolute top-2.5 right-2.5 z-[400] flex h-[34px] items-center gap-1.5 rounded-[9px] bg-white/95 px-[11px] text-[13px] font-medium text-neutral-950 shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-white focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5',
                className,
            )}
        >
            {children}
        </a>
    );
}

/** The colours on the map, explained in its bottom-left corner. */
export function MapLegend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] flex h-[26px] items-center gap-3 rounded-[7px] bg-white/95 px-2.5 text-xs text-neutral-950 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            {items.map((item) => (
                <span key={item.label} className="flex items-center gap-[5px]">
                    <span className="size-2 rounded-full" style={{ background: item.color }} aria-hidden />
                    {item.label}
                </span>
            ))}
        </div>
    );
}
