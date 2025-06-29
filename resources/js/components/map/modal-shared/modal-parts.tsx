import { Button } from '@/components/ui/button';
import { Eye, MapPin, Navigation, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EnumOption } from './types';
import { getOrientationIllustration } from './utils';

type MainInfoProps = {
    data: {
        orientation?: EnumOption | null;
        street?: string | null;
        municipality?: string | null;
        province?: string | null;
        country?: string | null;
        confirmations_count?: { confirmed: number };
    };
    type: 'community' | 'municipal' | 'offstreet';
};

// Copies the location ID to clipboard and sets a copied state for a short duration
export function copyLocationId(data: { id?: string } | null, setCopied: (v: boolean) => void, e: React.MouseEvent) {
    e.stopPropagation();
    if (data?.id) {
        navigator.clipboard.writeText(data.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    }
}

// Generates a shareable URL based on latitude, longitude, and zoom level
export function getShareUrl(lat: number, lng: number, zoom = 18) {
    if (lat != null && lng != null) {
        return `${window.location.origin}${window.location.pathname}#${zoom}/${lat.toFixed(5)}/${lng.toFixed(5)}`;
    }
    return window.location.href;
}

// Copies the shareable URL to clipboard and sets a copied state for a short duration
export function copyUrl(data: { id?: string }, latitude: number, longitude: number, setCopied: (v: boolean) => void) {
    if (!data) return;
    const shareUrl = getShareUrl(latitude, longitude, 18);
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
}

// LoadingSkeleton component displays a loading animation with a customizable color
export function LoadingSkeleton({ color = 'text-orange-400' }: { color?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
            <div className={`mb-2 h-6 w-6 animate-spin ${color}`} />
            <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-20 w-full max-w-xs animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
    );
}

// ErrorBlock component displays an error message when location details cannot be loaded
export function ErrorBlock({ message = 'Could not load location details.' }) {
    return <div className="flex flex-col items-center justify-center gap-4 py-10 text-red-600">{message}</div>;
}

export function MainInfo({ data, type }: MainInfoProps) {
    return (
        <div className="mx-auto my-2 flex w-full max-w-lg flex-col items-center gap-2">
            <img
                src={getOrientationIllustration(data.orientation ?? null)}
                alt="Orientation"
                className="max-h-28 w-auto object-contain"
                style={{ aspectRatio: '3/1', maxWidth: 300 }}
            />
            <div className="flex w-full items-center justify-center gap-2">
                <MapPin className="h-5 w-5 flex-shrink-0 text-orange-400" aria-label="Location" />
                <span className="block truncate text-lg font-bold">
                    {data.street}
                    {data.street ? ',' : ''} {data.municipality}
                </span>
            </div>
            {type === 'community' && data.confirmations_count?.confirmed ? <ConfirmedBadge count={data.confirmations_count.confirmed} /> : null}
            <div className="w-full truncate px-2 text-center text-xs text-zinc-500">
                {data.province}
                {data.country ? `, ${data.country}` : ''}
            </div>
        </div>
    );
}

export function ConfirmedBadge({ count, className = '' }: { count: number; className?: string }) {
    if (!count || count <= 0) return null;
    return (
        <div
            className={
                'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ' +
                'border-green-200 bg-green-50 text-green-800' +
                'dark:border-green-900 dark:bg-green-950/80 dark:text-green-300' +
                className
            }
            style={{
                minWidth: 70,
                justifyContent: 'center',
                letterSpacing: '.01em',
            }}
        >
            <Users className="mr-1 h-4 w-4 text-green-600 dark:text-green-300" />
            {count}x confirmed
        </div>
    );
}

type ActionButtonsProps = {
    latitude: number;
    longitude: number;
    showNavigate?: boolean;
    showStreetview?: boolean;
};

export function ActionButtons({ latitude, longitude, showNavigate = true, showStreetview = true }: ActionButtonsProps) {
    const { t } = useTranslation('map-parking');

    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
    function getGoogleMapsUrl(lat: number, lng: number) {
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    function getStreetViewUrl(lat: number, lng: number) {
        return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
    }

    return (
        <div className="my-3 flex flex-row justify-center gap-2">
            {showNavigate && (
                <a
                    href={getGoogleMapsUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener"
                    tabIndex={hasCoords ? 0 : -1}
                    aria-disabled={!hasCoords}
                >
                    <Button size="sm" className="cursor-pointer rounded-md bg-orange-500 text-white hover:bg-orange-600" disabled={!hasCoords}>
                        <Navigation className="mr-1 h-4 w-4" /> {t('common.buttons.navigate')}
                    </Button>
                </a>
            )}
            {showStreetview && (
                <a
                    href={getStreetViewUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener"
                    tabIndex={hasCoords ? 0 : -1}
                    aria-disabled={!hasCoords}
                >
                    <Button variant="outline" size="sm" className="cursor-pointer rounded-md" disabled={!hasCoords}>
                        <Eye className="mr-1 h-4 w-4" /> {t('common.buttons.streetview')}
                    </Button>
                </a>
            )}
        </div>
    );
}

export type InfoTableRow = { icon: React.ReactNode; label: string; value: React.ReactNode };
export function InfoTable({ rows }: { rows: InfoTableRow[] }) {
    return (
        <div className="mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <dl>
                {rows.map((row, i) => (
                    <div
                        key={i}
                        className={`grid grid-cols-[2rem_8rem_1fr] items-center gap-2 px-4 py-3 ${i % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-900'} ${i === 0 ? 'rounded-t-xl' : ''} ${i === rows.length - 1 ? 'rounded-b-xl' : ''}`}
                    >
                        <div className="flex justify-center">{row.icon}</div>
                        <dt className="text-left text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="text-sm font-medium break-words text-foreground">
                            {row.value || <span className="text-muted-foreground">—</span>}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
