import { cn } from '@/lib/utils';
import type { ParkingStatus } from '@/types/enum';
import { differenceInDays, formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { Flag, MapPinned, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const STATUS_DOTS: Record<ParkingStatus, string> = {
    pending: 'bg-amber-600',
    approved: 'bg-green-600',
    rejected: 'bg-red-600',
};

/** A parking space's review status as a dot and a word, the same in every list and on the detail page. */
export function StatusPill({ status, className }: { status: ParkingStatus; className?: string }) {
    const { t } = useTranslation('backend/parking/main');

    return (
        <span
            className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap', className)}
        >
            <span className={cn('size-1.75 rounded-full', STATUS_DOTS[status])} aria-hidden />
            {t(`status.${status}`)}
        </span>
    );
}

/** What on a parking space asks for a moderator's attention: a municipal place nearby, open reports, a proposed improvement. */
export function SignalBadges({
    nearbyMunicipalMetres,
    openReports = 0,
    openImprovements = 0,
}: {
    nearbyMunicipalMetres?: number | null;
    openReports?: number;
    openImprovements?: number;
}) {
    const { t } = useTranslation('backend/parking/main');

    return (
        <>
            {nearbyMunicipalMetres != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-px text-xs font-medium whitespace-nowrap text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <MapPinned className="size-3" aria-hidden />
                    {t('signals.nearby_municipal', { distance: nearbyMunicipalMetres })}
                </span>
            )}
            {openReports > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-px text-xs font-medium whitespace-nowrap text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <Flag className="size-3" aria-hidden />
                    {t('signals.reports', { count: openReports })}
                </span>
            )}
            {openImprovements > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-px text-xs font-medium whitespace-nowrap">
                    <PencilLine className="size-3" aria-hidden />
                    {t('signals.improvement', { count: openImprovements })}
                </span>
            )}
        </>
    );
}

/** Recent moments read as "2 hours ago", older ones as a date. */
export function useWhen() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => {
        const date = parseISO(value);

        return differenceInDays(new Date(), date) < 30
            ? formatDistanceToNow(date, { addSuffix: true, locale })
            : new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    };
}
