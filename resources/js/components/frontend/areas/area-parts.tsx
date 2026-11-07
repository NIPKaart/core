import { pinSvg } from '@/lib/pin-svg';
import { cn } from '@/lib/utils';
import { formatLocale } from '@/locale-sync';
import { contact } from '@/routes';
import type { AreaPage, AreaPreview, AreaTotals, RuleLink } from '@/types/area';
import { Link } from '@inertiajs/react';
import { divIcon } from 'leaflet';
import { ArrowRight, ExternalLink, Info, Map } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

/** Text link in the brand colour, as everywhere on the public site. */
export const textLink = 'font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300';
/** A row-height link: at least 44px tall so it is an easy touch target. */
export const actionLink = cn('flex min-h-11 items-center self-start', textLink);
export const primaryButton =
    'inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-stone-900 px-5.5 font-semibold text-white hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200';
export const card = 'rounded-xl border border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';
export const muted = 'text-stone-600 dark:text-stone-400';

/** The contact form, opened with the municipality/data-provider topic. */
export const municipalityContactUrl = contact({ query: { topic: 'data' } }).url;

export function useAreaFormat() {
    const { i18n } = useTranslation();
    const locale = formatLocale(i18n.language);

    return {
        number: (value: number) => value.toLocaleString(locale),
        date: (value: string) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        relative: (value: string) => {
            const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
            const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
            if (Math.abs(days) >= 30) return format.format(Math.round(days / 30), 'month');
            if (days !== 0) return format.format(days, 'day');
            const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
            return Math.abs(minutes) >= 60 ? format.format(Math.round(minutes / 60), 'hour') : format.format(minutes, 'minute');
        },
    };
}

