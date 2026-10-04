import { useAuthorization } from '@/hooks/use-authorization';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import { Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

/** Community parking spaces and the ones in the trash, as two views of the same list. */
export function ParkingSpaceTabs({ current, trashedCount }: { current: 'all' | 'trash'; trashedCount: number }) {
    const { t } = useTranslation('backend/parking/main');
    const { can } = useAuthorization();

    if (!can('parking-space.restore')) return null;

    const tabs = [
        { key: 'all', href: app.parkingSpaces.index(), label: t('tabs.all') },
        { key: 'trash', href: app.parkingSpaces.trash(), label: t('tabs.trash'), count: trashedCount },
    ] as const;

    return (
        <nav aria-label={t('tabs.label')} className="inline-flex rounded-lg bg-muted p-[3px]">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={current === tab.key ? 'page' : undefined}
                    className={cn(
                        'rounded-md px-3 py-1 text-sm font-medium',
                        current === tab.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {tab.label}
                    {'count' in tab && tab.count > 0 && <span className="ml-1.5 text-muted-foreground tabular-nums">{tab.count}</span>}
                </Link>
            ))}
        </nav>
    );
}
