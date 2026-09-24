import { index as municipalImports } from '@/actions/App/Http/Controllers/Admin/MunicipalImportController';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { dashboard, locationMap } from '@/routes';
import parkingMunicipal from '@/routes/app/parking-municipal';
import parkingOffstreet from '@/routes/app/parking-offstreet';
import parkingRules from '@/routes/app/parking-rules';
import parkingSpaces from '@/routes/app/parking-spaces';
import roles from '@/routes/app/roles';
import users from '@/routes/app/users';
import profile from '@/routes/profile';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Building, Gavel, Heart, Map, MapPin, Shield, SquareParking, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
    const { t } = useTranslation('backend/dashboard');
    const { t: nav } = useTranslation('backend/sidebar');
    const { can, hasRole } = useAuthorization();
    const groups = [
        {
            title: t('parking'),
            items: [
                {
                    visible: can('parking-space.view_any'),
                    title: nav('community_spaces'),
                    description: t('community_hint'),
                    href: parkingSpaces.index(),
                    icon: MapPin,
                },
                {
                    visible: can('parking-municipal.view_any') || hasRole('admin'),
                    title: nav('municipal_data'),
                    description: hasRole('admin') ? t('municipal_hint') : t('municipal_locations_hint'),
                    href: hasRole('admin') ? municipalImports() : parkingMunicipal.index(),
                    icon: Building,
                },
                {
                    visible: can('parking-offstreet.view_any'),
                    title: nav('offstreet'),
                    description: t('offstreet_hint'),
                    href: parkingOffstreet.index(),
                    icon: SquareParking,
                },
                { visible: can('parking-rule.view_any'), title: nav('rules'), description: t('rules_hint'), href: parkingRules.index(), icon: Gavel },
            ],
        },
        {
            title: nav('management'),
            items: [
                { visible: can('user.view_any'), title: nav('users'), description: t('users_hint'), href: users.index(), icon: Users },
                { visible: can('role.view_any'), title: nav('roles'), description: t('roles_hint'), href: roles.index(), icon: Shield },
            ],
        },
        {
            title: nav('personal'),
            items: [
                { visible: true, title: nav('my_locations'), description: t('locations_hint'), href: profile.parkingSpaces.index(), icon: MapPin },
                { visible: true, title: nav('my_favorites'), description: t('favorites_hint'), href: profile.favorites.index(), icon: Heart },
                { visible: true, title: nav('map'), description: t('map_hint'), href: locationMap(), icon: Map },
            ],
        },
    ];

    return (
        <AppLayout breadcrumbs={[{ title: nav('dashboard'), href: dashboard() }]}>
            <Head title={nav('dashboard')} />
            <div className="w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{nav('dashboard')}</h1>
                    <p className="text-sm text-muted-foreground">{t('intro')}</p>
                </header>
                {groups.map((group) => {
                    const items = group.items.filter((item) => item.visible);
                    if (!items.length) return null;
                    return (
                        <section key={group.title} className="space-y-3">
                            <h2 className="text-sm font-medium text-muted-foreground">{group.title}</h2>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {items.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <item.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-sm font-medium">{item.title}</span>
                                            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                                        </div>
                                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </AppLayout>
    );
}
