import FavoritesDialog from '@/components/modals/modal-favorites';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function FavoritesButton({ closeMobileMenu }: { closeMobileMenu?: () => void }) {
    const { t } = useTranslation('frontend/map/favorites');
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
                            aria-label={t('view')}
                            className="cursor-pointer rounded-full"
                            onClick={() => setOpen(true)}
                        >
                            <Heart className="h-5 w-5 text-red-500" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center">
                        {t('label')}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <FavoritesDialog open={open} onClose={() => setOpen(false)} onGotoLocation={handleGotoLocation} />
        </>
    );
}
