import SavedDialog, { type SavedMapContext } from '@/components/modals/modal-saved';
import { closeSearch } from '@/components/search/search-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { Bookmark } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function SavedButton({ closeMobileMenu, mapContext }: { closeMobileMenu?: () => void; mapContext?: SavedMapContext }) {
    const { t } = useTranslation('frontend/map/saved');
    const { user } = useAuthorization();
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);

    if (!user) return null;

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={trigger}
                            variant="ghost"
                            size="icon"
                            aria-label={t('title')}
                            className="cursor-pointer rounded-full"
                            onClick={() => {
                                closeSearch();
                                closeMobileMenu?.();
                                setOpen(true);
                            }}
                        >
                            <Bookmark className="size-5" aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center">
                        {t('title')}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <SavedDialog open={open} onClose={() => setOpen(false)} mapContext={mapContext} onReturnFocus={() => trigger.current?.focus()} />
        </>
    );
}
