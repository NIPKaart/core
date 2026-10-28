import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModerationMap, type MapLayer, type MapPoint } from './moderation-map';
import { Kbd } from './shortcuts';
import type { ItemLink, Position } from './types';

/** The panel's width plus its margins, so the map keeps what the panel covers out of the way. */
const PANEL_INSET = 452;

type MapProps = Omit<React.ComponentProps<typeof ModerationMap>, 'layer' | 'inset' | 'className' | 'children'>;

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

/**
 * The moderation workspace: the map fills the screen and one panel floats beside it, as on the public map. The panel
 * switches between the queue, one item, a decision and a selection; the map follows what the panel shows. On small
 * screens the map sits above the panel.
 */
export function Workspace({
    scope,
    map,
    streetView,
    label,
    children,
}: {
    scope: 'item' | 'overview';
    map: MapProps;
    /** Where Street View should open, for an item. */
    streetView?: MapPoint | null;
    label: string;
    children: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const [layer, setLayer] = useLayer(scope);
    const wide = useMediaQuery('(min-width: 1024px)');
    const street = streetView ? streetViewUrl(streetView.latitude, streetView.longitude) : null;

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:block">
            <h1 className="sr-only">{t('title')}</h1>
            <ModerationMap {...map} layer={layer} inset={wide ? PANEL_INSET : 0} className="h-[38svh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
                <div className="absolute top-3 right-3 z-500 flex gap-2 lg:top-4 lg:right-4">
                    <ToggleGroup
                        type="single"
                        value={layer}
                        onValueChange={(value) => value && setLayer(value as MapLayer)}
                        aria-label={t('review.views.label')}
                        className="gap-1 rounded-xl bg-background p-1 shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
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
                    {street && (
                        <Button variant="outline" asChild className="h-11 rounded-xl border-0 bg-background shadow-[0_2px_10px_rgba(0,0,0,0.14)]">
                            <a href={street} target="_blank" rel="noreferrer">
                                <Camera aria-hidden />
                                <span className="max-sm:sr-only">{t('review.views.street_view')}</span>
                            </a>
                        </Button>
                    )}
                </div>
            </ModerationMap>
            <section
                aria-label={label}
                className="relative z-500 -mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl bg-background shadow-[0_-8px_28px_rgba(0,0,0,0.12)] lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:mt-0 lg:w-[420px] lg:rounded-2xl lg:shadow-[0_8px_28px_rgba(0,0,0,0.16)]"
            >
                {children}
            </section>
        </div>
    );
}

/** The top of the panel while an item is open: back to the queue, where this item is in it, and previous or next. */
export function PanelNav({
    back,
    onBack,
    position,
    loading = false,
    onNavigate,
}: {
    back: string;
    onBack: () => void;
    position?: Position | null;
    loading?: boolean;
    onNavigate?: (link: ItemLink) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const previous = position?.previous ?? null;
    const next = position?.next ?? null;

    return (
        <nav aria-label={t('review.position_label')} className="flex h-[52px] shrink-0 items-center gap-1 border-b pr-3 pl-2">
            <Button variant="ghost" className="h-9 cursor-pointer gap-1 px-2 text-sm font-medium" onClick={onBack}>
                <ChevronLeft className="size-[18px]" aria-hidden />
                {back}
            </Button>
            <span className="flex-1 text-center text-[13px] text-muted-foreground tabular-nums">
                {position ? t('review.position', { index: position.index, total: position.total }) : null}
            </span>
            {onNavigate && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 cursor-pointer"
                        disabled={!previous || loading}
                        aria-label={t('review.previous')}
                        onClick={() => previous && onNavigate(previous)}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 cursor-pointer"
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

/** The bottom of the panel: which item follows, opened with J. */
export function NextUp({ position, onNavigate }: { position: Position | null; onNavigate: (link: ItemLink) => void }) {
    const { t } = useTranslation('backend/moderation');
    const next = position?.next;
    if (!next) return null;

    return (
        <button
            type="button"
            onClick={() => onNavigate(next)}
            className="flex h-12 shrink-0 cursor-pointer items-center gap-3 border-t px-5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
            <span className="text-xs text-muted-foreground">{t('review.then')}</span>
            <span className={cn('min-w-0 flex-1 truncate text-sm font-medium')}>{next.street ?? t('no_address')}</span>
            <Kbd aria-hidden>J</Kbd>
        </button>
    );
}
