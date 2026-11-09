import { AerialPicker, useAerialImagery, type AerialLayer } from '@/components/map/aerial-imagery';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Camera, ChevronLeft, ChevronRight, Layers, MousePointer2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegendList, ModerationMap, type LegendItem, type MapLayer, type MapPoint } from './moderation-map';
import type { ItemLink, Position } from './types';

/** The panel's width plus its margins, so the map keeps what the panel covers out of the way. */
const PANEL_INSET = 452;
/** With the editor open beside the panel: both panels and their margins. */
const EDITOR_INSET = PANEL_INSET + 380 + 16;

type MapProps = Omit<React.ComponentProps<typeof ModerationMap>, 'layer' | 'inset' | 'insetBottom' | 'className' | 'controls' | 'links' | 'children'>;

/** The layer the moderator chose last, separately for weighing one item and for looking over the queue. */
function useLayer(scope: 'item' | 'overview'): [MapLayer, (layer: MapLayer) => void] {
    const key = `moderation.layer.${scope}`;
    const fallback: MapLayer = scope === 'item' ? 'satellite' : 'streets';
    const [layer, setLayer] = useState<MapLayer>(() => {
        try {
            const stored = window.localStorage.getItem(key);
            return stored === 'streets' || stored === 'satellite' ? stored : fallback;
        } catch {
            return fallback;
        }
    });

    return [
        layer,
        (next) => {
            setLayer(next);
            try {
                window.localStorage.setItem(key, next);
            } catch {
                // The choice simply is not remembered.
            }
        },
    ];
}

/** How far the panel is open on a small screen: just its top and the decision, half the screen, or nearly all of it. */
type Snap = 'peek' | 'half' | 'full';

/** Height of the panel when lowered: the navigation, the title and the decision buttons. */
const PEEK = 256;
/** What stays of the map above the panel when it is fully open. */
const FULL_TOP = 48;
const HALF = 0.45;

/** The top of the panel for each height, in pixels from the top of the workspace. */
export function sheetTops(height: number): Record<Snap, number> {
    return { peek: Math.max(FULL_TOP, height - PEEK), half: Math.round(height * HALF), full: FULL_TOP };
}

/** The height nearest to where the moderator let go of the panel. */
export function nearestSnap(top: number, height: number): Snap {
    const tops = sheetTops(height);
    return (Object.keys(tops) as Snap[]).reduce((best, snap) => (Math.abs(tops[snap] - top) < Math.abs(tops[best] - top) ? snap : best), 'half');
}

/**
 * The moderation workspace: the map fills the screen and one panel floats beside it, as on the public map. The panel
 * switches between the queue, one item, a decision and a selection; the map follows what the panel shows. On a small
 * screen the panel is a sheet over the map with three heights, and the map keeps what it shows above the sheet.
 */
