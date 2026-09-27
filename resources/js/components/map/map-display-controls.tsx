import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Info, Layers, Map, Satellite, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type MapStyle = 'streets' | 'satellite';

export default function MapDisplayControls({ value, onChange }: { value: MapStyle; onChange: (value: MapStyle) => void }) {
    const { t } = useTranslation('frontend/map/main');
    const { t: tGlobal } = useTranslation('frontend/global');
    const [panel, setPanel] = useState<'layers' | 'legend' | null>(null);

    return (
        <div className="map-display-controls pointer-events-auto flex rounded-xl border border-border/70 bg-background p-0.5 shadow-md">
            {(['layers', 'legend'] as const).map((name) => (
                <Popover key={name} open={panel === name} onOpenChange={(open) => setPanel(open ? name : null)}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 rounded-lg data-[state=open]:bg-accent"
                            aria-label={t(`controls.${name}`)}
                            title={t(`controls.${name}`)}
                        >
                            {name === 'layers' ? <Layers className="size-5" aria-hidden /> : <Info className="size-5" aria-hidden />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl p-3"
                        aria-label={t(`controls.${name}`)}
                    >
                        <div className="mb-2 flex items-center justify-between pl-1">
                            <h2 className="text-sm font-semibold">{t(`controls.${name}`)}</h2>
                            <Button variant="ghost" size="icon" className="size-11" aria-label={t('filters.close')} onClick={() => setPanel(null)}>
                                <X className="size-4" aria-hidden />
                            </Button>
                        </div>
                        {name === 'layers' ? (
                            <div className="grid gap-1">
                                {(['streets', 'satellite'] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant="ghost"
                                        aria-pressed={value === style}
                                        className="h-12 justify-start gap-3 rounded-lg aria-pressed:bg-accent"
                                        onClick={() => {
                                            onChange(style);
                                            setPanel(null);
                                        }}
                                    >
                                        {style === 'streets' ? <Map className="size-5" aria-hidden /> : <Satellite className="size-5" aria-hidden />}
                                        <span className="flex-1 text-left">{t(`controls.${style}`)}</span>
                                        {value === style && <Check className="size-4" aria-hidden />}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <ul className="grid gap-4 px-1 pb-2 text-sm">
                                <li className="flex items-center gap-3">
                                    <img src="/assets/images/boards/accessible-pin.png" alt="" className="h-10 w-8 shrink-0 object-contain" />
                                    <span>{tGlobal('legend.accessibleSpace')}</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <img src="/assets/images/boards/e105-grey.png" alt="" className="size-8 shrink-0 object-contain" />
                                    <span>{tGlobal('legend.facility')}</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <span className="h-10 w-8 shrink-0" aria-hidden>
                                        <img
                                            src="/assets/images/boards/accessible-pin.png"
                                            alt=""
                                            className="destination-marker__image object-contain"
                                        />
                                    </span>
                                    <span>{t('controls.destination')}</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#136aec]/15">
                                        <span className="size-[18px] rounded-full border-[3px] border-white bg-[#2a93ee]" />
                                    </span>
                                    <span>{t('controls.location')}</span>
                                </li>
                                <li className="grid gap-3 border-t pt-3">
                                    <div aria-hidden className="flex gap-2">
                                        {(
                                            [
                                                ['small', 5],
                                                ['medium', 25],
                                                ['large', 120],
                                            ] as const
                                        ).map(([size, count]) => (
                                            <div
                                                key={size}
                                                className={`marker-cluster marker-cluster-${size} block size-10 shrink-0 text-neutral-900`}
                                            >
                                                <div>
                                                    <span>{count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <span>{t('controls.clusters')}</span>
                                </li>
                            </ul>
                        )}
                    </PopoverContent>
                </Popover>
            ))}
        </div>
    );
}
