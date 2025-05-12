import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { NavGroup, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { icons } from 'lucide-react';
import AppLogoSwitcher from './app-logo-switcher';
import { NavSection } from './nav/nav-section';

export function AppSidebar() {
    const { can, hasRole } = useAuthorization();

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
            }
        ].filter(Boolean) as NavItem[],
    }

    const moderatorNavGroup: NavGroup = {
        title: 'Moderator',
        items: [
            can('parking-rule.view_any') && {
                title: 'Parking Rules',
                href: route('app.parking-rules.index'),
                icon: icons.Gavel,
            }
        ].filter(Boolean) as NavItem[],
    }

    const managementNavGroup: NavGroup = {
        title: 'Management',
        items: [
            can('user.view_any') && {
                title: 'Users',
                href: route('app.users.index'),
                icon: icons.Users,
            },
            can('role.view_any') && {
                title: 'Roles',
                href: route('app.roles.index'),
                icon: icons.Shield,
            },
        ].filter(Boolean) as NavItem[],
    }

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
                {moderatorNavGroup.items.length > 0 && <NavSection group={moderatorNavGroup} />}
                {managementNavGroup.items.length > 0 && <NavSection group={managementNavGroup} />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
