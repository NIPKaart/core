import { getEcho } from '@/echo';
import { useAuthorization } from '@/hooks/use-authorization';
import { scheduleLiveReload } from '@/lib/live-reload';
import { useEffect, useRef } from 'react';

/** Browser event re-dispatching every moderation queue change to the page. */
export const MODERATION_EVENT = 'nipkaart:moderation-changed';

export type ModerationChange = { change: 'added' | 'decided' };

/**
 * Subscribes once per layout to the private `moderation` channel for users who may see part of the queue, and keeps
 * the moderation badge current. Pages react through {@link useModerationChanges}.
 */
export function useModerationChannel(): void {
    const { can } = useAuthorization();
    const allowed = can('parking-space.view_any') || can('parking-space-improvement.view_any') || can('parking-place-report.view_any');

    useEffect(() => {
        if (!allowed) return;
        const echo = getEcho();
        if (!echo) return;

        const channel = echo.private('moderation');
        channel.listen('.moderation.changed', (change: ModerationChange) => {
            scheduleLiveReload(['counts']);
            window.dispatchEvent(new CustomEvent(MODERATION_EVENT, { detail: change }));
        });

        return () => {
            channel.stopListening('.moderation.changed');
            echo.leave('moderation');
        };
    }, [allowed]);
}

/** Calls `onChange` for every live moderation queue change while the component is mounted. */
export function useModerationChanges(onChange: (change: ModerationChange) => void): void {
    const handler = useRef(onChange);
    handler.current = onChange;

    useEffect(() => {
        const listener = (event: Event) => handler.current((event as CustomEvent<ModerationChange>).detail);
        window.addEventListener(MODERATION_EVENT, listener);

        return () => window.removeEventListener(MODERATION_EVENT, listener);
    }, []);
}
