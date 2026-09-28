import { getEcho } from '@/echo';
import { DATASET_EVENT } from '@/hooks/use-dataset-changes';
import { NOTIFICATION_EVENT } from '@/hooks/use-notifications';
import { router, usePoll } from '@inertiajs/react';
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
    const { start, stop } = usePoll(intervalMs, { only }, { autoStart: false, mode: 'rest' });

    useEffect(() => {
        const reload = (event: Event) => {
            if (isImportNotification((event as CustomEvent).detail)) {
                router.reload({ only: key.split(',') });
            }
        };
        const reloadAll = () => router.reload({ only: key.split(',') });
        window.addEventListener(NOTIFICATION_EVENT, reload);
        window.addEventListener(DATASET_EVENT, reloadAll);

        return () => {
            window.removeEventListener(NOTIFICATION_EVENT, reload);
            window.removeEventListener(DATASET_EVENT, reloadAll);
        };
    }, [key]);

    useEffect(() => {
        // Live changes cover processing; polling is the fallback when the live connection is not configured.
        if (inProgress && !getEcho()) {
            start();
        } else {
            stop();
        }

        return stop;
    }, [inProgress, start, stop]);
}
