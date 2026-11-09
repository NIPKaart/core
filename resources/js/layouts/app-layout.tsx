import SearchOverlay from '@/components/search/search-overlay';
import { useDatasetChannel } from '@/hooks/use-dataset-changes';
import { useModerationChannel } from '@/hooks/use-moderation-changes';
import { useNotifications } from '@/hooks/use-notifications';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode } from 'react';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

export default ({ children, breadcrumbs, ...props }: AppLayoutProps) => {
    useNotifications();
    useDatasetChannel();
    useModerationChannel();

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {children}

            {/* Overlay for search results */}
            <SearchOverlay />
        </AppLayoutTemplate>
    );
};
