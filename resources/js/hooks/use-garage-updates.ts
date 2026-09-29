import { getEcho } from '@/echo';
import { router, usePoll } from '@inertiajs/react';
import { useEffect } from 'react';

/** Re-checked on this interval too, so a measurement that is no longer current stops looking live. */
const REFRESH_MS = 120_000;

/** Reloads the given garage props when new observations are applied, and on a fallback interval. */
export function useGarageUpdates(only: string[]): void {
    const key = only.join(',');

    usePoll(REFRESH_MS, { only });

    useEffect(() => {
        const reload = () => router.reload({ only: key.split(',') });
        const channel = getEcho()?.channel('parking-offstreet');
        channel?.listen('.observations.applied', reload);

        // Only this listener is removed: other components may share the channel.
        return () => {
            channel?.stopListening('.observations.applied', reload);
        };
    }, [key]);
}
