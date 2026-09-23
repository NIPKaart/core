import { index } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import { useAuthorization } from '@/hooks/use-authorization';
import { cn } from '@/lib/utils';
import parkingMunicipal from '@/routes/app/parking-municipal';
import { Link } from '@inertiajs/react';
import { Database, History, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MunicipalNavigation({ active }: { active: 'sources' | 'locations' | 'deliveries' }) {
    const { hasRole, can } = useAuthorization();
    const { t } = useTranslation('backend/municipal-imports');
    const items = [
        ...(hasRole('admin') ? [{ key: 'sources', title: t('navigation.sources'), icon: Database, href: index() }] : []),
        ...(can('parking-municipal.view_any')
            ? [{ key: 'locations', title: t('navigation.locations'), icon: MapPin, href: parkingMunicipal.index() }]
            : []),
        ...(hasRole('admin')
            ? [{ key: 'deliveries', title: t('navigation.history'), icon: History, href: index({ query: { tab: 'deliveries' } }) }]
            : []),
    ];

    return (
        <nav aria-label={t('title')} className="flex border-b">
            {items.map((item) => (
                <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active === item.key ? 'page' : undefined}
                    className={cn(
                        'relative -mb-px flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-none sm:px-5',
                        active === item.key
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.title}
                </Link>
            ))}
        </nav>
    );
}
