import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/use-notifications';
import { usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useState } from 'react';

type Props = {
    hasUnread: boolean;
    closeMobileMenu?: () => void;
};

export function NotificationsNavButton({ hasUnread }: Props) {
    const { props } = usePage();
    const baseUnread = (props as any).auth?.unread_notifications ?? 0;
    const [bump, setBump] = useState(false);

    useNotifications(() => {
        setBump(true);
        setTimeout(() => setBump(false), 800);
    });

    const unread = (props as any).auth?.unread_notifications ?? 0;

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View notifications"
                            className="relative cursor-pointer rounded-full"
                            // onClick={() => setOpen(true)}
                        >
                            <Bell className="h-5 w-5" />
                            {unread > 0 && <span className="absolute top-[6px] right-[6px] h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center">
                        Notifications
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* <NotificationsDialog open={open} onClose={handleClose} /> */}
        </>
    );
}
