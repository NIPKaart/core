import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { router } from '@inertiajs/react';
import BellBadge from './notifications/badge-bell';
import SearchBar from './search/search-bar';
import SearchButton from './search/search-button';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" onClick={() => router.flushAll()} />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <div className="ml-auto flex items-center gap-2">
                {/* Desktop: bar + bell */}
                <SearchBar className="w-[420px]" placeholder="Search users, roles, parking…" />
                <div className="hidden md:block">
                    <BellBadge />
                </div>

                {/* Mobile: icon + bell */}
                <div className="flex items-center gap-2 md:hidden">
                    <SearchButton variant="icon" tooltip="Search" />
                    <BellBadge />
                </div>
            </div>
        </header>
    );
}
