import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TileLayer } from 'react-leaflet';

/** One aerial photo layer from the server's catalogue (App\Services\AerialImagery), best first for the page's location. */
export type AerialLayer = {
    key: string;
    label: string;
    url: string;
    attribution: string;
    subdomains: string[];
    max_native_zoom: number;
};

/**
 * The aerial photo layers the page offers and the one in use: the best one for the location until the viewer picks
 * another to compare.
 */
export function useAerialImagery(availableLayers?: AerialLayer[]): {
    layers: AerialLayer[];
    layer: AerialLayer | undefined;
    choose: (key: string) => void;
} {
    const pageLayers = usePage<{ imagery?: AerialLayer[] }>().props.imagery;
    const layers = availableLayers ?? pageLayers ?? [];
    const [chosen, choose] = useState<string | null>(null);

    return { layers, layer: layers.find((layer) => layer.key === chosen) ?? layers[0], choose };
}

export function AerialTiles({ layer }: { layer: AerialLayer | undefined }) {
    if (!layer) return null;

    return (
        <TileLayer
            key={layer.key}
            url={layer.url}
            attribution={layer.attribution}
            subdomains={layer.subdomains}
            maxNativeZoom={layer.max_native_zoom}
            maxZoom={22}
            keepBuffer={4}
        />
    );
}

/** Switches between the aerial photo layers, shown only when there is more than one to compare. */
export function AerialPicker({
    layers,
    layer,
    onChoose,
    className,
}: {
    layers: AerialLayer[];
    layer: AerialLayer | undefined;
    onChoose: (key: string) => void;
    className?: string;
}) {
    const { t } = useTranslation('global/common');
    if (layers.length < 2 || !layer) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn('h-9 gap-1 rounded-[9px] px-2.5 text-sm font-medium', className)}>
                    <span className="sr-only">{t('imagery.source')}: </span>
                    {layer.label}
                    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-1000 min-w-44">
                <DropdownMenuLabel>{t('imagery.source')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={layer.key} onValueChange={onChoose}>
                    {layers.map((option) => (
                        <DropdownMenuRadioItem key={option.key} value={option.key}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
