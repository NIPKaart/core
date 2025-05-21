import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * useMediaQuery
 * 
 * React hook to check if a given media query matches.
 * - By default, returns true if the viewport is smaller than MOBILE_BREAKPOINT (768px).
 * - If you pass a number, it will be treated as a max-width in px (exclusive).
 * - If you pass a string, it will use that as the media query.
 *
 * @param query Optional. Media query string or number (for max-width in px). Defaults to MOBILE_BREAKPOINT.
 * @returns boolean True if the query matches, otherwise false.
 */
export function useMediaQuery(query?: string | number): boolean {
    // Default: mobile if viewport is smaller than MOBILE_BREAKPOINT
    let mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
    if (typeof query === 'string') {
        mediaQuery = query;
    } else if (typeof query === 'number') {
        mediaQuery = `(max-width: ${query - 1}px)`;
    }

    // Set initial state (only on client side)
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(mediaQuery).matches : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia(mediaQuery);
        const listener = () => setMatches(media.matches);

        media.addEventListener('change', listener);
        setMatches(media.matches);

        return () => media.removeEventListener('change', listener);
    }, [mediaQuery]);

    return matches;
}
