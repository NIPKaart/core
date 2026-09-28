import { cn } from '@/lib/utils';
import {
    CircleAlert,
    CircleCheck,
    CircleDashed,
    CircleX,
    Clock,
    FileSearch,
    Landmark,
    Loader2,
    RefreshCw,
    Warehouse,
    type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Import } from '.';
import type { SourceDescription } from './source-approval';

export const SOURCE_STATUSES = [
    'awaiting_approval',
    'reapproval',
    'intake_problem',
    'overdue',
    'awaiting_review',
    'awaiting_delivery',
    'published',
    'rejected',
] as const;
export type SourceStatusKey = (typeof SOURCE_STATUSES)[number];

export type SourceRow = {
    id: number;
    code: string;
    name: string;
    publisher: string;
    attribution: string;
    terms_url: string;
    source_url: string;
    licence: string | null;
    target_type: 'municipal' | 'offstreet';
    municipality_id: number | null;
    approval_state: 'pending' | 'approved' | 'rejected';
    description: SourceDescription;
    pending_description: SourceDescription | null;
    registration_error: string | null;
    review_reason: string | null;
    latest_import: Pick<Import, 'id' | 'state' | 'retrieved_at'> | null;
    latest_delivery: { state: string; error_code: string | null; created_at: string } | null;
    last_published_retrieved_at: string | null;
    status: SourceStatusKey;
    country: string | null;
    subdivision: string | null;
    municipality_name: string | null;
    municipality_code: string | null;
    visible_locations_count: number;
    needs_review: boolean;
    delivery_status: 'current' | 'awaiting' | 'overdue' | 'unknown';
    processing: boolean;
};

const appearance: Record<SourceStatusKey, { icon: LucideIcon; className: string }> = {
    awaiting_approval: { icon: CircleAlert, className: 'text-amber-700 dark:text-amber-400' },
    reapproval: { icon: RefreshCw, className: 'text-amber-700 dark:text-amber-400' },
    intake_problem: { icon: CircleX, className: 'text-destructive' },
    overdue: { icon: Clock, className: 'text-destructive' },
    awaiting_review: { icon: FileSearch, className: 'text-blue-700 dark:text-blue-400' },
    awaiting_delivery: { icon: CircleDashed, className: 'text-muted-foreground' },
    published: { icon: CircleCheck, className: 'text-emerald-700 dark:text-emerald-400' },
    rejected: { icon: CircleX, className: 'text-muted-foreground' },
};

/** Icon plus text, so the status never depends on colour alone. */
export function SourceStatus({ source, className }: { source: Pick<SourceRow, 'status' | 'processing'>; className?: string }) {
    const { t } = useTranslation('backend/imports');
    const { icon: Icon, className: tone } = source.processing ? { icon: Loader2, className: 'text-muted-foreground' } : appearance[source.status];

    return (
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', tone, className)}>
            <Icon className={cn('size-4 shrink-0', source.processing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            {source.processing ? t('sources_table.processing') : t(`sources_table.statuses.${source.status}`)}
        </span>
    );
}

/** Small uppercase label that tells municipal and offstreet sources apart. */
export function SourceType({ type }: { type: SourceRow['target_type'] }) {
    const { t } = useTranslation('backend/imports');

    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {type === 'offstreet' ? <Warehouse className="size-3" aria-hidden="true" /> : <Landmark className="size-3" aria-hidden="true" />}
            {t(`sources_table.types.${type}`)}
        </span>
    );
}
