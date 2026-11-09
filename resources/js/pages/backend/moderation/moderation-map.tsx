import { AerialTiles, type AerialLayer } from '@/components/map/aerial-imagery';
import { pinSvg } from '@/lib/pin-svg';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { NUDGE_FAR_METRES, NUDGE_METRES, nudge, type Direction, type MapPoint } from './geo';

export type { MapPoint } from './geo';
export type MapLayer = keyof typeof TILES;

const PIN = 'M18 46C18 46 3 29.5 3 18a15 15 0 0 1 30 0c0 11.5-15 28-15 28z';
const shadow = 'filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 4px #1d4ed8)';

/** The parking space under review: the same blue wheelchair pin as the public map. */
const mainIcon = L.divIcon({
    html: `<span style="${shadow}">${pinSvg(false, null)}</span>`,
    className: 'cursor-grab',
    iconSize: [36, 48],
    iconAnchor: [18, 46],
});

/** Where the parking space was submitted or is now, while the pin shows another place. */
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

/**
 * Icons are built once per look and reused: a new icon object makes Leaflet replace the marker's element, which
 * would happen on every hover in the queue and drop keyboard focus from a pin.
 */
const icons = new Map<string, L.DivIcon>();
function cachedIcon(key: string, build: () => L.DivIcon): L.DivIcon {
    let icon = icons.get(key);
    if (!icon) {
        icon = build();
        icons.set(key, icon);
    }
    return icon;
}

const numberedIcon = (number: number) =>
    cachedIcon(`n${number}`, () =>
        L.divIcon({
            html: `<svg viewBox="0 0 36 48" width="26" height="35" aria-hidden="true" style="filter:drop-shadow(0 0 2px #fff)"><path d="${PIN}" fill="#1d4ed8" stroke="#fff" stroke-width="2.4"/><text x="18" y="23" text-anchor="middle" font-family="inherit" font-size="14" font-weight="700" fill="#fff">${number}</text></svg>`,
            className: '',
            iconSize: [26, 35],
            iconAnchor: [13, 34],
        }),
    );

/** The point a location proposal comes from, such as an NDW sign: a square, not a pin, because it is not a parking bay. */
const sourcePointIcon = L.divIcon({
    html: '<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;box-sizing:border-box;border:2px solid #fff;border-radius:4px;background:#1e3a8a;box-shadow:0 0 0 1px #1e3a8a,0 2px 6px rgba(0,0,0,.45)"><svg viewBox="0 0 21 21" width="14" height="14" aria-hidden="true"><g fill="#fff"><circle cx="9.5" cy="2.6" r="2.4"/><path d="M8.2 6h2.4l.4 5h5.1l3.1 6.6-2 .9-2.5-5.2H8.9z"/><path d="M6.4 9.3l.3 2.1a4.9 4.9 0 1 0 6.9 5.6l1.9.8A7 7 0 1 1 6.4 9.3z"/></g></svg></span>',
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

export type BayState = 'placed' | 'selected' | 'submitted';
export type BayMarker = { key: string; point: MapPoint; number: number; state: BayState; label: string };

/** A bay drawn in for a location proposal: white while placed, blue while selected, dark with a check once submitted. */
const bayIcon = (number: number, state: BayState) =>
    cachedIcon(`b${number}${state}`, () => {
        const [width, height] = state === 'selected' ? [36, 48] : [30, 40];
        const [fill, stroke, text] = {
            placed: ['#fff', '#1d4ed8', '#1d4ed8'],
            selected: ['#1d4ed8', '#fff', '#fff'],
            submitted: ['#171717', '#fff', '#fff'],
        }[state];
        const check =
            state === 'submitted'
                ? '<span style="position:absolute;right:-6px;top:-4px;display:flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#171717" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>'
                : '';
        return L.divIcon({
            html: `<span style="position:relative;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))"><svg viewBox="0 0 36 48" width="${width}" height="${height}" aria-hidden="true"><path d="${PIN}" fill="${fill}" stroke="${stroke}" stroke-width="${state === 'placed' ? 3 : 2.4}"/><text x="18" y="23" text-anchor="middle" font-family="inherit" font-size="15" font-weight="700" fill="${text}">${number}</text></svg>${check}</span>`,
            className: state === 'submitted' ? '' : 'cursor-grab',
            iconSize: [width, height],
            iconAnchor: [width / 2, height - 2],
        });
    });

/** An open item in the queue overview, in the colour of its kind; the one the moderator points at is larger. */
const queueIcon = (color: string, highlighted: boolean) =>
    cachedIcon(`q${color}${highlighted ? '+' : ''}`, () => {
        const [width, height] = highlighted ? [32, 43] : [22, 29];
        return L.divIcon({
            html: `<svg viewBox="0 0 36 48" width="${width}" height="${height}" aria-hidden="true" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="${PIN}" fill="${color}" stroke="#fff" stroke-width="2.6"/></svg>`,
            className: '',
            iconSize: [width, height],
            iconAnchor: [width / 2, height - 1],
        });
    });

const TILES = {
    streets: {
        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`,
        attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>',
        zoom: 17,
    },
    satellite: { zoom: 19 },
};

type QueuePin = { key: string; point: MapPoint; color: string; label: string; count?: number };

const municipalityIcon = (count: number, color: string) => {
    const label = count > 999 ? `${Math.floor(count / 1000)}k+` : String(count);
    return cachedIcon(`municipality-${color}-${label}`, () =>
        L.divIcon({
            html: `<span aria-hidden="true" class="flex size-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow" style="background:${color}">${label}</span>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        }),
    );
};