export function Workspace({
    scope,
    map,
    streetView,
    imageryLayers,
    label,
    aside,
    asideLabel,
    mapHint,
    expanded = false,
    children,
}: {
    scope: 'item' | 'overview';
    map: MapProps;
    /** What a click on the map does now, as a label over the map. */
    mapHint?: string;
    /** Where Street View should open, for an item. */
    streetView?: MapPoint | null;
    imageryLayers?: AerialLayer[];
    label: string;
    /** A second panel beside the first, such as the details editor; a sheet over the item on small screens. */
    aside?: React.ReactNode;
    asideLabel?: string;
    /** Opens the sheet fully on a small screen, for example while a reason is chosen. */
    expanded?: boolean;
    children: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const [layer, setLayer] = useLayer(scope);
    const imagery = useAerialImagery(imageryLayers);
    const wide = useMediaQuery('(min-width: 1024px)');
    const street = streetView ? streetViewUrl(streetView.latitude, streetView.longitude) : null;
    const sheet = useSheet(!wide, expanded);

    const views = (
        <ToggleGroup
            type="single"
            value={layer}
            onValueChange={(value) => value && setLayer(value as MapLayer)}
            aria-label={t('review.views.label')}
            className="gap-1"
        >
            {(['streets', 'satellite'] as const).map((option) => (
                <ToggleGroupItem
                    key={option}
                    value={option}
                    className="h-9 cursor-pointer rounded-[9px] px-3.5 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                    {t(option === 'streets' ? 'review.views.map' : 'review.views.aerial')}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );

    return (
        <div ref={sheet.root} className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden">
            <h1 className="sr-only">{t('title')}</h1>
            <ModerationMap
                {...map}
                layer={layer}
                aerial={imagery.layer}
                inset={wide ? (aside ? EDITOR_INSET : PANEL_INSET) : 0}
                insetBottom={wide ? 0 : sheet.covered}
                className="absolute inset-0"
                controls={
                    wide ? (
                        <div className="flex gap-1 rounded-xl bg-background p-1 shadow-[0_2px_10px_rgba(0,0,0,0.14)]">
                            {views}
                            {layer === 'satellite' && <AerialPicker layers={imagery.layers} layer={imagery.layer} onChoose={imagery.choose} />}
                        </div>
                    ) : (
                        (legend) => <LayersMenu layer={layer} onLayer={setLayer} imagery={imagery} legend={legend} />
                    )
                }
                links={
                    street && (
                        <Button variant="outline" asChild className="h-11 rounded-xl border-0 bg-background shadow-[0_2px_10px_rgba(0,0,0,0.14)]">
                            <a href={street} target="_blank" rel="noreferrer" aria-label={wide ? undefined : t('review.views.street_view')}>
                                <Camera aria-hidden />
                                <span className="max-lg:sr-only">{t('review.views.street_view')}</span>
                            </a>
                        </Button>
                    )
                }
            >
                {mapHint && (
                    <p
                        role="status"
                        style={wide ? undefined : { bottom: sheet.covered + 12 }}
                        className={cn(
                            'pointer-events-none absolute bottom-3 left-1/2 z-500 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full bg-neutral-900 px-3 text-[13px] font-medium whitespace-nowrap text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] lg:bottom-8',
                            aside ? 'lg:left-[calc(50%_+_424px)]' : 'lg:left-[calc(50%_+_226px)]',
                        )}
                    >
                        <MousePointer2 className="size-[15px]" aria-hidden />
                        {mapHint}
                    </p>
                )}
            </ModerationMap>
            <section
                aria-label={label}
                style={wide ? undefined : sheet.style}
                onFocus={wide ? undefined : sheet.onFocus}
                onScrollCapture={wide ? undefined : sheet.onScroll}
                className={cn(
                    'absolute inset-x-0 bottom-0 z-500 flex flex-col overflow-hidden rounded-t-2xl bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(0,0,0,0.16)] duration-300 ease-out motion-reduce:transition-none',
                    sheet.dragging ? 'transition-none' : 'transition-[top,opacity,translate]',
                    'top-[45%] lg:top-4 lg:right-auto lg:bottom-4 lg:left-4 lg:w-[420px] lg:rounded-2xl lg:pb-0 lg:shadow-[0_8px_28px_rgba(0,0,0,0.16)] starting:opacity-0',
                    scope === 'item' ? 'lg:starting:translate-x-4' : 'lg:starting:-translate-x-4',
                    'motion-reduce:starting:translate-x-0 motion-reduce:starting:translate-y-0 max-lg:starting:translate-y-6',
                )}
            >
                {!wide && <SheetGrip sheet={sheet} />}
                {children}
            </section>
            {aside &&
                (wide ? (
                    <section
                        aria-label={asideLabel}
                        className="absolute top-4 bottom-4 left-[452px] z-500 flex w-[380px] flex-col overflow-hidden rounded-2xl bg-background shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none starting:-translate-x-5 starting:opacity-0 motion-reduce:starting:translate-x-0"
                    >
                        {aside}
                    </section>
                ) : (
                    <Sheet label={asideLabel}>{aside}</Sheet>
                ))}
        </div>
    );
}

/**
 * The panel's height on a small screen. It starts half open; dragging the grip moves it and lets go at the nearest
 * height, a tap or the arrow keys step between heights, and scrolling or typing in the panel opens it fully.
 */
function useSheet(active: boolean, expanded: boolean) {
    const [snap, setSnap] = useState<Snap>('half');
    const [height, setHeight] = useState(0);
    const [dragTop, setDragTop] = useState<number | null>(null);
    const drag = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null);
    const observed = useRef<ResizeObserver | null>(null);

    const root = useCallback(
        (element: HTMLDivElement | null) => {
            observed.current?.disconnect();
            observed.current = null;
            if (!element || !active) return;
            setHeight(element.clientHeight);
            observed.current = new ResizeObserver(() => setHeight(element.clientHeight));
            observed.current.observe(element);
        },
        [active],
    );
    useEffect(() => () => observed.current?.disconnect(), []);

    const current: Snap = expanded ? 'full' : snap;
    const tops = sheetTops(height);
    const top = dragTop ?? tops[current];

    return {
        root,
        snap: current,
        dragging: dragTop !== null,
        /** What the sheet covers of the map; fully open keeps the half-open view, so the map does not move. */
        covered: height === 0 ? 0 : current === 'peek' ? height - tops.peek : height - tops.half,
        style: height > 0 ? { top } : undefined,
        step: (direction: 1 | -1) => {
            const order: Snap[] = ['peek', 'half', 'full'];
            setSnap(order[Math.min(2, Math.max(0, order.indexOf(current) + direction))]);
        },
        toggle: () => setSnap(current === 'full' ? 'half' : current === 'half' ? 'full' : 'half'),
        onFocus: (event: React.FocusEvent) => {
            if ((event.target as HTMLElement).matches('input:not([type=radio]):not([type=checkbox]), textarea')) setSnap('full');
        },
        onScroll: (event: React.UIEvent) => {
            if (current !== 'full' && (event.target as HTMLElement).scrollTop > 0) setSnap('full');
        },
        dragHandlers: {
            onPointerDown: (event: React.PointerEvent) => {
                drag.current = { startY: event.clientY, startTop: top, moved: false };
                event.currentTarget.setPointerCapture(event.pointerId);
            },
            onPointerMove: (event: React.PointerEvent) => {
                if (!drag.current) return;
                const delta = event.clientY - drag.current.startY;
                if (Math.abs(delta) > 6) drag.current.moved = true;
                if (drag.current.moved) setDragTop(Math.min(tops.peek, Math.max(tops.full, drag.current.startTop + delta)));
            },
            onPointerUp: () => {
                if (drag.current?.moved && dragTop !== null) setSnap(nearestSnap(dragTop, height));
                setDragTop(null);
            },
            onPointerCancel: () => {
                drag.current = null;
                setDragTop(null);
            },
            onClickCapture: (event: React.MouseEvent) => {
                // A drag ends in a click on the grip; it already chose the height.
                if (drag.current?.moved) event.preventDefault();
                drag.current = null;
            },
        },
    };
}

function SheetGrip({ sheet }: { sheet: ReturnType<typeof useSheet> }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <button
            type="button"
            aria-label={t(sheet.snap === 'full' ? 'edit.sheet_smaller' : 'edit.sheet_larger')}
            aria-expanded={sheet.snap === 'full'}
            onClick={(event) => {
                if (!event.defaultPrevented) sheet.toggle();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                sheet.step(event.key === 'ArrowUp' ? 1 : -1);
            }}
            {...sheet.dragHandlers}
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
        >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
        </button>
    );
}

/**
 * The map's view, aerial photo source and legend behind one button on a small screen, as on the public map, so they
 * fit beside Street View.
 */
function LayersMenu({
    layer,
    onLayer,
    imagery,
    legend,
}: {
    layer: MapLayer;
    onLayer: (layer: MapLayer) => void;
    imagery: ReturnType<typeof useAerialImagery>;
    legend: LegendItem[];
}) {
    const { t } = useTranslation('backend/moderation');
    const { t: tCommon } = useTranslation('global/common');
    const [open, setOpen] = useState(false);
    const choice = (pressed: boolean) =>
        cn(
            'h-11 cursor-pointer rounded-[10px] border text-sm font-medium',
            pressed ? 'border-2 border-foreground bg-muted font-semibold' : 'bg-background hover:bg-muted',
        );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="h-11 gap-2 rounded-xl border-0 bg-background px-3 shadow-[0_2px_10px_rgba(0,0,0,0.14)] data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
                    aria-label={t('map.layers')}
                >
                    <Layers aria-hidden />
                    {t(layer === 'streets' ? 'review.views.map' : 'review.views.aerial')}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="z-1000 w-72 rounded-2xl p-2" aria-label={t('map.layers')}>
                <div className="flex items-center justify-between pl-2">
                    <h2 className="text-xs font-semibold text-muted-foreground">{t('review.views.label')}</h2>
                    <Button variant="ghost" size="icon" className="size-11" aria-label={t('map.legend.close')} onClick={() => setOpen(false)}>
                        <X className="size-4" aria-hidden />
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 px-1">
                    {(['streets', 'satellite'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={layer === option}
                            onClick={() => onLayer(option)}
                            className={choice(layer === option)}
                        >
                            {t(option === 'streets' ? 'review.views.map' : 'review.views.aerial')}
                        </button>
                    ))}
                </div>
                {layer === 'satellite' && imagery.layers.length > 1 && (
                    <>
                        <h2 className="px-2 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">{tCommon('imagery.source')}</h2>
                        <div className="grid grid-cols-2 gap-1.5 px-1">
                            {imagery.layers.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={imagery.layer?.key === option.key}
                                    onClick={() => imagery.choose(option.key)}
                                    className={choice(imagery.layer?.key === option.key)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {legend.length > 0 && (
                    <>
                        <h2 className="mt-3 border-t px-2 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">{t('map.legend.label')}</h2>
                        <div className="px-1">
                            <LegendList items={legend} />
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}

/**
 * The editor on a small screen: a sheet over the item, half open so the aerial photo stays in view, and fully open
 * once the moderator scrolls, types, or drags the grip up.
 */
function Sheet({ label, children }: { label?: string; children: React.ReactNode }) {
    const { t } = useTranslation('backend/moderation');
    const [full, setFull] = useState(false);

    return (
        <section
            aria-label={label}
            onFocus={(event) => {
                if ((event.target as HTMLElement).matches('input:not([type=radio]), textarea')) setFull(true);
            }}
            onScrollCapture={(event) => {
                if ((event.target as HTMLElement).scrollTop > 0) setFull(true);
            }}
            className={cn(
                'absolute inset-x-0 bottom-0 z-500 flex flex-col overflow-hidden rounded-t-2xl bg-background shadow-[0_-10px_30px_rgba(0,0,0,0.18)] transition-[top,opacity,translate] duration-300 ease-out motion-reduce:transition-none starting:translate-y-8 starting:opacity-0 motion-reduce:starting:translate-y-0',
                full ? 'top-12' : 'top-[40%]',
            )}
        >
            <button
                type="button"
                aria-label={t(full ? 'edit.sheet_smaller' : 'edit.sheet_larger')}
                aria-expanded={full}
                onClick={() => setFull((value) => !value)}
                className="flex h-6 shrink-0 cursor-pointer items-center justify-center"
            >
                <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            </button>
            {children}
        </section>
    );
}

/** The top of the panel while an item is open: back to the queue, where this item is in it, and previous or next. */
export function PanelNav({
    back,
    onBack,
    position,
    loading = false,
    onNavigate,
    action,
}: {
    back: string;
    onBack: () => void;
    position?: Position | null;
    loading?: boolean;
    onNavigate?: (link: ItemLink) => void;
    action?: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const previous = position?.previous ?? null;
    const next = position?.next ?? null;

    return (
        <nav aria-label={t('review.position_label')} className="flex h-[52px] shrink-0 items-center gap-1 border-b pr-3 pl-2 max-lg:pr-1">
            <Button variant="ghost" className="h-9 cursor-pointer gap-1 px-2 text-sm font-medium max-lg:h-11 max-lg:text-[15px]" onClick={onBack}>
                <ChevronLeft className="size-[18px]" aria-hidden />
                {back}
            </Button>
            <span className="flex-1 text-center text-[13px] text-muted-foreground tabular-nums">
                {position ? t('review.position', { index: position.index, total: position.total }) : null}
            </span>
            {action}
            {onNavigate && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 cursor-pointer max-lg:size-11"
                        disabled={!previous || loading}
                        aria-label={t('review.previous')}
                        onClick={() => previous && onNavigate(previous)}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 cursor-pointer max-lg:size-11"
                        disabled={!next || loading}
                        aria-label={t('review.next')}
                        onClick={() => next && onNavigate(next)}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </>
            )}
        </nav>
    );
}
