import { NOTIFICATION_EVENT } from '@/hooks/use-notifications';
import { router, usePoll } from '@inertiajs/react';
import { useEffect } from 'react';

/** Import notifications (a source awaiting approval, a delivery ready for review) share this prefix. */
export function isImportNotification(detail: unknown): boolean {
    const type = (detail as { type?: unknown } | null)?.type;

    return typeof type === 'string' && type.startsWith('dataset.');
}

/**
 * Keeps an import page current without a full refresh: reloads the given props when an import notification
 * arrives, and polls while `inProgress` (deliveries that are processed without sending a notification).
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
        window.addEventListener(NOTIFICATION_EVENT, reload);

        return () => window.removeEventListener(NOTIFICATION_EVENT, reload);
    }, [key]);

    useEffect(() => {
        if (inProgress) {
            start();
        } else {
            stop();
        }

        return stop;
    }, [inProgress, start, stop]);
}
