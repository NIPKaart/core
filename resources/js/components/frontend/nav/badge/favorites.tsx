import FavoritesDialog from '@/components/modals/modal-favorites';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { Heart } from 'lucide-react';
import { useState } from 'react';

export function FavoritesButton({ closeMobileMenu }: { closeMobileMenu?: () => void }) {
    const { user } = useAuthorization();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    function handleGotoLocation() {
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
                            aria-label="View favorites"
                            className="cursor-pointer rounded-full"
                            onClick={() => setOpen(true)}
                        >
                            <Heart className="h-5 w-5 text-red-500" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center">
                        Favorites
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <FavoritesDialog open={open} onClose={() => setOpen(false)} onGotoLocation={handleGotoLocation} />
        </>
    );
}
