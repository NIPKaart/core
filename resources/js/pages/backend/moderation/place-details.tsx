import { getOrientationIllustration } from '@/components/map/parking-detail/utils';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { EnumOption } from './values';

/**
 * The orientation beside a compact illustration. When the moderator changed it, what was submitted stays visible.
 */
export function OrientationCard({
    orientation,
    submitted,
    action,
    editor,
}: {
    orientation: EnumOption | null;
    /** What was submitted, when it differs from the orientation shown. */
    submitted?: string | null;
    action?: React.ReactNode;
    editor?: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');

    return (
        <div className="flex items-center gap-3 border-b pb-3">
            <img src={getOrientationIllustration(orientation, 'wide')} alt="" className="h-20 w-28 shrink-0 object-contain" />
            <div className="flex min-w-0 flex-1 items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        {t('groups.orientation')}
                        {submitted && <EditedDot />}
                    </span>
                    {editor || <span className="text-base font-semibold">{orientation?.label ?? t('values.unknown')}</span>}
                    {submitted && <span className="text-xs text-orange-700 dark:text-orange-400">{t('review.edited', { value: submitted })}</span>}
                </div>
                {action}
            </div>
        </div>
    );
}

export type DetailRow = {
    key: string;
    label: string;
    value: React.ReactNode;
    /** What was submitted, when the moderator changed this row. */
    submitted?: string | null;
    /** A quiet line below the value. */
    note?: React.ReactNode;
    editor?: React.ReactNode;
    action?: React.ReactNode;
};

/** The parking space's details as a hairline list, labels on the left and values beside them, as on the public map. */
export function DetailRows({ rows }: { rows: DetailRow[] }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <dl className="divide-y">
            {rows.map((row) => (
                <div key={row.key} className={cn('flex items-start gap-3 py-2 text-sm', row.editor && 'flex-col items-stretch')}>
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <dt className="flex w-24 shrink-0 items-center gap-1.5 pt-0.5 text-muted-foreground">
                            {row.label}
                            {row.submitted && <EditedDot />}
                        </dt>
                        <dd className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                            {!row.editor && <span className="font-medium wrap-break-word">{row.value}</span>}
                            {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
                            {row.submitted && (
                                <span className="text-xs text-orange-700 dark:text-orange-400">{t('review.edited', { value: row.submitted })}</span>
                            )}
                        </dd>
                        {row.action}
                    </div>
                    {row.editor}
                </div>
            ))}
        </dl>
    );
}

function EditedDot() {
    return <span className="size-1.5 rounded-full bg-orange-500" aria-hidden />;
}
