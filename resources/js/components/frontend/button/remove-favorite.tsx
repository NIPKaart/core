import { Button } from '@/components/ui/button';
import profile from '@/routes/profile';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function RemoveFavoriteButton({ favoriteId, onRemoved }: { favoriteId: number; onRemoved?: () => void }) {
    const { t } = useTranslation('frontend/map/favorites');
    const [busy, setBusy] = useState(false);

    return (
        <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
                setBusy(true);
                router.delete(profile.favorites.destroy(), {
                    data: { favorite_id: favoriteId },
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => onRemoved?.(),
                    onError: () => toast.error(t('remove_error')),
                    onFinish: () => setBusy(false),
                });
            }}
        >
            {t('remove')}
        </Button>
    );
}
