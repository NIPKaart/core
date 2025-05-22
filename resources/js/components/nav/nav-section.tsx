import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import type { NavGroup, NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const badgeClass = 'ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100';

function getPath(href?: string) {
    if (!href) return '/';
    try {
        return new URL(href, window.location.origin).pathname.replace(/\/+$/, '') || '/';
    } catch {
        return href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    }
}

function SimpleNavItem({ item, active, iconOnly }: { item: NavItem; active: boolean; iconOnly?: boolean }) {
    return (
        <SidebarMenuItem data-active={active ? 'true' : undefined}>
            <SidebarMenuButton asChild isActive={active} tooltip={{ children: item.title }}>
                <Link href={item.href!} prefetch target={item.target} className={`flex w-full items-center ${iconOnly ? 'justify-center' : ''}`}>
                    {item.icon && <item.icon className={iconOnly ? 'h-5 w-5' : 'mr-2 h-4 w-4'} />}
                    {!iconOnly && <span className="flex-1">{item.title}</span>}
                    {item.badge !== undefined && <SidebarMenuBadge className={badgeClass}>{item.badge}</SidebarMenuBadge>}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

function CollapsibleNavItem({ item, currentUrl }: { item: NavItem; currentUrl: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(!!item.children?.some((sub) => getPath(sub.href) === getPath(currentUrl)));
    }, [currentUrl, item.children]);

    return (
        <Collapsible asChild className="group/collapsible" open={open} onOpenChange={setOpen}>
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title} className="cursor-pointer">
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        <span className="flex-1">{item.title}</span>
                        {item.badge !== undefined && <SidebarMenuBadge className={badgeClass}>{item.badge}</SidebarMenuBadge>}
                        <ChevronRight className="ml-2 h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenu className="mt-1 gap-1 pr-0 pl-4">
                        {(item.children ?? []).map((sub) => (
                            <SimpleNavItem key={sub.title} item={sub} active={getPath(sub.href) === getPath(currentUrl)} />
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

export function NavSection({ group }: { group: NavGroup }) {
    const page = usePage();
    const { state } = useSidebar();

    if (state === 'collapsed') {
        const flat = group.items.flatMap((item) => (item.children?.length ? item.children : item));
        return (
            <SidebarGroup className="px-2 py-0">
                <SidebarMenu>
                    {flat.map((item: NavItem) => (
                        <SimpleNavItem key={item.title} item={item} active={getPath(item.href) === getPath(page.url)} iconOnly />
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        );
    }

    return (
        <SidebarGroup className="px-2 py-0">
            {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
            <SidebarMenu>
                {group.items.map((item) =>
                    item.children?.length ? (
                        <CollapsibleNavItem key={item.title} item={item} currentUrl={page.url} />
                    ) : (
                        <SimpleNavItem key={item.title} item={item} active={getPath(item.href) === getPath(page.url)} />
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
