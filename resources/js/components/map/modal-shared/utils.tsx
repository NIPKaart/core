import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TFunction } from 'i18next';
import { HelpCircle } from 'lucide-react';
import { EnumOption } from './types';

export function getOrientationIllustration(orientation: EnumOption | null) {
    if (!orientation) return '/assets/images/car-illu.svg';
    const key = orientation.value;
    if (key === 'perpendicular') return '/assets/images/orientation/perpendicular.png';
    if (key === 'parallel') return '/assets/images/orientation/parallel.png';
    if (key === 'angle') return '/assets/images/orientation/angle.png';
    return '/assets/images/car-illu.svg';
}

export function formatParkingTime(t: TFunction, minutes?: number | null): string {
    if (!minutes) return t('community.table.unlimited');

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h && m)
        return `${t(h === 1 ? 'community.table.time_format.hours' : 'community.table.time_format.hours_plural', { count: h })} & ${t(m === 1 ? 'community.table.time_format.minutes' : 'community.table.time_format.minutes_plural', { count: m })}`;

    if (h) return t(h === 1 ? 'community.table.time_format.hours' : 'community.table.time_format.hours_plural', { count: h });

    if (m) return t(m === 1 ? 'community.table.time_format.minutes' : 'community.table.time_format.minutes_plural', { count: m });

    return t('community.table.unlimited');
}

export function HelpPopover({ content, label }: { content: React.ReactNode; label?: string }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="cursor-help rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={label ?? 'More info'}
                >
                    <HelpCircle className="h-4 w-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="max-w-[240px] text-sm text-muted-foreground">
                {content}
            </PopoverContent>
        </Popover>
    );
}
