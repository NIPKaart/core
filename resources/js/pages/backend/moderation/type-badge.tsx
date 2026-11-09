import { Badge } from '@/components/ui/badge';
import { Flag, MapPinPlus, MapPinned, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HistoryType } from './types';

export const TYPE_ICONS = { submission: MapPinPlus, improvement: PencilLine, report: Flag, proposal: MapPinned } satisfies Record<
    HistoryType,
    unknown
>;

/** The kind of moderation item, the same everywhere it is shown. */
export function TypeBadge({ type }: { type: HistoryType }) {
    const { t } = useTranslation('backend/moderation');
    const Icon = TYPE_ICONS[type];

    return (
        <Badge variant="outline">
            <Icon aria-hidden />
            {t(`types.${type}`)}
        </Badge>
    );
}
