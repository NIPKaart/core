import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { NavGroup } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavSection({ group }: { group: NavGroup }) {
    const page = usePage();

    return (
        <SidebarGroup className="px-2 py-0">
            {group.title && <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">{group.title}</SidebarGroupLabel>}
            <SidebarMenu>
                {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={page.url === item.href} tooltip={{ children: item.title }}>
                            <Link href={item.href} prefetch target={item.target}>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>

                        {item.badge !== undefined && (
                            <SidebarMenuBadge className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                                {item.badge}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
