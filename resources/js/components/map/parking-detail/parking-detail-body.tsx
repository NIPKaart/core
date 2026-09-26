import { Progress } from '@/components/ui/progress';
import { AlarmClock, Eye, Info, MapPin, Navigation } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { navigationUrl, streetViewUrl } from './navigation-handoff';
import { Chip, ConfirmedBadge, CopyButton, HelpPopover } from './parts';
import type { MunicipalParkingDetail, OffstreetParkingDetail, ParkingSpaceDetail } from './types';
import { getOrientationIllustration, occupancyPercent, occupancyStatus } from './utils';

export type ParkingDetailData =
    | { source: 'community'; detail: ParkingSpaceDetail }
    | { source: 'municipal'; detail: MunicipalParkingDetail }
    | { source: 'offstreet'; detail: OffstreetParkingDetail };

type Props = {
    data: ParkingDetailData;
    isLoggedIn: boolean;
    /** Community confirmation/report controls; only rendered for community contributions. */
    communityActions?: ReactNode;
};

/** `note` stays visible (warnings/semantics); `help` is optional background behind a help button. */
type Row = { label: string; value: ReactNode; note?: ReactNode; help?: ReactNode };

const progressTone: Record<'green' | 'orange' | 'red', string> = {
    green: '[&>div]:bg-green-500',
    orange: '[&>div]:bg-orange-400',
    red: '[&>div]:bg-red-500',
};