export function AreaBreadcrumbs({ items }: { items: AreaPage['breadcrumbs'] }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <nav aria-label={t('breadcrumbs')} className="text-sm">
            <ol className={cn('flex flex-wrap items-center gap-1.5 lg:gap-2', muted)}>
                {items.map((item, index) => (
                    <li key={item.name} className="flex items-center gap-1.5 lg:gap-2">
                        {index > 0 && (
                            <span aria-hidden className="text-stone-400 dark:text-stone-500">
                                /
                            </span>
                        )}
                        {item.href ? (
                            <Link href={item.href} className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-white">
                                {item.name}
                            </Link>
                        ) : (
                            <span aria-current="page" className="font-semibold text-stone-900 dark:text-white">
                                {item.name}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/** Hero band shared by every area level. */
export function AreaHero({ breadcrumbs, children }: { breadcrumbs: AreaPage['breadcrumbs']; children: ReactNode }) {
    return (
        <div className="border-b border-stone-200/70 bg-canvas-strong dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pt-5 pb-8 sm:px-6 lg:gap-8 lg:px-8 lg:pt-8 lg:pb-16">
                <AreaBreadcrumbs items={breadcrumbs} />
                {children}
            </div>
        </div>
    );
}

export function AreaKicker({ children }: { children: ReactNode }) {
    return <span className={cn('text-sm font-medium lg:text-[15px]', muted)}>{children}</span>;
}

export function AreaTitle({ name }: { name: string }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <h1 className="text-4xl leading-[1.06] font-bold tracking-[-0.035em] text-balance lg:text-[56px] lg:leading-[1.04]">
            {t('title', { name })}
        </h1>
    );
}

const VERIFIED = '#1d4ed8';

/**
 * The share of street parking spaces verified by an official source or confirmed by a visitor.
 */
export function VerificationStatus({
    totals,
    className,
    showLast = true,
    split = false,
}: {
    totals: AreaTotals;
    className?: string;
    showLast?: boolean;
    /** Summary and breakdown side by side on wide screens, as on the country page. */
    split?: boolean;
}) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const percentage = Math.round((totals.verified / totals.spaces) * 100);
    const rows = [
        { key: 'verified', count: totals.verified, swatch: 'bg-blue-700' },
        { key: 'unverified', count: totals.spaces - totals.verified, swatch: 'bg-stone-200 shadow-[inset_0_0_0_1px_#a6a09b] dark:bg-neutral-700' },
    ] as const;

    return (
        <div className={cn('flex flex-col gap-3 lg:gap-3.5', split && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16', className)}>
            <div className="flex flex-col gap-3 lg:gap-3.5">
                <span className="flex items-baseline gap-2 lg:gap-2.5">
                    <span className="text-[28px] leading-none font-bold tracking-[-0.03em] tabular-nums lg:text-[32px]">{percentage}%</span>
                    <span className="font-semibold">{t('status.summary', { count: totals.spaces, total: format.number(totals.spaces) })}</span>
                </span>
                <div
                    role="img"
                    aria-label={t('status.label', { verified: format.number(totals.verified), total: format.number(totals.spaces) })}
                    className="flex h-3 overflow-hidden rounded-full bg-stone-200 dark:bg-neutral-700"
                >
                    <span
                        className="block h-full"
                        style={{ width: `${((totals.verified / totals.spaces) * 100).toFixed(1)}%`, background: VERIFIED }}
                    />
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <h3 className={cn('text-sm font-semibold', muted)}>{t('status.breakdown')}</h3>
                <ul className="flex flex-col">
                    {rows.map((row) => (
                        <li
                            key={row.key}
                            className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-stone-100 py-1.75 text-[15px] text-stone-700 dark:border-neutral-800 dark:text-stone-300"
                        >
                            <span aria-hidden className={cn('block size-3 rounded-[3px]', row.swatch)} />
                            <span>{t(`status.${row.key}`)}</span>
                            <span className="font-semibold text-stone-900 tabular-nums dark:text-white">{format.number(row.count)}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <p className={muted}>{t('status.explanation')}</p>
            {showLast && totals.last_confirmed_at && (
                <span className={cn('text-sm', muted)}>{t('status.last', { time: format.relative(totals.last_confirmed_at) })}</span>
            )}
        </div>
    );
}

function clusterIcon(count: number) {
    const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';

    return divIcon({ html: `<div><span>${count}</span></div>`, className: `marker-cluster marker-cluster-${size}`, iconSize: [40, 40] });
}

/**
 * A still of the map around the area's public parking, grouped like the map's own clusters. The whole preview is one
 * link that hands off to the full map; it never becomes a second interactive map.
 */
export function AreaMapPreview({ preview, href, name, className }: { preview: AreaPreview; href: string; name: string; className?: string }) {
    const { t } = useTranslation('frontend/areas');
    const { bounds } = preview;

    return (
        <a
            href={href}
            aria-label={t('map.open_label', { name })}
            className={cn(
                'relative block overflow-hidden rounded-xl border border-stone-200 bg-[#ece7dc] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:border-neutral-800',
                className,
            )}
        >
            <div className="pointer-events-none absolute inset-0" aria-hidden>
                <MapContainer
                    bounds={[
                        [bounds.south, bounds.west],
                        [bounds.north, bounds.east],
                    ]}
                    boundsOptions={{ padding: [36, 36], maxZoom: 15 }}
                    className="z-0 h-full w-full"
                    zoomControl={false}
                    attributionControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                    boxZoom={false}
                    keyboard={false}
                >
                    <TileLayer
                        url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`}
                        maxZoom={22}
                    />
                    {preview.clusters.map((cluster) => (
                        <Marker
                            key={`${cluster.latitude}:${cluster.longitude}`}
                            position={[cluster.latitude, cluster.longitude]}
                            icon={clusterIcon(cluster.count)}
                            interactive={false}
                            keyboard={false}
                        />
                    ))}
                </MapContainer>
            </div>
            <span className="absolute bottom-5 left-5 z-10 hidden items-center gap-2 rounded-[10px] bg-white px-4 py-3 text-[15px] font-semibold text-stone-900 shadow-[0_8px_24px_rgb(28_25_23/16%)] lg:inline-flex">
                {t('map.open')}
                <ArrowRight className="size-4" aria-hidden />
            </span>
            <span className="absolute right-1.5 bottom-1 z-10 bg-white/85 px-1.25 py-px text-[10px] text-stone-700 lg:right-2 lg:bottom-1.5 lg:px-1.5 lg:py-0.5 lg:text-[11px]">
                {t('map.attribution')}
            </span>
        </a>
    );
}

export function MapButton({ href, name, className }: { href: string; name: string; className?: string }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <a href={href} className={cn(primaryButton, className)}>
            <Map className="size-4.5" aria-hidden />
            {t('map.show', { name })}
        </a>
    );
}

/** The map's own pin artwork, so the counts read like the markers visitors see on the map. */
export function AreaPin({ garage, className }: { garage: boolean; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn('block h-12 w-9 shrink-0 [&_svg]:h-12 [&_svg]:w-9', className)}
            dangerouslySetInnerHTML={{ __html: pinSvg(garage, null) }}
        />
    );
}

export function RuleRow({ rule, title, scope, compact = false }: { rule: RuleLink; title: string; scope: string; compact?: boolean }) {
    return (
        <li
            className={cn(
                'flex flex-col gap-0.5 border-b border-stone-100 last:border-b-0 dark:border-neutral-800',
                compact ? 'px-4.5 py-4' : 'px-6 py-4.5',
            )}
        >
            <a
                href={rule.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1.5 self-start', compact ? 'text-base' : 'text-[17px]', textLink)}
            >
                {title}
                <ExternalLink className="size-3.75" aria-hidden />
            </a>
            <span className={cn('text-sm', muted)}>{scope}</span>
        </li>
    );
}

export function RulesDisclaimer() {
    const { t } = useTranslation('frontend/areas');

    return (
        <p className={cn('flex items-start gap-2 text-sm', muted)}>
            <Info className="mt-0.5 size-4 shrink-0 max-lg:hidden" aria-hidden />
            {t('rules.disclaimer')}
        </p>
    );
}

export function PillLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-stone-200 bg-white px-4.5 text-[15px] font-medium text-stone-900 hover:border-stone-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
        >
            {children}
        </Link>
    );
}

/** A bar with the verified share, as used in the area tables. */
export function VerifiedBar({ verified, spaces }: { verified: number; spaces: number }) {
    const percentage = spaces > 0 ? Math.round((verified / spaces) * 100) : 0;

    return (
        <span className="flex items-center gap-2.5">
            <span aria-hidden className="flex h-1.5 w-22 overflow-hidden rounded-full bg-stone-200 dark:bg-neutral-700">
                <span className="block h-full bg-blue-700" style={{ width: `${percentage}%` }} />
            </span>
            <span className="text-sm font-semibold tabular-nums">{spaces > 0 ? `${percentage}%` : '–'}</span>
        </span>
    );
}

export function SectionTitle({ id, children, size = 'large' }: { id: string; children: ReactNode; size?: 'large' | 'medium' | 'small' }) {
    return (
        <h2
            id={id}
            className={cn(
                'font-bold tracking-[-0.02em]',
                size === 'large' && 'text-[28px] leading-tight tracking-[-0.025em] lg:text-[40px] lg:leading-[1.25]',
                size === 'medium' && 'text-2xl lg:text-[28px] lg:leading-[1.3]',
                size === 'small' && 'text-lg font-bold tracking-normal lg:text-xl',
            )}
        >
            {children}
        </h2>
    );
}
