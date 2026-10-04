import { index as municipalImports } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { dashboard, home, locationMap } from '@/routes';
import moderation from '@/routes/app/moderation';
import parkingMunicipal from '@/routes/app/parking-municipal';
import parkingOffstreet from '@/routes/app/parking-offstreet';
import parkingRules from '@/routes/app/parking-rules';
import parkingSpaces from '@/routes/app/parking-spaces';
import roles from '@/routes/app/roles';
import users from '@/routes/app/users';
import logViewer from '@/routes/log-viewer';
import profile from '@/routes/profile';
import { NavGroup, SharedData, type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { icons } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLogoSwitcher from './app-logo-switcher';
import { NavSection } from './nav/nav-section';

/**
 * The admin navigation, grouped by what a person does: work that waits for a decision first, then their own
 * contributions, the parking data they manage and account management. Only counts that ask for action are shown.
 */
export function AppSidebar() {
    const { can, hasRole } = useAuthorization();
    const { props, url } = usePage<SharedData>();
    const { t } = useTranslation('backend/sidebar');

    const { open: openModeration } = props.counts.moderation;
    const { attention: dataSourcesAttention } = props.counts.dataSources;
    const canModerate = can('parking-space.view_any') || can('parking-space-improvement.view_any') || can('parking-place-report.view_any');

    const workNavGroup: NavGroup = {
        items: [
            {
                title: t('dashboard'),
                href: dashboard(),
                icon: icons.LayoutGrid,
            },
            canModerate && {
                title: t('moderation'),
                href: moderation.index(),
                icon: icons.Inbox,
                badge: openModeration || undefined,
                badgeTone: 'attention',
            },
        ].filter(Boolean) as NavItem[],
    };

    const personalNavGroup: NavGroup = {
        title: t('personal'),
        items: [
            {
                title: t('my_locations'),
                href: profile.parkingSpaces.index(),
                icon: icons.MapPin,
            },
            {
                title: t('my_favorites'),
                href: profile.favorites.index(),
                icon: icons.Heart,
            },
        ],
    };

    const parkingDataNavGroup: NavGroup = {
        title: t('parking_data'),
        items: [
            can('parking-space.view_any') && {
                title: t('community_spaces'),
                href: parkingSpaces.index(),
                icon: icons.MapPinned,
            },
            (can('parking-municipal.view_any') || hasRole('admin')) && {
                title: t('municipal_data'),
                href: hasRole('admin') ? municipalImports() : parkingMunicipal.index(),
                isActive: [municipalImports.url(), parkingMunicipal.index.url()].some(
                    (path) => url.split('?')[0] === path || url.startsWith(`${path}/`),
                ),
                icon: icons.Building,
                badge: (hasRole('admin') && dataSourcesAttention) || undefined,
                badgeTone: 'attention',
            },
            can('parking-offstreet.view_any') && {
                title: t('offstreet'),
                href: parkingOffstreet.index(),
                icon: icons.SquareParking,
            },
            can('parking-rule.view_any') && {
                title: t('rules'),
                href: parkingRules.index(),
                icon: icons.Gavel,
            },
        ].filter(Boolean) as NavItem[],
    };

    const managementNavGroup: NavGroup = {
        title: t('management'),
        items: [
            can('user.view_any') && {
                title: t('users'),
                href: users.index(),
                icon: icons.Users,
            },
            can('role.view_any') && {
                title: t('roles'),
                href: roles.index(),
                icon: icons.Shield,
            },
            hasRole('admin') && {
                title: t('logs'),
                href: logViewer.index(),
                target: '_blank',
                icon: icons.Logs,
            },
        ].filter(Boolean) as NavItem[],
    };

    const footerNavItems: NavItem[] = [
        {
            title: t('map'),
            href: locationMap(),
            icon: icons.Map,
        },
        {
            title: t('back_to_frontend'),
            href: home(),
            icon: icons.ArrowLeft,
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogoSwitcher />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavSection group={workNavGroup} />
                <NavSection group={personalNavGroup} />
                {parkingDataNavGroup.items.length > 0 && <NavSection group={parkingDataNavGroup} />}
                {managementNavGroup.items.length > 0 && <NavSection group={managementNavGroup} />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
