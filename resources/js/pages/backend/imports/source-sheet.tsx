import { index, show } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import MunicipalDateTime from '@/components/municipal-date-time';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import parkingMunicipal from '@/routes/app/parking-municipal';
import { Link } from '@inertiajs/react';
import { ArrowUpRight, ExternalLink, History, MapPin } from 'lucide-react';
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

    return (
        <Sheet open={source !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
                {source && description && (
                    <>
                        <SheetHeader className="border-b pr-12">
                            <SourceType type={source.target_type} />
                            <SheetTitle className="text-base leading-snug">{source.name}</SheetTitle>
                            <SheetDescription asChild>
                                <div>
                                    <SourceStatus source={source} />
                                </div>
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-5 p-4">
                            {source.status === 'intake_problem' && (
                                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                    {t('intake_problem')}
                                </p>
                            )}
                            {source.approval_state !== 'approved' && <SourceApproval source={source} />}
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('sources_table.area')}</dt>
                                    <dd className="mt-0.5">
                                        {source.country} · {source.subdivision}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('sources_table.municipality')}</dt>
                                    <dd className="mt-0.5">
                                        {source.municipality_name} <span className="text-muted-foreground">({source.municipality_code})</span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('approval.fields.publisher')}</dt>
                                    <dd className="mt-0.5">{description.publisher}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('approval.fields.licence')}</dt>
                                    <dd className={`mt-0.5 ${description.licence ? '' : 'text-destructive'}`}>
                                        {description.licence ?? t('approval.no_licence')}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('on_map')}</dt>
                                    <dd className="mt-0.5 font-semibold tabular-nums">
                                        {source.last_published_retrieved_at
                                            ? source.visible_locations_count.toLocaleString(i18n.language)
                                            : t('sources_table.not_published')}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('approval.fields.interval')}</dt>
                                    <dd className="mt-0.5">{t('approval.hours', { count: description.expected_interval_hours })}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('last_retrieved')}</dt>
                                    <dd className="mt-0.5">
                                        {source.latest_import ? (
                                            <MunicipalDateTime value={source.latest_import.retrieved_at} />
                                        ) : (
                                            t('sources_table.none')
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t('published_source_date')}</dt>
                                    <dd className="mt-0.5">
                                        {source.last_published_retrieved_at ? (
                                            <MunicipalDateTime value={source.last_published_retrieved_at} />
                                        ) : (
                                            t('sources_table.none')
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            <p className="text-sm text-muted-foreground">{description.attribution}</p>
                            <div className="flex flex-wrap gap-4 text-sm">
                                {external(description.source_url, t('approval.fields.source_url'))}
                                {external(description.terms_url, t('approval.fields.terms_url'))}
                            </div>
                            <div className="flex flex-col gap-2 border-t pt-4">
                                {source.needs_review && source.latest_import && (
                                    <Button asChild className="min-h-11">
                                        <Link href={show(source.latest_import.id)}>
                                            {t('review_changes')}
                                            <ArrowUpRight aria-hidden="true" />
                                        </Link>
                                    </Button>
                                )}
                                {source.target_type === 'municipal' && source.municipality_id !== null && (
                                    <Button variant="outline" asChild className="min-h-11">
                                        <Link href={parkingMunicipal.municipality(source.municipality_id)}>
                                            <MapPin aria-hidden="true" />
                                            {t('locations')}
                                        </Link>
                                    </Button>
                                )}
                                <Button variant="outline" asChild className="min-h-11">
                                    <Link href={index({ query: { tab: 'deliveries', dataset: source.id } })}>
                                        <History aria-hidden="true" />
                                        {t('history')}
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
