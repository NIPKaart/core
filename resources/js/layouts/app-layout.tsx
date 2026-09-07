import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';
import { useSyncLocale } from '@/hooks/use-sync-locale';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode } from 'react';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => {
    useSyncLocale();
    useNotifications();

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {children}

            {/* Overlay for search results */}
            <SearchOverlay />
        </AppLayoutTemplate>
    );
};
