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
    return new URL(href ?? '/', 'https://navigation.local').pathname.replace(/\/+$/, '') || '/';
}

export function isNavigationItemActive(item: NavItem, currentUrl: string, siblings: NavItem[] = []): boolean {
    if (item.isActive !== undefined) return item.isActive;
    const path = getPath(typeof item.href === 'string' ? item.href : item.href?.url);
    const current = getPath(currentUrl);
    if (path === current) return true;
    if (path === '/' || !current.startsWith(`${path}/`)) return false;
    return !siblings.some((sibling) => {
        const siblingPath = getPath(typeof sibling.href === 'string' ? sibling.href : sibling.href?.url);
        return siblingPath !== path && siblingPath.startsWith(`${path}/`) && (current === siblingPath || current.startsWith(`${siblingPath}/`));
    });
}

function SimpleNavItem({ item, active, iconOnly }: { item: NavItem; active: boolean; iconOnly?: boolean }) {
    return (
        <SidebarMenuItem data-active={(item.isActive ?? active) ? 'true' : undefined}>
            <SidebarMenuButton asChild isActive={item.isActive ?? active} tooltip={{ children: item.title }}>
                <Link
                    href={`${typeof item.href === 'string' ? item.href : (item.href?.url ?? '/')}`}
                    prefetch
                    aria-current={(item.isActive ?? active) ? 'page' : undefined}
                    target={item.target}
                    className={`flex w-full items-center ${iconOnly ? 'justify-center' : ''}`}
                >
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
        setOpen(!!item.children?.some((sub) => isNavigationItemActive(sub, currentUrl, item.children)));
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
                    <SidebarMenu className="relative mt-1">
                        <span className="absolute top-0 bottom-0 left-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                        <div className="pl-7">
                            {(item.children ?? []).map((sub) => (
                                <SimpleNavItem key={sub.title} item={sub} active={isNavigationItemActive(sub, currentUrl, item.children)} />
                            ))}
                        </div>
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
                        <SimpleNavItem key={item.title} item={item} active={isNavigationItemActive(item, page.url, group.items)} iconOnly />
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
                        <SimpleNavItem key={item.title} item={item} active={isNavigationItemActive(item, page.url, group.items)} />
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
