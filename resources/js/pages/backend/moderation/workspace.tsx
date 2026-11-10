import { AerialPicker, useAerialImagery, type AerialLayer } from '@/components/map/aerial-imagery';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Camera, ChevronLeft, ChevronRight, Layers, MousePointer2, X } from 'lucide-react';
import { Fragment, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegendList, ModerationMap, type LegendItem, type MapLayer, type MapPoint } from './moderation-map';
import type { ItemLink, Position } from './types';

/** The panel's width plus its margins, so the map keeps what the panel covers out of the way. */
const PANEL_INSET = 452;
/** With the editor open beside the panel: both panels and their margins. */
const EDITOR_INSET = PANEL_INSET + 380 + 16;

type MapProps = Omit<React.ComponentProps<typeof ModerationMap>, 'layer' | 'inset' | 'insetBottom' | 'className' | 'controls' | 'links' | 'children'>;

/** The layer the moderator chose last, separately for weighing one item and for looking over the queue. */
function useLayer(
    scope: 'item' | 'overview',
    initial?: MapLayer,
    viewKey?: string,
    keepOverviewLayer = false,
): [MapLayer, (layer: MapLayer) => void] {
    const key = `moderation.layer.${scope}`;
    const readLayer = (): MapLayer => {
        if (initial) return initial;
        try {
            const stored = window.localStorage.getItem(key);
            if (stored === 'streets' || stored === 'satellite') return stored;
        } catch {
            // Use the scope's default without local storage.
        }
        return scope === 'item' ? 'satellite' : 'streets';
    };
    const [selection, setSelection] = useState(() => ({ scope, viewKey, layer: readLayer() }));
    const changed = selection.scope !== scope || selection.viewKey !== viewKey;
    const returningToOverview = scope === 'overview' && keepOverviewLayer && selection.viewKey !== undefined;
    const layer = changed && !returningToOverview ? readLayer() : selection.layer;
    if (changed) setSelection({ scope, viewKey, layer });

    return [
        layer,
        (next) => {
            setSelection({ scope, viewKey, layer: next });
            try {
                window.localStorage.setItem(key, next);
            } catch {
                // The choice simply is not remembered.
            }
        },
    ];
}

/** How far the panel is open on a small screen: just its top and the decision, half the screen, or nearly all of it. */
export type Snap = 'peek' | 'half' | 'full';

/** Height of the panel when lowered: the navigation, the title and the decision buttons. */
const PEEK = 256;
/** What stays of the map above the panel when it is fully open. */
const FULL_TOP = 48;
/** Share of the workspace the panel takes when half open. */
const HALF = 0.55;

/** How much of the panel shows at each height, in pixels. */
export function sheetHeights(height: number): Record<Snap, number> {
    return { peek: Math.min(PEEK, height - FULL_TOP), half: Math.round(height * HALF), full: height - FULL_TOP };
}

/**
 * The drawer's snap points for each height. The drawer is as tall as the panel fully open and slides down to lower
 * heights, so a snap point is the height that shows plus the strip of map that always stays above it.
 */
export function sheetSnapPoints(height: number): Record<Snap, string> {
    const heights = sheetHeights(height);
    return { peek: `${heights.peek + FULL_TOP}px`, half: `${heights.half + FULL_TOP}px`, full: `${heights.full + FULL_TOP}px` };
}

/**
 * The moderation workspace: the map fills the screen and one panel floats beside it, as on the public map. The panel
 * switches between the queue, one item, a decision and a selection; the map follows what the panel shows. On a small
 * screen the panel is a drawer over the map with three heights, and the map keeps what it shows above the drawer.
 */
function WorkspaceLayout({
    scope,
    map,
    streetView,
    imageryLayers,
    initialLayer,
    viewKey,
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
    initialLayer?: MapLayer;
    viewKey?: string;
    label: string;
    /** A second panel beside the first, such as the details editor; a drawer over the item on small screens. */
    aside?: React.ReactNode;
    asideLabel?: string;
    /** Opens the drawer fully on a small screen, for example while a reason is chosen. */
    expanded?: boolean;
    children: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const [layer, setLayer] = useLayer(scope, initialLayer, viewKey, map.overviewKey !== undefined);
    const imagery = useAerialImagery(imageryLayers);
    const wide = useMediaQuery('(min-width: 1024px)');
    const street = streetView ? streetViewUrl(streetView.latitude, streetView.longitude) : null;
    const [root, setRoot] = useState<HTMLDivElement | null>(null);
    const height = useHeight(wide ? null : root);
    const [snap, setSnap] = useState<Snap>('half');
    const current: Snap = expanded ? 'full' : snap;
    const heights = sheetHeights(height);
    /** What the drawer covers of the map; fully open keeps the half-open view, so the map does not move. */
    const covered = wide || height === 0 ? 0 : current === 'peek' ? heights.peek : heights.half;

    const panel = <Fragment key={viewKey}>{children}</Fragment>;

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
        <div ref={setRoot} className="relative isolate min-h-0 min-w-0 flex-1 overflow-hidden">
            <h1 className="sr-only">{t('title')}</h1>
            <ModerationMap
                {...map}
                layer={layer}
                reviewKey={viewKey}
                aerial={imagery.layer}
                inset={wide ? (aside ? EDITOR_INSET : PANEL_INSET) : 0}
                insetBottom={covered}
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
                        style={covered ? { bottom: covered + 12 } : undefined}
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
            {wide ? (
                <>
                    <section
                        aria-label={label}
                        className={cn(
                            'absolute top-4 bottom-4 left-4 z-500 flex w-[420px] flex-col overflow-hidden rounded-2xl bg-background shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none starting:opacity-0',
                            scope === 'item' ? 'starting:translate-x-4' : 'starting:-translate-x-4',
                            'motion-reduce:starting:translate-x-0',
                        )}
                    >
                        {panel}
                    </section>
                    {aside && (
                        <section
                            aria-label={asideLabel}
                            className="absolute top-4 bottom-4 left-[452px] z-500 flex w-[380px] flex-col overflow-hidden rounded-2xl bg-background shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none starting:-translate-x-5 starting:opacity-0 motion-reduce:starting:translate-x-0"
                        >
                            {aside}
                        </section>
                    )}
                </>
            ) : (
                root &&
                height > 0 && (
                    <>
                        <MobileSheet container={root} height={height} snaps={['peek', 'half', 'full']} snap={current} onSnap={setSnap} label={label}>
                            {panel}
                        </MobileSheet>
                        {aside && <EditorSheet container={root} height={height} label={asideLabel ?? label} content={aside} />}
                    </>
                )
            )}
        </div>
    );
}

