import { echo } from '@/echo';
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

export function useNotifications(onNew?: (payload: any) => void) {
    const { props } = usePage();
    const user = (props as any).auth?.user;

    useEffect(() => {
        if (!user?.id) return;

        const channelName = `App.Models.User.${user.id}`;
        const fullName = `private-${channelName}`;

        const handler = (notification: any) => {
            onNew?.(notification);
            router.reload({ only: ['auth'] });
        };

        const channel = echo.private(channelName);
        channel.notification(handler);

        return () => {
            try {
                channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated');
                echo.leave(fullName);
            } catch {
                /* no-op */
            }
        };
    }, [user?.id, onNew]);
}
