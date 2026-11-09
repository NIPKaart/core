import { index, show } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import MunicipalDateTime from '@/components/municipal-date-time';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import parkingMunicipal from '@/routes/app/parking-municipal';
import { Link } from '@inertiajs/react';
import { ArrowRight, ExternalLink, FileSearch, History, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SourceApproval from './source-approval';
import { SourceStatus, SourceType, type SourceRow } from './source-status';

type Props = { source: SourceRow | null; onClose: () => void };

/** Details and actions for one source, opened from the overview table. */
export default function SourceSheet({ source, onClose }: Props) {
    const { t, i18n } = useTranslation('backend/imports');
    const description = source?.pending_description ?? source?.description;
    const external = (href: string, label: string) => (
        <a className="inline-flex items-center gap-1 underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
            {label}
            <ExternalLink className="size-3" aria-hidden="true" />
            <span className="sr-only">({t('sources_table.new_tab')})</span>
        </a>
    );

    const row = (label: string, value: React.ReactNode, className?: string) => (
        <div className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
            <dd className={cn('min-w-0 flex-1 break-words', className)}>{value}</dd>
        </div>
    );

    if (!source || !description) {
        return (
            <Sheet open={false} onOpenChange={(open) => !open && onClose()}>
                <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" />
            </Sheet>
        );
    }

    const awaitingApproval = source.approval_state !== 'approved';
    const proposalSource = source.target_type === 'proposals';
    const lastRetrieved = source.last_proposal_retrieved_at ?? source.latest_import?.retrieved_at;
    const hasDeliveries = lastRetrieved != null || source.last_published_retrieved_at !== null;
    const alerts = (
        <>
            {source.status === 'intake_problem' && (
                <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                    {t('intake_problem')}
                </p>
            )}
            {source.status === 'live_stale' && source.latest_observation_at && (
                <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                    {t('live_stale', {
                        time: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                            new Date(source.latest_observation_at),
                        ),
                    })}
                </p>
            )}
            {source.needs_review && source.latest_import && (
                <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                    <p className="flex items-start gap-2.5 text-sm font-medium">
                        <FileSearch className="mt-0.5 size-4 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                        {t('sheet.review_ready')}
                    </p>
                    <Button asChild className="min-h-11 w-full">
                        <Link href={show(source.latest_import.id)}>
                            {t('review_changes')}
                            <ArrowRight aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            )}
        </>
    );
    const stats = (
        <dl className="grid grid-cols-3 divide-x rounded-xl border">
            {(
                [
                    [
                        proposalSource ? t('sources_table.source_points') : t('on_map'),
                        proposalSource ? (
                            (source.last_proposal_source_count?.toLocaleString(i18n.language) ?? '—')
                        ) : source.last_published_retrieved_at ? (
                            <span className="text-2xl font-semibold tabular-nums">
                                {source.visible_locations_count.toLocaleString(i18n.language)}
                            </span>
                        ) : (
                            t('sources_table.not_published')
                        ),
                    ],
                    [t('last_retrieved'), lastRetrieved ? <MunicipalDateTime value={lastRetrieved} /> : t('sources_table.none')],
                    [t('approval.fields.interval'), t('approval.hours', { count: description.expected_interval_hours })],
                ] as const
            ).map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col-reverse justify-end gap-1 p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium break-words">{value}</dd>
                </div>
            ))}
        </dl>
    );
    const about = (
        <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('sheet.about')}</h3>
            <dl className="divide-y rounded-xl border text-sm">
                {source.target_type === 'offstreet' && row(t('approval.fields.occupancy'), t('approval.occupancy_interval'))}
                {row(t('approval.fields.publisher'), description.publisher)}
                {row(
                    t('approval.fields.licence'),
                    description.licence ?? t('approval.no_licence'),
                    description.licence ? undefined : 'text-destructive',
                )}
                {!proposalSource &&
                    row(
                        t('sources_table.municipality'),
                        <>
                            {source.municipality_name} <span className="text-muted-foreground">({source.municipality_code})</span>
                        </>,
                    )}
                {row(t('sources_table.area'), [source.subdivision_name ?? source.subdivision, source.country].filter(Boolean).join(', '))}
                {!proposalSource &&
                    row(
                        t('published_source_date'),
                        source.last_published_retrieved_at ? (
                            <MunicipalDateTime value={source.last_published_retrieved_at} />
                        ) : (
                            t('sources_table.none')
                        ),
                    )}
                {row(t('approval.fields.attribution'), description.attribution, 'text-muted-foreground')}
            </dl>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">
                {external(description.source_url, t('approval.fields.source_url'))}
                {external(description.terms_url, t('approval.fields.terms_url'))}
            </div>
        </section>
    );
    const historyLink = (
        <Button variant="outline" asChild className="min-h-11">
            <Link href={index({ query: { tab: 'deliveries', dataset: source.id } })}>
                <History aria-hidden="true" />
                {t('history')}
            </Link>
        </Button>
    );

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <div className="space-y-3 border-b px-6 pt-6 pr-14 pb-5">
                    <SourceType type={source.target_type} />
                    <SheetTitle className="text-xl leading-tight font-semibold tracking-tight">{source.name}</SheetTitle>
                    <SheetDescription asChild>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                            <span className="rounded-full border bg-background px-2.5 py-1">
                                <SourceStatus source={source} />
                            </span>
                            <span>
                                {source.municipality_name ?? source.subdivision_name ?? source.subdivision}
                                {source.country && ` · ${source.country}`}
                            </span>
                        </div>
                    </SheetDescription>
                </div>
                {awaitingApproval ? (
                    <SourceApproval source={source} history={source.approval_state === 'rejected' && historyLink}>
                        {alerts}
                        {hasDeliveries && stats}
                    </SourceApproval>
                ) : (
                    <>
                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                            {alerts}
                            {stats}
                            {about}
                        </div>
                        <div className="grid shrink-0 auto-cols-fr grid-flow-col gap-2 border-t px-6 py-4">
                            {source.target_type === 'municipal' && source.municipality_id !== null && (
                                <Button variant="outline" asChild className="min-h-11">
                                    <Link href={parkingMunicipal.municipality(source.municipality_id)}>
                                        <MapPin aria-hidden="true" />
                                        {t('locations')}
                                    </Link>
                                </Button>
                            )}
                            {historyLink}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
