import Navbar from '@/components/frontend/nav/nav-bar';
import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';
import { useSyncLocale } from '@/hooks/use-sync-locale';

interface MapLayoutProps {
    children: React.ReactNode;
    showSearch?: boolean;
    mapSearch?: boolean;
}

export default function MapLayout({ children, showSearch = true, mapSearch = false }: MapLayoutProps) {
    useSyncLocale();
    useNotifications();

    return (
        <>
            <div className="flex h-[100dvh] flex-col">
                <Navbar showSearch={showSearch} mapSearch={mapSearch} />
                {children}
            </div>

            {/* Overlay for search results */}
            {!mapSearch && <SearchOverlay />}
        </>
    );
}
