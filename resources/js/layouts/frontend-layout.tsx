import Navbar from '@/components/frontend/nav/nav-bar';
import SearchOverlay from '@/components/search/search-overlay';
import { useNotifications } from '@/hooks/use-notifications';
import { useSyncLocale } from '@/hooks/use-sync-locale';

interface FrontendLayoutProps {
    children: React.ReactNode;
}

export default function FrontendLayout({ children }: FrontendLayoutProps) {
    useSyncLocale();
    useNotifications();

    return (
        <>
            <div className="bg-white text-black transition-colors dark:bg-neutral-900 dark:text-white">
                <Navbar />
                <main>{children}</main>
            </div>

            {/* Overlay for search results */}
            <SearchOverlay />
        </>
    );
}
