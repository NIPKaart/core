import { update } from '@/actions/App/Http/Controllers/Admin/DatasetSourceController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Form } from '@inertiajs/react';
import { CircleAlert, CircleX, ExternalLink, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type SourceDescription = {
    name: string;
    publisher: string;
    source_url: string;
    licence: string | null;
    terms_url: string;
    attribution: string;
    area: { country: string; subdivision: string; municipality: { scheme: string; code: string; name: string } };
    bounds: [number, number, number, number];
    expected_interval_hours: number;
};

type Props = {
    source: {
        id: number;
        target_type?: 'municipal' | 'offstreet';
        approval_state: 'pending' | 'approved' | 'rejected';
        description: SourceDescription;
        pending_description: SourceDescription | null;
        registration_error: string | null;
        review_reason: string | null;
    };
    /** Shown between the instruction and the facts, such as alerts and delivery figures. */
    children?: ReactNode;
    /** Placed beside the decision in the footer. */
    history?: ReactNode;
};

/** Fields whose change requires approval again; the delivery interval is excluded (ADR 0013). */
const approvedFields = ['name', 'publisher', 'source_url', 'licence', 'terms_url', 'attribution', 'area', 'bounds'] as const;
type ApprovedField = (typeof approvedFields)[number];

export function changedFields(approved: SourceDescription, proposed: SourceDescription | null): ApprovedField[] {
    if (!proposed) return [];
    return approvedFields.filter((field) => JSON.stringify(approved[field]) !== JSON.stringify(proposed[field]));
}

/**
 * The sheet body and footer while a source awaits a decision: what to check, the facts, and the
 * decision fixed at the bottom so a long attribution never pushes it out of view.
 */
export default function SourceApproval({ source, children, history }: Props) {
    const { t } = useTranslation('backend/imports');
    const shown = source.pending_description ?? source.description;
    const changed = changedFields(source.description, source.pending_description);
    const rejected = source.approval_state === 'rejected';
    const reasonId = `source-approval-reason-${source.id}`;

    const link = (href: string, label: string) => (
        <a className="inline-flex items-center gap-1 underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
            {label}
            <ExternalLink className="size-3" aria-hidden="true" />
            <span className="sr-only">({t('sources_table.new_tab')})</span>
        </a>
    );

    const row = (label: string, fields: ApprovedField[], value: ReactNode, previous?: ReactNode, className?: string) => {
        const isChanged = fields.some((field) => changed.includes(field));

        return (
            <div className="flex gap-4 px-4 py-3">
                <dt className="w-28 shrink-0 text-muted-foreground">
                    {label}
                    {isChanged && (
                        <Badge className="mt-1 flex border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                            {t('approval.changed')}
                        </Badge>
                    )}
                </dt>
                <dd className="min-w-0 flex-1 break-words">
                    <span className={className}>{value}</span>
                    {isChanged && previous !== undefined && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                            {t('approval.previous')}: <s>{previous}</s>
                        </span>
                    )}
                </dd>
            </div>
        );
    };

    const approved = source.description;

    return (
        <Form {...update.form(source.id)} options={{ preserveScroll: true }} className="flex min-h-0 flex-1 flex-col">
            {({ errors, processing }) => (
                <>
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                        <div
                            className={cn(
                                'space-y-2 rounded-xl border p-4 text-sm',
                                rejected ? 'bg-muted/50' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
                            )}
                        >
                            <p className="flex items-start gap-2.5 font-medium">
                                {rejected ? (
                                    <CircleX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                ) : (
                                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                                )}
                                {t(rejected ? 'approval.rejected_hint' : 'approval.hint')}
                            </p>
                            {rejected && source.review_reason && (
                                <p className="pl-6.5 text-muted-foreground">
                                    {t('approval.reason')}: {source.review_reason}
                                </p>
                            )}
                        </div>
                        {source.registration_error && (
                            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                {source.registration_error}
                            </p>
                        )}
                        {children}
                        <section aria-labelledby={`source-approval-${source.id}`} className="space-y-2">
                            <h3 id={`source-approval-${source.id}`} className="text-sm font-semibold">
                                {t(rejected ? 'sheet.about' : 'approval.title')}
                            </h3>
                            <dl className="divide-y rounded-xl border text-sm">
                                {changed.includes('name') && row(t('approval.fields.name'), ['name'], shown.name, approved.name)}
                                {row(
                                    t('approval.fields.licence'),
                                    ['licence'],
                                    shown.licence ?? t('approval.no_licence'),
                                    approved.licence ?? t('approval.no_licence'),
                                    shown.licence ? 'font-semibold' : 'font-semibold text-destructive',
                                )}
                                {row(t('approval.fields.publisher'), ['publisher'], shown.publisher, approved.publisher)}
                                {row(
                                    t('approval.fields.area'),
                                    ['area', 'bounds'],
                                    <>
                                        {shown.area.municipality.name} <span className="text-muted-foreground">({shown.area.municipality.code})</span>
                                        <span className="block text-muted-foreground">
                                            {shown.area.subdivision} · {shown.area.country}
                                        </span>
                                        <span className="mt-1 block font-mono text-xs text-muted-foreground" title={t('approval.fields.bounds')}>
                                            <span className="sr-only">{t('approval.fields.bounds')}: </span>
                                            {shown.bounds.join(', ')}
                                        </span>
                                    </>,
                                )}
                                {row(t('approval.fields.interval'), [], t('approval.hours', { count: shown.expected_interval_hours }))}
                                {source.target_type === 'offstreet' && row(t('approval.fields.occupancy'), [], t('approval.occupancy_interval'))}
                                {row(
                                    t('approval.fields.attribution'),
                                    ['attribution'],
                                    shown.attribution,
                                    approved.attribution,
                                    'text-muted-foreground',
                                )}
                                {row(
                                    t('approval.fields.links'),
                                    ['source_url', 'terms_url'],
                                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                                        {link(shown.source_url, t('approval.fields.source_url'))}
                                        {link(shown.terms_url, t('approval.fields.terms_url'))}
                                    </span>,
                                )}
                            </dl>
                        </section>
                        <div className="space-y-1.5">
                            <Label htmlFor={reasonId}>{t('approval.reason_label')}</Label>
                            <Textarea id={reasonId} name="reason" maxLength={2000} rows={2} placeholder={t('approval.reason_placeholder')} />
                            {Object.entries(errors).map(([field, message]) => (
                                <InputError key={field} message={message} />
                            ))}
                        </div>
                    </div>
                    <div className="grid shrink-0 auto-cols-fr grid-flow-col gap-2 border-t px-6 py-4">
                        {history}
                        {!rejected && (
                            <Button type="submit" name="decision" value="reject" variant="outline" className="min-h-11" disabled={processing}>
                                {t('approval.reject')}
                            </Button>
                        )}
                        <Button type="submit" name="decision" value="approve" className="min-h-11" disabled={processing}>
                            {t('approval.approve')}
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
