import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ParkingConfirmForm } from '@/pages/frontend/form/form-confirm-location';
import { AlarmClock, Compass, Copy, Eye, FileText, Hash, Landmark, MapPin, Navigation, Tag, Users } from 'lucide-react';
import * as React from 'react';
import { LocationDetail } from './types';
import { formatParkingTime, getOrientationIllustration } from './utils';
import { formatDistanceToNow } from 'date-fns';

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

export function MainInfo({ data }: { data: LocationDetail }) {
    return (
        <div className="mx-auto my-2 flex w-full max-w-lg flex-col items-center gap-2">
            <img
                src={getOrientationIllustration(data.orientation)}
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
            {data.confirmations_count?.confirmed ? <ConfirmedBadge count={data.confirmations_count.confirmed} /> : null}
            <div className="w-full truncate px-2 text-center text-xs text-zinc-500">
                {data.province}
                {data.country ? `, ${data.country}` : ''}
            </div>
        </div>
    );
}

export function ActionButtons({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
    const hasCoords = latitude !== null && longitude !== null;
    function getGoogleMapsUrl(lat: number | null, lng: number | null) {
        if (lat !== null && lng !== null) {
            return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        }
        return 'https://maps.google.com/';
    }
    function getStreetViewUrl(lat: number | null, lng: number | null) {
        if (lat !== null && lng !== null) {
            return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
        }
        return 'https://maps.google.com/';
    }
    return (
        <div className="my-3 flex flex-row justify-center gap-2">
            <a href={getGoogleMapsUrl(latitude, longitude)} target="_blank" rel="noopener" tabIndex={hasCoords ? 0 : -1} aria-disabled={!hasCoords}>
                <Button size="sm" className="cursor-pointer rounded-md bg-orange-500 text-white hover:bg-orange-600" disabled={!hasCoords}>
                    <Navigation className="mr-1 h-4 w-4" /> Navigate
                </Button>
            </a>
            <a href={getStreetViewUrl(latitude, longitude)} target="_blank" rel="noopener" tabIndex={hasCoords ? 0 : -1} aria-disabled={!hasCoords}>
                <Button variant="outline" size="sm" className="cursor-pointer rounded-md" disabled={!hasCoords}>
                    <Eye className="mr-1 h-4 w-4" /> Streetview
                </Button>
            </a>
        </div>
    );
}

export function InfoTable({
    data,
    isLoggedIn,
    copiedLocationId,
    setCopiedLocationId,
    copyLocationId,
}: {
    data: LocationDetail;
    isLoggedIn: boolean;
    copiedLocationId: boolean;
    setCopiedLocationId: (v: boolean) => void;
    copyLocationId: (e: React.MouseEvent) => void;
}) {
    const rows = [
        {
            icon: <Tag className="text-muted-foreground h-4 w-4" />,
            label: 'Street',
            value: data.street || '-',
        },
        {
            icon: <AlarmClock className="h-4 w-4 text-orange-400 dark:text-orange-300" />,
            label: 'Max. parking time',
            value:
                typeof data.parking_time === 'number' && data.parking_time > 0 ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800 shadow-sm transition-colors dark:border-orange-900 dark:bg-orange-950/70 dark:text-orange-100">
                                    <AlarmClock className="h-4 w-4" />
                                    {formatParkingTime(data.parking_time)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">
                                Don’t forget your parking disc!
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <span className="text-zinc-400 italic">Unlimited</span>
                ),
        },
        {
            icon: <Compass className="text-muted-foreground h-4 w-4" />,
            label: 'Orientation',
            value: data.orientation || '-',
        },
        {
            icon: <MapPin className="text-muted-foreground h-4 w-4" />,
            label: 'Municipality',
            value: data.municipality || '-',
        },
        {
            icon: <Landmark className="text-muted-foreground h-4 w-4" />,
            label: 'Municipal regulations',
            value: data.rule_url ? (
                <a href={data.rule_url} target="_blank" rel="noopener" className="text-orange-600 underline">
                    Website
                </a>
            ) : (
                <span className="text-zinc-400 italic">No information</span>
            ),
        },
        {
            icon: <Users className="h-4 w-4 text-green-600 dark:text-green-300" />,
            label: 'Last confirmed',
            value: data.last_confirmed_at ? (
                <>
                    <span>{formatDistanceToNow(new Date(data.last_confirmed_at), { addSuffix: true })}</span>
                    <span className="text-muted-foreground ml-2 text-xs">({new Date(data.last_confirmed_at).toLocaleDateString()})</span>
                </>
            ) : (
                <span className="text-zinc-400 italic">Never</span>
            ),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Compass className="text-muted-foreground h-4 w-4" />,
                      label: 'Area',
                      value: data.amenity || '-',
                  },
                  {
                      icon: <Hash className="text-muted-foreground h-4 w-4" />,
                      label: 'Location ID',
                      value: (
                          <span className="flex items-center gap-1">
                              <span className="select-all">{data.id}</span>
                              <TooltipProvider>
                                  <Tooltip open={copiedLocationId} onOpenChange={() => setCopiedLocationId(false)} delayDuration={0}>
                                      <TooltipTrigger asChild>
                                          <button
                                              type="button"
                                              tabIndex={0}
                                              aria-label="Copy location ID"
                                              className="hover:bg-muted/40 text-muted-foreground hover:text-foreground ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors"
                                              onClick={copyLocationId}
                                          >
                                              <Copy className="h-4 w-4" />
                                          </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center">
                                          Copied!
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          </span>
                      ),
                  },
                  {
                      icon: <FileText className="text-muted-foreground h-4 w-4" />,
                      label: 'Added on',
                      value: new Date(data.created_at).toLocaleDateString(),
                  },
              ]
            : []),
    ];

    return (
        <div className="mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <dl>
                {rows.map((row, i) => (
                    <div
                        key={i}
                        className={`grid grid-cols-[2rem_8rem_1fr] items-center gap-2 px-4 py-3 ${i % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-900'} ${i === 0 ? 'rounded-t-xl' : ''} ${i === rows.length - 1 ? 'rounded-b-xl' : ''}`}
                    >
                        {/* Icon */}
                        <div className="flex justify-center">{row.icon}</div>
                        {/* Label */}
                        <dt className="text-muted-foreground text-left text-xs">{row.label}</dt>
                        {/* Value */}
                        <dd className="text-foreground text-sm font-medium break-words">
                            {row.value || <span className="text-muted-foreground">—</span>}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

export function ConfirmTab({
    data,
    confirmationStatusOptions,
    onConfirmed,
}: {
    data: LocationDetail;
    confirmationStatusOptions: Record<string, string>;
    onConfirmed: () => void;
}) {
    return (
        <div className="py-3">
            <ParkingConfirmForm
                spaceId={data.id}
                onConfirmed={onConfirmed}
                confirmationStatusOptions={confirmationStatusOptions}
                confirmedToday={data.confirmed_today}
            />
        </div>
    );
}

export function DescriptionTab({ description }: { description: string }) {
    if (!description) return null;
    return (
        <div className="relative mb-2 rounded-xl border border-orange-100 bg-orange-50/70 px-6 py-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/60">
            <div className="absolute top-0 left-0 h-full w-1 rounded-tl-xl rounded-bl-xl bg-orange-400" />
            <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
                <div>
                    <div className="mb-1 text-base font-semibold text-orange-800 dark:text-orange-200">Description</div>
                    <div className="text-sm text-orange-900 dark:text-orange-100">{description}</div>
                </div>
            </div>
        </div>
    );
}