/**
 * The map the moderator works on: it fills the screen behind the panel. It shows the item under review with what
 * NIPKaart knows around it, the open items of the queue, or a numbered selection. When the item can be corrected,
 * its pin can be dragged, placed with a click, or moved with the arrow keys.
 */
export function ModerationMap({
    center,
    layer,
    aerial,
    nearby = [],
    municipal = [],
    current,
    proposed,
    numbered,
    queue,
    highlighted,
    onPick,
    onMove,
    movedLabel,
    sourcePoint,
    comparisonPoint,
    bays,
    onPlace,
    onMoveBay,
    onSelectBay,
    zoom,
    inset = 0,
    className,
    children,
}: {
    center: MapPoint;
    layer: MapLayer;
    /** The aerial photo shown on the satellite layer. */
    aerial?: AerialLayer;
    nearby?: MapPoint[];
    municipal?: MapPoint[];
    /** Where the parking space is now or was submitted, shown as a ghost when the pin is elsewhere. */
    current?: MapPoint | null;
    /** The location to show with the main pin when it differs from the centre. */
    proposed?: MapPoint | null;
    /** Several selected items, numbered in list order; replaces the main pin. */
    numbered?: MapPoint[];
    /** The open items of the queue; replaces the main pin. */
    queue?: QueuePin[];
    highlighted?: string | null;
    onPick?: (key: string) => void;
    /** Makes the main pin movable and reports where it went. */
    onMove?: (point: MapPoint) => void;
    /** A short label beside the ghost, such as the distance moved. */
    movedLabel?: string | null;
    /** The point a location proposal comes from; its bays are drawn in around it. */
    sourcePoint?: MapPoint | null;
    comparisonPoint?: MapPoint;
    /** Bays drawn in for a location proposal; replaces the main pin. */
    bays?: BayMarker[];
    /** A click on the map adds a bay there. */
    onPlace?: (point: MapPoint) => void;
    onMoveBay?: (key: string, point: MapPoint) => void;
    onSelectBay?: (key: string) => void;
    /** The zoom to open at, when the layer's own zoom is too close, such as for the whole country. */
    zoom?: number;
    /** Pixels on the left covered by the panel, kept out of the way when centring. */
    inset?: number;
    className?: string;
    children?: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const tiles = TILES[layer];
    const [map, setMap] = useState<L.Map | null>(null);
    const [focus, setFocus] = useState(0);
    const spread = numbered ?? queue?.map((pin) => pin.point);
    const points = spread?.map((point) => `${point.latitude},${point.longitude}`).join(';') ?? '';
    const bounds = useMemo(
        () => (points.includes(';') ? L.latLngBounds(points.split(';').map((point) => point.split(',').map(Number) as [number, number])) : null),
        [points],
    );
    const pin = proposed ?? center;
    const startZoom = zoom ?? tiles.zoom;

    return (
        <div className={cn('relative isolate overflow-hidden bg-[#e8e6e1]', className)}>
            <MapContainer
                ref={setMap}
                center={[center.latitude, center.longitude]}
                zoom={startZoom}
                zoomControl={false}
                attributionControl={false}
                className="absolute inset-0 z-0 size-full"
            >
                <Focus center={center} zoom={startZoom} bounds={bounds} inset={inset} focus={focus} />
                {layer === 'streets' ? (
                    <TileLayer key={layer} url={TILES.streets.url} attribution={TILES.streets.attribution} maxZoom={21} />
                ) : (
                    <AerialTiles layer={aerial} />
                )}
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
                            pathOptions={{ color: '#ffffff', dashArray: '5 4', weight: 2 }}
                            interactive={false}
                        />
                        <Marker position={[current.latitude, current.longitude]} icon={ghostIcon} interactive={false}>
                            {movedLabel && (
                                <Tooltip permanent direction="right" offset={[12, -18]}>
                                    {movedLabel}
                                </Tooltip>
                            )}
                        </Marker>
                    </>
                )}
                {comparisonPoint && (
                    <Marker position={[comparisonPoint.latitude, comparisonPoint.longitude]} icon={sourcePointIcon} interactive={false} />
                )}
                {sourcePoint && (
                    <Marker
                        position={[sourcePoint.latitude, sourcePoint.longitude]}
                        icon={sourcePointIcon}
                        title={t('map.source_point')}
                        keyboard={false}
                        zIndexOffset={-500}
                    />
                )}
                {bays ? (
                    bays.map((bay) => (
                        <BayPin
                            key={bay.key}
                            bay={bay}
                            onMove={bay.state === 'submitted' || !onMoveBay ? undefined : (point) => onMoveBay(bay.key, point)}
                            onSelect={bay.state === 'submitted' ? undefined : () => onSelectBay?.(bay.key)}
                        />
                    ))
                ) : queue ? (
                    queue.map((item) => (
                        <Marker
                            key={item.key}
                            position={[item.point.latitude, item.point.longitude]}
                            icon={
                                item.count === undefined ? queueIcon(item.color, item.key === highlighted) : municipalityIcon(item.count, item.color)
                            }
                            title={item.label}
                            zIndexOffset={item.key === highlighted ? 1000 : 0}
                            eventHandlers={{ click: () => onPick?.(item.key) }}
                        />
                    ))
                ) : numbered ? (
                    numbered.map((point, index) => (
                        <Marker key={`p${index}`} position={[point.latitude, point.longitude]} icon={numberedIcon(index + 1)} interactive={false} />
                    ))
                ) : (
                    <MainPin key={onMove ? 'movable' : 'fixed'} point={pin} onMove={onMove} label={t('map.pin')} />
                )}
                {onMove && !bays && <PlaceOnClick onMove={onMove} />}
                {onPlace && <PlaceOnClick onMove={onPlace} />}
            </MapContainer>
            {map && (
                <div className="absolute right-3 bottom-7 z-500 flex flex-col gap-2.5 lg:right-4 lg:bottom-6">
                    <button
                        type="button"
                        aria-label={t(spread ? 'map.fit_all' : 'map.recenter')}
                        onClick={() => setFocus((value) => value + 1)}
                        className="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-background text-foreground shadow-[0_2px_10px_rgba(0,0,0,0.14)] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:size-12"
                    >
                        <LocateFixed className="size-5" aria-hidden />
                    </button>
                    <div className="flex flex-col overflow-hidden rounded-xl bg-background shadow-[0_2px_10px_rgba(0,0,0,0.14)]">
                        <button
                            type="button"
                            aria-label={t('map.zoom_in')}
                            onClick={() => map.zoomIn()}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:w-12"
                        >
                            <Plus className="size-5" aria-hidden />
                        </button>
                        <button
                            type="button"
                            aria-label={t('map.zoom_out')}
                            onClick={() => map.zoomOut()}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:w-12"
                        >
                            <Minus className="size-5" aria-hidden />
                        </button>
                    </div>
                </div>
            )}
            {sourcePoint && bays && <BayLegend />}
            {children}
        </div>
    );
}

