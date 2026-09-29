import Navbar from '@/components/frontend/nav/nav-bar';
import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';
import { useSyncLocale } from '@/hooks/use-sync-locale';

interface MapLayoutProps {
    children: React.ReactNode;
    showSearch?: boolean;
    mapSearch?: boolean;
    /** Hide the site navigation below the md breakpoint, for focused task pages with their own header. */
    mobileNavbar?: boolean;
}

export default function MapLayout({ children, showSearch = true, mapSearch = false, mobileNavbar = true }: MapLayoutProps) {
    useSyncLocale();
    useNotifications();

    return (
        <>
            <div className="flex h-[100dvh] flex-col">
                <div className={mobileNavbar ? undefined : 'hidden md:block'}>
                    <Navbar showSearch={showSearch} mapSearch={mapSearch} />
                </div>
                {children}
            </div>

            {/* Overlay for search results */}
            {!mapSearch && <SearchOverlay />}
        </>
    );
}
