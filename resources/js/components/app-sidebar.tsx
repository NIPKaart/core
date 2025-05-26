import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { NavGroup, SharedData, type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { icons } from 'lucide-react';
import AppLogoSwitcher from './app-logo-switcher';
import { NavSection } from './nav/nav-section';

export function AppSidebar() {
    const { can, hasRole } = useAuthorization();
    const { props } = usePage<SharedData>();

    // Sidebar badge counts
    const userCount = props.counts.users;
    const { active: activeParkingSpots, trashed: trashedParkingSpots } = props.counts.parkingSpots;
    const { active: activeUserParkingSpots } = props.counts.userParkingSpots;

    const platformNavGroup: NavGroup = {
        title: 'Platform',
        items: [
            {
                title: 'Dashboard',
                href: route('dashboard'),
                icon: icons.LayoutGrid,
            },
            {
                title: 'Map',
                href: route('map'),
                icon: icons.Map,
            },
        ].filter(Boolean) as NavItem[],
    };

    const parkingNavGroup: NavGroup = {
        title: 'Parking',
        items: [
            {
                title: 'My Locations',
                href: route('user.parking-spots.index'),
                icon: icons.MapPin,
                badge: activeUserParkingSpots ? activeUserParkingSpots : undefined,
            },
            {
                title: 'My Favorites',
                href: route('user.favorites.index'),
                icon: icons.Heart,
            },
        ].filter(Boolean) as NavItem[],
    };

    const moderationNavGroup: NavGroup = {
        title: 'Moderation',
        items: [
            can('parking-spot.view_any') && {
                title: 'Parking Spots',
                href: route('app.parking-spots.index'),
                icon: icons.MapPin,
                badge: activeParkingSpots,
            },
            can('parking-spot.restore') && {
                title: 'Trash',
                href: route('app.parking-spots.trash'),
                icon: icons.Trash2,
                badge: trashedParkingSpots ? trashedParkingSpots : undefined,
            },
            can('parking-rule.view_any') && {
                title: 'Parking Rules',
                href: route('app.parking-rules.index'),
                icon: icons.Gavel,
            },
        ].filter(Boolean) as NavItem[],
    };

    const managementNavGroup: NavGroup = {
        title: 'Management',
        items: [
            can('user.view_any') && {
                title: 'Users',
                href: route('app.users.index'),
                icon: icons.Users,
                badge: userCount,
            },
            can('role.view_any') && {
                title: 'Roles',
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
            title: 'Logs',
            href: route('log-viewer.index'),
            target: '_blank',
            icon: icons.Logs,
        },
        {
            title: 'Back to Frontend',
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