/** What the source point and the three pin states mean, beside the zoom buttons. Left out on small screens, where the map is small. */
function BayLegend() {
    const { t } = useTranslation('backend/moderation');
    const pin = (fill: string, stroke: string, width = 2.4) => (
        <svg viewBox="0 0 36 48" width="14" height="19" aria-hidden>
            <path d={PIN} fill={fill} stroke={stroke} strokeWidth={width} />
        </svg>
    );
    const items = [
        {
            key: 'source',
            icon: <span className="size-4 rounded-[3px] border-2 border-white bg-[#1e3a8a] shadow-[0_0_0_1px_#1e3a8a]" aria-hidden />,
            label: t('map.source_point'),
        },
        { key: 'selected', icon: pin('#1d4ed8', '#fff'), label: t('map.legend.selected') },
        { key: 'placed', icon: pin('#fff', '#1d4ed8', 3.5), label: t('map.legend.placed') },
        { key: 'submitted', icon: pin('#171717', '#fff'), label: t('map.legend.submitted') },
    ];

    return (
        <ul
            aria-label={t('map.legend.label')}
            className="absolute right-20 bottom-6 z-500 hidden items-center gap-4 rounded-xl bg-background px-3.5 py-2.5 text-xs shadow-[0_2px_10px_rgba(0,0,0,0.14)] lg:flex"
        >
            {items.map((item) => (
                <li key={item.key} className="flex items-center gap-1.5">
                    {item.icon}
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

/**
 * The pin of the item under review. When it can be corrected it is dragged into place, or focused and moved with
 * the arrow keys (Shift for bigger steps), so placing it never depends on dragging alone.
 */
function MainPin({ point, onMove, label }: { point: MapPoint; onMove?: (point: MapPoint) => void; label: string }) {
    const marker = useRef<L.Marker | null>(null);
    useArrowKeys(marker, point, onMove, label);

    return (
        <Marker
            ref={marker}
            position={[point.latitude, point.longitude]}
            icon={mainIcon}
            draggable={!!onMove}
            keyboard={!!onMove}
            interactive={!!onMove}
            zIndexOffset={1000}
            eventHandlers={{
                dragend: (event) => {
                    const { lat, lng } = (event.target as L.Marker).getLatLng();
                    onMove?.({ latitude: Math.round(lat * 1e7) / 1e7, longitude: Math.round(lng * 1e7) / 1e7 });
                },
            }}
        />
    );
}

/** A focused pin moves with the arrow keys (Shift for bigger steps), so placing it never depends on dragging alone. */
function useArrowKeys(
    marker: React.RefObject<L.Marker | null>,
    point: MapPoint,
    onMove: ((point: MapPoint) => void) | undefined,
    label: string,
    /** Changes whenever the icon does: Leaflet then replaces the element the keys listen on. */
    icon?: L.DivIcon,
) {
    const latest = useRef({ point, onMove });
    latest.current = { point, onMove };

    useEffect(() => {
        const element = marker.current?.getElement();
        if (!element || !onMove) return;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', label);
        const onKey = (event: KeyboardEvent) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const { point: from, onMove: move } = latest.current;
            move?.(nudge(from, event.key as Direction, event.shiftKey ? NUDGE_FAR_METRES : NUDGE_METRES));
        };
        element.addEventListener('keydown', onKey);
        return () => element.removeEventListener('keydown', onKey);
    }, [marker, onMove, label, icon]);
}

/** One drawn-in bay: dragged or moved with the arrow keys while it is not submitted, and selected with a click. */
function BayPin({ bay, onMove, onSelect }: { bay: BayMarker; onMove?: (point: MapPoint) => void; onSelect?: () => void }) {
    const marker = useRef<L.Marker | null>(null);
    const icon = bayIcon(bay.number, bay.state);
    useArrowKeys(marker, bay.point, onMove, bay.label, icon);

    return (
        <Marker
            ref={marker}
            position={[bay.point.latitude, bay.point.longitude]}
            icon={icon}
            title={bay.label}
            draggable={!!onMove}
            keyboard={!!onSelect}
            zIndexOffset={bay.state === 'selected' ? 1000 : 0}
            eventHandlers={{
                click: () => onSelect?.(),
                dragstart: () => onSelect?.(),
                dragend: (event) => {
                    const { lat, lng } = (event.target as L.Marker).getLatLng();
                    onMove?.({ latitude: Math.round(lat * 1e7) / 1e7, longitude: Math.round(lng * 1e7) / 1e7 });
                },
            }}
        />
    );
}

/** A click on the map places the pin there. */
function PlaceOnClick({ onMove }: { onMove: (point: MapPoint) => void }) {
    useMapEvents({
        click: (event) => onMove({ latitude: Math.round(event.latlng.lat * 1e7) / 1e7, longitude: Math.round(event.latlng.lng * 1e7) / 1e7 }),
    });
    return null;
}

/**
 * Centre the item, or keep every point in view, in the part of the map the panel leaves free. Runs again when the
 * item changes or the moderator asks to recentre, never while the pin is being moved.
 */
function Focus({
    center,
    zoom,
    bounds,
    inset,
    focus,
}: {
    center: MapPoint;
    zoom: number;
    bounds: L.LatLngBounds | null;
    inset: number;
    focus: number;
}) {
    const map = useMap();
    const key = `${center.latitude},${center.longitude}`;
    const previous = useRef<{ key: string; inset: number; focus: number } | null>(null);

    useEffect(() => {
        const last = previous.current;
        previous.current = { key, inset, focus };
        const panelChanged = last !== null && last.key === key && last.focus === focus && last.inset !== inset;
        const animate = panelChanged && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (bounds) {
            map.fitBounds(bounds, { paddingTopLeft: [inset + 48, 64], paddingBottomRight: [72, 48], maxZoom: 17, animate: false });
            return;
        }
        const targetZoom = panelChanged ? map.getZoom() : zoom;
        const target = map.unproject(map.project([center.latitude, center.longitude], targetZoom).subtract([inset / 2, 0]), targetZoom);
        map.setView(target, targetZoom, { animate, duration: 0.3 });
        // The centre is compared by value, so a new object for the same place does not move the map.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key, bounds, inset, focus]);

    return null;
}