type WorkspaceProps = React.ComponentProps<typeof WorkspaceLayout>;
const WorkspaceSlot = createContext<((props: WorkspaceProps) => void) | null>(null);

/** Lets the queue and a keyed review swap panels without replacing the Leaflet workspace. */
export function SharedWorkspace({ children, className }: { children: React.ReactNode; className: string }) {
    const [workspace, setWorkspace] = useState<WorkspaceProps | null>(null);

    return (
        <WorkspaceSlot.Provider value={setWorkspace}>
            <div className={className}>
                {children}
                {workspace && <WorkspaceLayout {...workspace} />}
            </div>
        </WorkspaceSlot.Provider>
    );
}

export function Workspace(props: WorkspaceProps) {
    const setWorkspace = useContext(WorkspaceSlot);
    useLayoutEffect(() => {
        setWorkspace?.(props);
    }, [props, setWorkspace]);

    return setWorkspace ? null : <WorkspaceLayout {...props} />;
}

/** The height of an element, followed as the screen turns or the browser bars come and go; 0 without an element. */
function useHeight(element: HTMLElement | null): number {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        if (!element) {
            setHeight(0);
            return;
        }
        setHeight(element.clientHeight);
        const observer = new ResizeObserver(() => setHeight(element.clientHeight));
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return height;
}

/**
 * A panel on a small screen: the shadcn drawer, kept open over the map without dimming it. Dragging moves it between
 * its heights, scrolling the panel opens it fully first, and so does typing in it. The grip steps between the heights
 * with a tap or the arrow keys. Only the part that shows is laid out, so the buttons at the bottom of the panel stay
 * in view at every height.
 */
export function MobileSheet({
    container,
    height,
    snaps,
    snap,
    onSnap,
    label,
    className,
    children,
}: {
    container: HTMLElement;
    height: number;
    snaps: Snap[];
    snap: Snap;
    onSnap: (snap: Snap) => void;
    label: string;
    className?: string;
    children: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const points = sheetSnapPoints(height);
    const heights = sheetHeights(height);
    // A drag that ends on the grip also clicks it; the drag already chose the height.
    const dragged = useRef(false);
    const step = (direction: 1 | -1) => onSnap(snaps[Math.min(snaps.length - 1, Math.max(0, snaps.indexOf(snap) + direction))]);

    return (
        <Drawer
            open
            modal={false}
            dismissible={false}
            noBodyStyles
            container={container}
            snapPoints={snaps.map((option) => points[option])}
            activeSnapPoint={points[snap]}
            setActiveSnapPoint={(point) => {
                const next = snaps.find((option) => points[option] === point);
                if (next) onSnap(next);
            }}
            onDrag={() => {
                dragged.current = true;
            }}
        >
            <DrawerContent
                handle={false}
                // A region, not a dialog: the map beside it stays in use, and so do the moderation shortcuts.
                role="region"
                aria-describedby={undefined}
                style={{ height: heights.full }}
                onFocus={(event) => {
                    if ((event.target as HTMLElement).matches('input:not([type=radio]):not([type=checkbox]), textarea')) onSnap('full');
                }}
                className={cn(
                    'absolute z-500 overflow-hidden rounded-t-2xl bg-background shadow-[0_-8px_28px_rgba(0,0,0,0.16)] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none data-[vaul-drawer-direction=bottom]:rounded-t-2xl data-[vaul-drawer-direction=bottom]:border-t-0',
                    className,
                )}
            >
                <DrawerTitle className="sr-only">{label}</DrawerTitle>
                <div
                    className="flex min-h-0 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] transition-[height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                    style={{ height: heights[snap] }}
                >
                    <button
                        type="button"
                        aria-label={t(snap === 'full' ? 'edit.sheet_smaller' : 'edit.sheet_larger')}
                        aria-expanded={snap === 'full'}
                        onPointerDown={() => {
                            dragged.current = false;
                        }}
                        onClick={() => {
                            if (dragged.current) return;
                            onSnap(snap === 'full' ? snaps[Math.max(0, snaps.indexOf('half'))] : 'full');
                        }}
                        onKeyDown={(event) => {
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            step(event.key === 'ArrowUp' ? 1 : -1);
                        }}
                        className="flex h-6 shrink-0 cursor-grab items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
                    >
                        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
                    </button>
                    {children}
                </div>
            </DrawerContent>
        </Drawer>
    );
}

/** The details editor on a small screen: a second drawer over the item, half open so the aerial photo stays in view. */
function EditorSheet({ container, height, label, content }: { container: HTMLElement; height: number; label: string; content: React.ReactNode }) {
    const [snap, setSnap] = useState<Snap>('half');

    return (
        <MobileSheet container={container} height={height} snaps={['half', 'full']} snap={snap} onSnap={setSnap} label={label} className="z-510">
            {content}
        </MobileSheet>
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
