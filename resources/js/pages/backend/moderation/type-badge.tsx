import { Badge } from '@/components/ui/badge';
import { Flag, MapPinPlus, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ItemType } from './types';

const ICONS = { submission: MapPinPlus, improvement: PencilLine, report: Flag } satisfies Record<ItemType, unknown>;

/** The kind of moderation item, the same everywhere it is shown. */
export function TypeBadge({ type }: { type: ItemType }) {
    const { t } = useTranslation('backend/moderation');
    const Icon = ICONS[type];

    return (
        <Badge variant="outline">
            <Icon aria-hidden />
            {t(`types.${type}`)}
        </Badge>
    );
}
