import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { NavSections } from '@/components/nav/nav-sections';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';
import { NavGroup, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, Shield, Users } from 'lucide-react';
import AppLogo from './app-logo';

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
        target: '_blank',
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits',
        icon: BookOpen,
        target: '_blank',
    },
    {
        title: 'Back to Frontend',
        href: route('home'),
        icon: LayoutGrid,
    },
];

export function AppSidebar() {
    const { can, hasRole } = useAuthorization();

    const navGroups: NavGroup[] = [
        {
            title: 'Platform',
            items: [
                {
                    title: 'Dashboard',
                    href: '/dashboard',
                    icon: LayoutGrid,
                },
            ],
        },
        hasRole(['admin', 'moderator']) && {
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
            ].filter(Boolean),
        },
    ].filter(Boolean) as NavGroup[];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* <NavSection group={mainNavGroup} /> */}
                <NavSections groups={navGroups} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
