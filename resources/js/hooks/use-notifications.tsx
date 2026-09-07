import { getEcho } from '@/echo';
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

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
        };

        channel.notification(handler);

        return () => {
            channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated');
            echo.leave(channelName);
        };
    }, [userId, onNew]);
}
