import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { Bell } from 'lucide-react';
import { useState } from 'react';

type Props = {
    hasUnread: boolean;
    closeMobileMenu?: () => void;
};

export function NotificationsNavButton({ hasUnread, closeMobileMenu }: Props) {
    const { user } = useAuthorization();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    function handleClose() {
        setOpen(false);
        closeMobileMenu?.();
    }

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
                            onClick={() => setOpen(true)}
                        >
                            <Bell className="h-5 w-5" />
                            {hasUnread && <span className="absolute top-[6px] right-[6px] h-2 w-2 rounded-full bg-red-500" />}
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
