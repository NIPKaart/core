import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { NavGroup, SharedData, type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { icons } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppLogoSwitcher from './app-logo-switcher';
import { NavSection } from './nav/nav-section';

export function AppSidebar() {
    const { can, hasRole } = useAuthorization();
    const { props } = usePage<SharedData>();
    const { t } = useTranslation('backend/sidebar');

    // Sidebar badge counts
    const userCount = props.counts.users;
    const { active: activeParkingSpaces, trashed: trashedParkingSpaces } = props.counts.parkingSpaces;
    const { active: activeUserParkingSpaces } = props.counts.userParkingSpaces;

    const platformNavGroup: NavGroup = {
        title: t('platform'),
        items: [
            {
                title: t('dashboard'),
                href: route('dashboard'),
                icon: icons.LayoutGrid,
            },
            {
                title: t('map'),
                href: route('map'),
                icon: icons.Map,
            },
            {
                title: t('garages'),
                href: route('garages'),
                icon: icons.SquareParking
            }
        ].filter(Boolean) as NavItem[],
    };

    const parkingNavGroup: NavGroup = {
        title: t('personal'),
        items: [
            {
                title: t('my_locations'),
                href: route('profile.parking-spaces.index'),
                icon: icons.MapPin,
                badge: activeUserParkingSpaces || undefined,
            },
            {
                title: t('my_favorites'),
                href: route('profile.favorites.index'),
                icon: icons.Heart,
            },
        ].filter(Boolean) as NavItem[],
    };

    const moderationNavGroup: NavGroup = {
        title: t('moderation'),
        items: [
            can('parking-space.view_any') && {
                title: t('community_spaces'),
                href: route('app.parking-spaces.index'),
                icon: icons.MapPin,
                badge: activeParkingSpaces,
            },
            can('parking-offstreet.view_any') && {
                title: t('offstreet'),
                href: route('app.parking-offstreet.index'),
                icon: icons.SquareParking,
            },
            can('parking-municipal.view_any') && {
                title: t('municipalities'),
                href: route('app.parking-municipal.municipalities'),
                icon: icons.Building,
            },
            can('parking-rule.view_any') && {
                title: t('rules'),
                href: route('app.parking-rules.index'),
                icon: icons.Gavel,
            },
            can('parking-space.restore') && {
                title: t('trash'),
                href: route('app.parking-spaces.trash'),
                icon: icons.Trash2,
                badge: trashedParkingSpaces || undefined,
            },
        ].filter(Boolean) as NavItem[],
    };

    const managementNavGroup: NavGroup = {
        title: t('management'),
        items: [
            can('user.view_any') && {
                title: t('users'),
                href: route('app.users.index'),
                icon: icons.Users,
                badge: userCount,
            },
            can('role.view_any') && {
                title: t('roles'),
                href: route('app.roles.index'),
                icon: icons.Shield,
            },
        ].filter(Boolean) as NavItem[],
    };

    const footerNavItems: NavItem[] = [
        // {
        //     title: 'Repository',
        //     href: route('log-viewer.index'),
        //     target: '_blank',
        //     icon: Folder,
        // },
        hasRole('admin') && {
            title: t('logs'),
            href: route('log-viewer.index'),
            target: '_blank',
            icon: icons.Logs,
        },
        {
            title: t('back_to_frontend'),
            href: route('home'),
            icon: icons.ArrowLeft,
        },
    ].filter(Boolean) as NavItem[];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogoSwitcher />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavSection group={platformNavGroup} />
                {parkingNavGroup.items.length > 0 && <NavSection group={parkingNavGroup} />}
                {moderationNavGroup.items.length > 0 && <NavSection group={moderationNavGroup} />}
                {managementNavGroup.items.length > 0 && <NavSection group={managementNavGroup} />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
