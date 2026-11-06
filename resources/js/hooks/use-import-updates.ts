import { getEcho } from '@/echo';
import { DATASET_EVENT, type DatasetChange } from '@/hooks/use-dataset-changes';
import { NOTIFICATION_EVENT } from '@/hooks/use-notifications';
import { scheduleLiveReload } from '@/lib/live-reload';
import { usePoll } from '@inertiajs/react';
import { useEffect } from 'react';

/** Import notifications (a source awaiting approval, a delivery ready for review) share this prefix. */
export function isImportNotification(detail: unknown): boolean {
    const type = (detail as { type?: unknown } | null)?.type;

    return typeof type === 'string' && type.startsWith('dataset.');
}

/**
 * Keeps an import page current without a full refresh: reloads the given props when data changes live
 * (dataset changes and import notifications). Without a live connection it polls while `inProgress`.
 */
export function useImportUpdates(only: string[], inProgress: boolean, intervalMs = 10000): void {
    const key = only.join(',');
    const { start, stop } = usePoll(intervalMs, { only, showProgress: false }, { autoStart: false, mode: 'rest' });

    useEffect(() => {
        const reload = (event: Event) => {
            if (isImportNotification((event as CustomEvent).detail)) {
                scheduleLiveReload(key.split(','));
            }
        };
        // Live occupancy arrives every few minutes and is not shown on import pages.
        const reloadAll = (event: Event) => {
            if ((event as CustomEvent<DatasetChange>).detail?.scope !== 'observations') {
                scheduleLiveReload(key.split(','));
            }
        };
        window.addEventListener(NOTIFICATION_EVENT, reload);
        window.addEventListener(DATASET_EVENT, reloadAll);

        return () => {
            window.removeEventListener(NOTIFICATION_EVENT, reload);
            window.removeEventListener(DATASET_EVENT, reloadAll);
        };
    }, [key]);

    useEffect(() => {
        const connection = getEcho()?.connector.pusher.connection;
        const update = (change?: { previous: string; current: string }) => {
            if (inProgress && connection?.state !== 'connected') {
                start();
            } else {
                stop();
            }
            // Catch up with broadcasts missed during a disconnection.
            if (change?.current === 'connected') scheduleLiveReload(key.split(','));
        };
        update();
        connection?.bind('state_change', update);

        return () => {
            connection?.unbind('state_change', update);
            stop();
        };
    }, [inProgress, key, start, stop]);
}
