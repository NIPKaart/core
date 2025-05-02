import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { NavGroup, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { LayoutGrid, Logs, Shield, Users } from 'lucide-react';
import AppLogoSwitcher from './app-logo-switcher';
import { NavSection } from './nav/nav-section';

export function AppSidebar() {
    const { can, hasRole } = useAuthorization();

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
            icon: Logs,
        },
        {
            title: 'Back to Frontend',
            href: route('home'),
            icon: LayoutGrid,
        },
    ].filter(Boolean) as NavItem[];

    const platformNavGroup: NavGroup = {
        title: 'Platform',
        items: [
            {
                title: 'Dashboard',
                href: route('dashboard'),
                icon: LayoutGrid,
            },
        ].filter(Boolean) as NavItem[],
    }

    const adminNavGroup: NavGroup = {
        title: 'Administration',
        items: [
            can('user.view_any') && {
                title: 'Users',
                href: route('app.users.index'),
                icon: Users,
            },
            can('role.view_any') && {
                title: 'Roles',
                href: route('app.roles.index'),
                icon: Shield,
            },
        ].filter(Boolean) as NavItem[],
    }

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
                {hasRole(['admin', 'super-admin']) && <NavSection group={adminNavGroup} />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
