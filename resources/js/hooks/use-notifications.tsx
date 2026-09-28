import { getEcho } from '@/echo';
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

/** Browser event re-dispatching every live notification to the page. */
export const NOTIFICATION_EVENT = 'nipkaart:notification';

type PageProps = {
    notifications?: { unread: number; recent: unknown[] };
    auth?: { user?: { id: number } | null };
};

export function useNotifications(onNew?: (payload: unknown) => void) {
    const { props } = usePage<PageProps>();
    const userId = props.auth?.user?.id;

    useEffect(() => {
        if (!userId) return;

        const echo = getEcho();
        if (!echo) return;

        const channelName = `App.Models.User.${userId}`;
        const channel = echo.private(channelName);

        const handler = (notification: unknown) => {
            onNew?.(notification);
            router.reload({ only: ['notifications'] });
            // Pages can refresh their own data for relevant notifications without a second Echo listener.
            window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: notification }));
        };

        channel.notification(handler);

        return () => {
            channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated');
            echo.leave(channelName);
        };
    }, [userId, onNew]);
}
