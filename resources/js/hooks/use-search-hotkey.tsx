import { openSearch } from '@/components/search/search-store';
import { useEffect } from 'react';

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

/**
 * Bind ⌘K (Mac) of Ctrl+K (Win/Linux) to open the search overlay.
 */
export function useSearchHotkey(): void {
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key.toLowerCase() !== 'k') return;

            if ((isMac() && e.metaKey) || (!isMac() && e.ctrlKey)) {
                e.preventDefault();
                openSearch();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
}
