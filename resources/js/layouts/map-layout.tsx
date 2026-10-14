import Navbar from '@/components/frontend/nav/nav-bar';
import type { SavedMapContext } from '@/components/modals/modal-saved';
import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';

interface MapLayoutProps {
    children: React.ReactNode;
    savedMapContext?: SavedMapContext;
    showSearch?: boolean;
    mapSearch?: boolean;
    /** Hide the site navigation below the md breakpoint, for focused task pages with their own header. */
    mobileNavbar?: boolean;
}

export default function MapLayout({ children, showSearch = true, mapSearch = false, mobileNavbar = true, savedMapContext }: MapLayoutProps) {
    useNotifications();

    return (
        <>
            <div className="flex h-[100dvh] flex-col">
                <div className={mobileNavbar ? undefined : 'hidden md:block'}>
                    <Navbar showSearch={showSearch} mapSearch={mapSearch} savedMapContext={savedMapContext} />
                </div>
                {children}
            </div>

            {/* Overlay for search results */}
            {!mapSearch && <SearchOverlay />}
        </>
    );
}
