import { Button } from '@/components/ui/button';
import { useAuthorization } from '@/hooks/use-authorization';
import profile from '@/routes/profile';
import { router } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { useState } from 'react';

type FavoriteType = 'parking_space' | 'parking_municipal' | 'parking_offstreet';

type FavoriteButtonProps = {
    initial: boolean;
    id: string;
    type: FavoriteType;
};

export function FavoriteButton({ initial, id, type }: FavoriteButtonProps) {
    const { user } = useAuthorization();
    const [isFavorited, setIsFavorited] = useState(initial);
    const [loading, setLoading] = useState(false);

    async function toggleFavorite() {
        if (!user || loading) return;
        setLoading(true);
        if (isFavorited) {
            router.delete(profile.favorites.destroy(), {
                data: { type, id },
                preserveScroll: true,
                preserveState: true,
                only: [],
                onSuccess: () => setIsFavorited(false),
                onFinish: () => setLoading(false),
            });
        } else {
            router.post(
                profile.favorites.store(),
                { type, id },
                {
                    preserveScroll: true,
                    preserveState: true,
                    only: [],
                    onSuccess: () => setIsFavorited(true),
                    onFinish: () => setLoading(false),
                },
            );
        }
    }

    if (!user) return null;

    return (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleFavorite}
            aria-label={isFavorited ? 'Remove favorite' : 'Add favorite'}
            disabled={loading}
            className={`cursor-pointer transition ${isFavorited ? 'text-red-500' : 'text-black hover:text-red-500'} `}
        >
            <Heart
                className="h-5 w-5"
                fill={isFavorited ? '#ef4444' : 'none'} // Tailwind red-500
            />
        </Button>
    );
}