/** A labelled group in the hairline info list. The heading stays a real `<h3>` for screen readers, just visually small. */
function Group({ id, title, rows }: { id: string; title: string; rows: Row[] }) {
    const { t } = useTranslation('frontend/map/modals');

    return (
        <section aria-labelledby={id}>
            <h3 id={id} className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {title}
            </h3>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 px-3 py-2">
                        <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                        <dd className="min-w-0 text-right">
                            <span className="inline-flex flex-wrap items-center justify-end gap-1.5 font-medium">
                                {row.value}
                                {row.help && <HelpPopover content={row.help} label={t('detail.more_info', { label: row.label })} />}
                            </span>
                            {row.note && <p className="mt-0.5 text-xs text-muted-foreground">{row.note}</p>}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
    const { t } = useTranslation('frontend/map/modals');

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-orange-700 underline decoration-orange-300 underline-offset-2 hover:decoration-orange-500 dark:text-orange-300 ${className}`}
        >
            {children}
            <span className="sr-only"> ({t('detail.new_tab')})</span>
        </a>
    );
}

export default function ParkingDetailBody({ data, isLoggedIn, communityActions }: Props) {
    const { t, i18n } = useTranslation('frontend/map/modals');
    const { source, detail } = data;

    const unknown = <span className="font-normal text-muted-foreground italic">{t('detail.unknown')}</span>;
    const date = (value: string | null | undefined, withTime = false) =>
        value ? (
            <time dateTime={value}>
                {withTime
                    ? new Date(value).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
                    : new Date(value).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
            </time>
        ) : (
            unknown
        );

    const address = [detail.municipality, detail.province, detail.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');
    const navigateUrl = navigationUrl(detail.latitude, detail.longitude);
    const streetView = streetViewUrl(detail.latitude, detail.longitude);
    const liveOk = source === 'offstreet' && detail.api_state === 'ok';

    const rules: Row[] =
        source === 'offstreet'
            ? detail.url
                ? [{ label: t('detail.rules.facility_info'), value: <ExternalLink href={detail.url}>{t('common.table.website')}</ExternalLink> }]
                : []
            : [
                  ...(source === 'community' && detail.parking_time
                      ? [
                            {
                                label: t('community.table.max_time'),
                                value: (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:border-orange-900 dark:bg-orange-950/70 dark:text-orange-100">
                                        <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                                        {formatMinutes(detail.parking_time, t)}
                                    </span>
                                ),
                                note: t('community.table.parking_disc'),
                            },
                        ]
                      : []),
                  ...(detail.rule_url
                      ? [
                            {
                                label: t('common.table.regulations'),
                                value: <ExternalLink href={detail.rule_url}>{t('detail.rules.local_rules')}</ExternalLink>,
                            },
                        ]
                      : []),
              ];

    const layout: Row[] =
        source === 'offstreet'
            ? []
            : [
                  {
                      label: t('common.table.orientation'),
                      value: detail.orientation ? detail.orientation.label : unknown,
                      help: detail.orientation?.description || undefined,
                  },
                  ...(source === 'community' && isLoggedIn ? [{ label: t('community.table.area'), value: detail.amenity || unknown }] : []),
              ];

    const municipalSourceName =
        source === 'municipal'
            ? detail.municipality?.trim()
                ? t('detail.source.municipality', { name: detail.municipality.trim() })
                : (detail.provenance.name ?? t('detail.source.municipal'))
            : null;

    const provenance: Row[] =
        source === 'community'
            ? [
                  { label: t('municipal.table.source'), value: t('detail.source_types.community'), help: t('detail.source.community') },
                  { label: t('community.table.added_on'), value: date(detail.created_at) },
                  {
                      label: t('community.table.last_confirmed'),
                      value: detail.last_confirmed_at ? date(detail.last_confirmed_at) : t('detail.source.never_confirmed'),
                      note: t('detail.source.confirmations', { count: detail.confirmations_count?.confirmed ?? 0 }),
                  },
              ]
            : source === 'municipal'
              ? [
                    {
                        label: t('municipal.table.source'),
                        value: detail.provenance.url ? (
                            <ExternalLink href={detail.provenance.url}>{municipalSourceName}</ExternalLink>
                        ) : (
                            municipalSourceName
                        ),
                        help:
                            detail.provenance.name || detail.provenance.attribution || detail.provenance.terms_url ? (
                                <span className="flex flex-col gap-1">
                                    {detail.provenance.name && <span className="font-medium text-foreground">{detail.provenance.name}</span>}
                                    {detail.provenance.attribution && <span>{detail.provenance.attribution}</span>}
                                    {detail.provenance.terms_url && (
                                        <ExternalLink href={detail.provenance.terms_url}>{t('municipal.table.terms')}</ExternalLink>
                                    )}
                                </span>
                            ) : undefined,
                    },
                    {
                        label: t('municipal.table.fetched_at'),
                        value: date(detail.provenance.fetched_at),
                        help: detail.provenance.fetched_at ? t('municipal.fetched_note') : undefined,
                    },
                    ...(detail.provenance.source_updated_at
                        ? [{ label: t('detail.source.source_date'), value: date(detail.provenance.source_updated_at) }]
                        : []),
                ]
              : [
                    {
                        label: t('detail.live.label'),
                        value: liveOk ? t('detail.live.ok') : detail.api_state === 'error' ? t('detail.availability.live_unavailable') : unknown,
                    },
                ];

    if (isLoggedIn) {
        provenance.push({
            label: t('common.table.location_id'),
            value: (
                <span className="inline-flex items-center gap-1">
                    <span className="font-mono text-xs font-normal" title={detail.id}>
                        {detail.id.length > 12 ? (
                            <>
                                <span aria-hidden>…</span>
                                <span className="sr-only">{t('detail.id_ending')} </span>
                                {detail.id.slice(-8)}
                            </>
                        ) : (
                            detail.id
                        )}
                    </span>
                    <CopyButton value={detail.id} label={t('detail.copy_id')} copiedLabel={t('common.table.copied')} />
                </span>
            ),
        });
    }

    /** Fixed order for every source; groups without rows for this source are left out. */
    const groups = [
        { id: 'rules', rows: rules },
        { id: 'layout', rows: layout },
        { id: 'source', rows: provenance },
    ].filter((group) => group.rows.length > 0);

    const occupancyRow = (label: string, free: number | null, total: number | null) => {
        const percent = occupancyPercent(free, total);
        const status = occupancyStatus(free, total);
        const text = free !== null && total ? t('detail.availability.free_of', { free, total }) : unknown;

        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{text}</span>
                </div>
                {percent !== null && (
                    <Progress
                        value={percent}
                        aria-label={label}
                        aria-valuetext={typeof text === 'string' ? text : undefined}
                        className={`h-2 w-full rounded-full ${status ? progressTone[status] : ''}`}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            {source !== 'offstreet' && (
                <img
                    src={getOrientationIllustration(detail.orientation)}
                    alt=""
                    className="mx-auto max-h-24 w-auto object-contain"
                    style={{ aspectRatio: '3 / 1', maxWidth: 260 }}
                />
            )}

            {source === 'offstreet' && (
                <section
                    aria-labelledby="parking-detail-availability"
                    className="flex flex-col gap-2 rounded-lg border bg-zinc-50 px-4 py-3 dark:bg-zinc-900"
                >
                    <h3 id="parking-detail-availability" className="sr-only">
                        {t('detail.sections.availability')}
                    </h3>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {liveOk ? (
                            <Chip tone="green">{t('offstreet.table.live')}</Chip>
                        ) : (
                            <Chip tone={detail.api_state === 'error' ? 'red' : 'zinc'}>{t('detail.availability.live_unavailable')}</Chip>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {t('detail.live.updated')} {date(detail.updated_at, true)}
                        </span>
                    </div>
                    {liveOk && (
                        <>
                            {occupancyRow(t('detail.availability.general_short'), detail.free_space_short, detail.short_capacity)}
                            {detail.long_capacity
                                ? occupancyRow(t('detail.availability.general_long'), detail.free_space_long, detail.long_capacity)
                                : null}
                        </>
                    )}
                </section>
            )}

            <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm">
                    <MapPin className="mr-1 inline h-4 w-4 -translate-y-px text-orange-400" aria-hidden />
                    {address || t('detail.no_address')}
                </p>
                {source === 'community' && (
                    <ConfirmedBadge
                        count={detail.confirmations_count?.confirmed ?? 0}
                        label={t('detail.badges.confirmed', { count: detail.confirmations_count?.confirmed ?? 0 })}
                    />
                )}
            </div>

            {navigateUrl ? (
                <div className="flex flex-wrap justify-center gap-3">
                    <a
                        href={navigateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <Navigation className="h-4 w-4" aria-hidden />
                        {t('common.buttons.navigate')}
                        <span className="sr-only"> ({t('detail.new_tab')})</span>
                    </a>
                    {streetView && (
                        <a
                            href={streetView}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-5 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <Eye className="h-4 w-4" aria-hidden />
                            {t('common.buttons.streetview')}
                            <span className="sr-only"> ({t('detail.new_tab')})</span>
                        </a>
                    )}
                </div>
            ) : (
                <p className="text-center text-xs text-muted-foreground">{t('detail.navigation.unavailable')}</p>
            )}

            {groups.length > 0 && (
                <div className="divide-y divide-zinc-100 rounded-lg border text-sm dark:divide-zinc-800">
                    {groups.map((group) => (
                        <Group key={group.id} id={`parking-detail-${group.id}`} title={t(`detail.sections.${group.id}`)} rows={group.rows} />
                    ))}
                </div>
            )}

            <p className="-mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground sm:whitespace-nowrap">
                <Info className="h-3 w-3 shrink-0" aria-hidden />
                {t('detail.check_on_site')}
            </p>

            {source === 'community' && communityActions}
        </div>
    );
}

function formatMinutes(minutes: number, t: (key: string, options?: Record<string, unknown>) => string): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const parts = [
        hours ? t(hours === 1 ? 'community.table.time_format.hours' : 'community.table.time_format.hours_plural', { count: hours }) : null,
        rest ? t(rest === 1 ? 'community.table.time_format.minutes' : 'community.table.time_format.minutes_plural', { count: rest }) : null,
    ];

    return parts.filter(Boolean).join(' & ');
}
