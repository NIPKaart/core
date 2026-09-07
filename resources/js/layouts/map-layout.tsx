import Navbar from '@/components/frontend/nav/nav-bar';
import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';
import { useSyncLocale } from '@/hooks/use-sync-locale';

interface MapLayoutProps {
    children: React.ReactNode;
}

export default function MapLayout({ children }: MapLayoutProps) {
    useSyncLocale();
    useNotifications();

    return (
        <>
            <div className="flex h-[100dvh] flex-col">
                <Navbar />
                {children}
            </div>

            {/* Overlay for search results */}
            <SearchOverlay />
        </>
    );
}
