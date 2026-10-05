import { useAuthorization } from '@/hooks/use-authorization';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import { Link } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_DOTS } from './parts';

export type SpaceCounts = { all: number; pending: number; approved: number; rejected: number; trash: number };
export type SpaceTab = 'all' | 'pending' | 'approved' | 'rejected' | 'trash';

const STATUSES = ['approved', 'pending', 'rejected'] as const;

/** One list of community parking spaces, viewed per status, with the trash as the last view. */
export function ParkingSpaceTabs({ current, counts }: { current: SpaceTab; counts: SpaceCounts }) {
    const { t } = useTranslation('backend/parking/main');
    const { can } = useAuthorization();

    const tab = (key: SpaceTab, href: ReturnType<typeof app.parkingSpaces.index>, label: React.ReactNode) => (
        <Link
            key={key}
            href={href}
            aria-current={current === key ? 'page' : undefined}
            className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-sm',
                current === key ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
            <span className={cn('tabular-nums', current === key && 'text-muted-foreground')}>{counts[key]}</span>
        </Link>
    );

    return (
        <nav aria-label={t('tabs.label')} className="-mx-4 flex items-end gap-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
            {tab('all', app.parkingSpaces.index(), t('tabs.all'))}
            {STATUSES.map((status) =>
                tab(
                    status,
                    app.parkingSpaces.index({ query: { status } }),
                    <>
                        <span className={cn('size-2 rounded-full', STATUS_DOTS[status])} aria-hidden />
                        {t(`status.${status}`)}
                    </>,
                ),
            )}
            {can('parking-space.restore') && (
                <>
                    <span className="flex-1" />
                    {tab(
                        'trash',
                        app.parkingSpaces.trash(),
                        <>
                            <Trash2 className="size-3.5" aria-hidden />
                            {t('tabs.trash')}
                        </>,
                    )}
                </>
            )}
        </nav>
    );
}
