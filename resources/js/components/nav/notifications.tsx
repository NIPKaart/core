import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/use-notifications';
import { usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useState } from 'react';

type PageProps = {
    notifications?: { unread: number };
    auth?: { user?: { id: number } | null };
};

export function NotificationsNavButton() {
    const { props } = usePage<PageProps>();
    const unread = props.notifications?.unread ?? 0;

    const [bump, setBump] = useState(false);
    useNotifications(() => {
        setBump(true);
        const t = setTimeout(() => setBump(false), 800);
        return () => clearTimeout(t);
    });

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="View notifications" className="relative cursor-pointer rounded-full">
                        <Bell className={`h-5 w-5 ${bump ? 'animate-pulse' : ''}`} />
                        {unread > 0 && <span className="absolute top-[6px] right-[6px] h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                    Notifications
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
