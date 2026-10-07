import { update } from '@/actions/App/Http/Controllers/Admin/DatasetSourceController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { translateSourceValue } from '@/utils/translation';
import { Form } from '@inertiajs/react';
import { ExternalLink, TriangleAlert } from 'lucide-react';
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
        approval_state: 'pending' | 'approved' | 'rejected';
        description: SourceDescription;
        pending_description: SourceDescription | null;
        registration_error: string | null;
        review_reason: string | null;
    };
};

/** Fields whose change requires approval again; the delivery interval is excluded (ADR 0013). */
const approvedFields = ['name', 'publisher', 'source_url', 'licence', 'terms_url', 'attribution', 'area', 'bounds'] as const;

export function changedFields(approved: SourceDescription, proposed: SourceDescription | null): string[] {
    if (!proposed) return [];
    return approvedFields.filter((field) => JSON.stringify(approved[field]) !== JSON.stringify(proposed[field]));
}

export default function SourceApproval({ source }: Props) {
    const { t } = useTranslation('backend/imports');
    const shown = source.pending_description ?? source.description;
    const changed = changedFields(source.description, source.pending_description);
    const link = (href: string, label: string) => (
        <a className="inline-flex items-center gap-1 underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
            {label}
            <ExternalLink className="size-3" aria-hidden="true" />
        </a>
    );

    return (
        <section
            aria-labelledby={`source-approval-${source.id}`}
            className="space-y-4 rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20"
        >
            <div className="space-y-1">
                <h3 id={`source-approval-${source.id}`} className="font-semibold">
                    {t(
                        source.approval_state === 'rejected'
                            ? 'approval.rejected_title'
                            : changed.length
                              ? 'approval.reapproval_title'
                              : 'approval.title',
                    )}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t(source.approval_state === 'rejected' ? 'approval.rejected_hint' : 'approval.hint')}
                </p>
            </div>
            {source.registration_error && (
                <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {source.registration_error}
                </p>
            )}
            {changed.length > 0 && (
                <p className="text-sm">
                    {t('approval.changed_fields')}:{' '}
                    {changed.map((field) => translateSourceValue('backend/imports', `approval.fields.${field}`)).join(', ')}
                </p>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">{t('approval.fields.publisher')}</dt>
                <dd>{shown.publisher}</dd>
                <dt className="text-muted-foreground">{t('approval.fields.licence')}</dt>
                <dd className={shown.licence ? 'font-medium' : 'text-destructive'}>{shown.licence ?? t('approval.no_licence')}</dd>
                <dt className="text-muted-foreground">{t('approval.fields.area')}</dt>
                <dd>
                    {shown.area.municipality.name} ({shown.area.municipality.code}) · {shown.area.subdivision} · {shown.area.country}
                </dd>
                <dt className="text-muted-foreground">{t('approval.fields.bounds')}</dt>
                <dd className="font-mono text-xs">{shown.bounds.join(', ')}</dd>
                <dt className="text-muted-foreground">{t('approval.fields.interval')}</dt>
                <dd>{t('approval.hours', { count: shown.expected_interval_hours })}</dd>
                <dt className="text-muted-foreground">{t('approval.fields.attribution')}</dt>
                <dd>{shown.attribution}</dd>
                <dt className="text-muted-foreground">{t('approval.fields.links')}</dt>
                <dd className="flex flex-wrap gap-4">
                    {link(shown.source_url, t('source'))}
                    {link(shown.terms_url, t('terms'))}
                </dd>
            </dl>
            {source.review_reason && source.approval_state === 'rejected' && (
                <p className="text-sm">
                    {t('approval.reason')}: {source.review_reason}
                </p>
            )}
            <Form {...update.form(source.id)} options={{ preserveScroll: true }} className="space-y-3">
                {({ errors, processing }) => (
                    <>
                        <Textarea
                            name="reason"
                            maxLength={2000}
                            rows={2}
                            aria-label={t('approval.reason')}
                            placeholder={t('approval.reason_placeholder')}
                        />
                        {Object.entries(errors).map(([field, message]) => (
                            <InputError key={field} message={message} />
                        ))}
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" name="decision" value="approve" disabled={processing}>
                                {t('approval.approve')}
                            </Button>
                            {source.approval_state !== 'rejected' && (
                                <Button type="submit" name="decision" value="reject" variant="outline" disabled={processing}>
                                    {t('approval.reject')}
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </Form>
        </section>
    );
}
