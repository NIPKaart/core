import type { RouteDefinition } from '@/wayfinder';
import { Link } from '@inertiajs/react';
import { Check, ChevronRight, Flag, Landmark, MapPin, MapPinCheckInside, MapPinned } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MunicipalParkingDetail, ParkingSpaceDetail } from './types';
import { formatShortDate } from './utils';

type Props = {
    data: { source: 'community'; detail: ParkingSpaceDetail } | { source: 'municipal'; detail: MunicipalParkingDetail };
    signedIn: boolean;
    loginHref: RouteDefinition<'get'> | string;
    onReport: () => void;
};

/**
 * The Contributions tab: what people have said about this place, where its information comes from, and what the visitor did.
 * Improving information (#1310) and linked sources (#1312) join this tab when they exist.
 */
export default function Contributions({ data, signedIn, loginHref, onReport }: Props) {
    const { t, i18n } = useTranslation('frontend/map/modals');
    const { source, detail } = data;
    const confirmedCount = detail.confirmations_count?.confirmed ?? 0;
    const date = (value: string) => <time dateTime={value}>{formatShortDate(value, i18n.language)}</time>;
    const reported = signedIn && !!detail.reported_by_you;
    const confirmedToday = signedIn && !!detail.confirmed_today;

    const municipalName =
        source === 'municipal'
            ? detail.municipality?.trim()
                ? t('detail.source.municipality', { name: detail.municipality.trim() })
                : (detail.provenance.name ?? t('detail.source.municipal'))
            : null;

    return (
        <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col rounded-xl border">
                <div className="flex min-h-15 items-center gap-3 px-3 py-2.5">
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            confirmedCount > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/70 dark:text-green-300'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        {confirmedCount > 0 ? <MapPinCheckInside className="h-5 w-5" aria-hidden /> : <MapPin className="h-5 w-5" aria-hidden />}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                        <h3 className="text-sm font-semibold">{t('detail.contribute.exists')}</h3>
                        <p className="text-xs text-muted-foreground">
                            {confirmedCount > 0 ? (
                                <>
                                    {t('detail.existence.count', { count: confirmedCount })}
                                    {detail.last_confirmed_at && (
                                        <>
                                            {' · '}
                                            {t('detail.contribute.last')} {date(detail.last_confirmed_at)}
                                        </>
                                    )}
                                </>
                            ) : (
                                t('detail.existence.none')
                            )}
                        </p>
                    </div>
                </div>
                {signedIn && !reported && (
                    <button
                        type="button"
                        onClick={onReport}
                        className="flex min-h-15 cursor-pointer items-center gap-3 border-t px-3 py-2.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                            <Flag className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                            <span className="text-sm font-semibold">{t('detail.contribute.report')}</span>
                            <span className="text-xs text-muted-foreground">{t('detail.contribute.report_note')}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                )}
            </div>

            <section aria-labelledby="parking-sources" className="flex flex-col gap-2.5 rounded-xl border p-3">
                <h3 id="parking-sources" className="text-sm font-semibold">
                    {t('detail.contribute.sources')}
                </h3>
                <p className="flex items-center gap-2.5 text-sm">
                    {source === 'community' ? (
                        <MapPinned className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                    ) : (
                        <Landmark className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">{source === 'community' ? t('detail.source_types.community') : municipalName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {source === 'community'
                            ? detail.created_at && (
                                  <>
                                      {t('detail.contribute.added')} {date(detail.created_at)}
                                  </>
                              )
                            : detail.provenance.fetched_at && (
                                  <>
                                      {t('detail.contribute.fetched')} {date(detail.provenance.fetched_at)}
                                  </>
                              )}
                    </span>
                </p>
            </section>

            {(confirmedToday || reported) && (
                <section aria-labelledby="parking-activity" className="flex flex-col gap-2">
                    <h3 id="parking-activity" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {t('detail.contribute.activity')}
                    </h3>
                    {confirmedToday && (
                        <p className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden />
                            {t('detail.contribute.confirmed_today')}
                        </p>
                    )}
                    {reported && (
                        <p className="flex items-center gap-2 text-sm text-pretty">
                            <Flag className="h-4 w-4 shrink-0 text-orange-700 dark:text-orange-400" aria-hidden />
                            {t('detail.contribute.reported')}
                        </p>
                    )}
                </section>
            )}

            {!signedIn && (
                <p className="text-xs text-pretty text-muted-foreground">
                    <Link href={loginHref} className="font-medium text-foreground underline underline-offset-2">
                        {t('detail.existence.log_in')}
                    </Link>{' '}
                    {t('detail.existence.log_in_hint')}
                </p>
            )}
        </div>
    );
}
