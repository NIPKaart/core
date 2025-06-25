import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { TFunction } from 'i18next';
import { AlarmClock, Compass, Copy, FileText, Globe2, Hash, Landmark, Link, MapPin, ParkingSquare, Tag, Users } from 'lucide-react';
import type { InfoTableRow } from './modal-parts';
import type { MunicipalParkingDetail, OffstreetParkingDetail, ParkingSpaceDetail } from './types';
import { formatParkingTime } from './utils';

// Community spot info rows
export function getCommunityInfoRows(
    data: ParkingSpaceDetail,
    isLoggedIn: boolean,
    copiedSpaceId: boolean,
    setCopiedSpaceId: (v: boolean) => void,
    copyLocationId: (e: React.MouseEvent) => void,
    t: TFunction,
): InfoTableRow[] {
    return [
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.street'),
            value: data.street || '-',
        },
        {
            icon: <AlarmClock className="h-4 w-4 text-orange-400 dark:text-orange-300" />,
            label: t('community.table.max_time'),
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
                                {t('community.table.parking_disc')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <span className="text-zinc-400 italic">{t('community.table.unlimited')}</span>
                ),
        },
        {
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.orientation'),
            value: data.orientation || '-',
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.municipality'),
            value: data.municipality || '-',
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.regulations'),
            value: data.rule_url ? (
                <a href={data.rule_url} target="_blank" rel="noopener" className="text-orange-600 underline">
                    {t('common.table.website')}
                </a>
            ) : (
                <span className="text-zinc-400 italic">No information</span>
            ),
        },
        {
            icon: <Users className="h-4 w-4 text-green-600 dark:text-green-300" />,
            label: t('community.table.last_confirmed'),
            value: data.last_confirmed_at ? (
                <>
                    <span>{formatDistanceToNow(new Date(data.last_confirmed_at), { addSuffix: true })}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({new Date(data.last_confirmed_at).toLocaleDateString()})</span>
                </>
            ) : (
                <span className="text-zinc-400 italic">{t('community.table.never')}</span>
            ),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Compass className="h-4 w-4 text-muted-foreground" />,
                      label: t('community.table.area'),
                      value: data.amenity || '-',
                  },
                  {
                      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
                      label: t('common.table.location_id'),
                      value: (
                          <span className="flex items-center gap-1">
                              <span className="select-all">{data.id}</span>
                              <TooltipProvider>
                                  <Tooltip open={copiedSpaceId} onOpenChange={() => setCopiedSpaceId(false)} delayDuration={0}>
                                      <TooltipTrigger asChild>
                                          <button
                                              type="button"
                                              tabIndex={0}
                                              aria-label="Copy location ID"
                                              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                                              onClick={copyLocationId}
                                          >
                                              <Copy className="h-4 w-4" />
                                          </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center">
                                          {t('common.table.copied')}
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          </span>
                      ),
                  },
                  {
                      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
                      label: 'Added on',
                      value: new Date(data.created_at).toLocaleDateString(),
                  },
              ]
            : []),
    ];
}

// Municipal spot info rows
export function getMunicipalInfoRows(
    data: MunicipalParkingDetail,
    isLoggedIn: boolean,
    copiedSpaceId: boolean,
    setCopiedSpaceId: (v: boolean) => void,
    copyLocationId: (e: React.MouseEvent) => void,
    t: TFunction,
): InfoTableRow[] {
    return [
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.street'),
            value: data.street || '-',
        },
        {
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.orientation'),
            value: data.orientation || '-',
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.municipality'),
            value: data.municipality || '-',
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.regulations'),
            value: data.rule_url ? (
                <a href={data.rule_url} target="_blank" rel="noopener" className="text-orange-600 underline">
                    {t('common.table.website')}
                </a>
            ) : (
                <span className="text-zinc-400 italic">{t('common.table.no_information')}</span>
            ),
        },
        {
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
            label: t('municipal.table.updated_at'),
            value: new Date(data.updated_at).toLocaleDateString(),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
                      label: t('common.table.location_id'),
                      value: (
                          <span className="flex items-center gap-1">
                              <span className="select-all">{data.id}</span>
                              <TooltipProvider>
                                  <Tooltip open={copiedSpaceId} onOpenChange={() => setCopiedSpaceId(false)} delayDuration={0}>
                                      <TooltipTrigger asChild>
                                          <button
                                              type="button"
                                              tabIndex={0}
                                              aria-label="Copy location ID"
                                              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                                              onClick={copyLocationId}
                                          >
                                              <Copy className="h-4 w-4" />
                                          </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center">
                                          {t('common.table.copied')}
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          </span>
                      ),
                  },
              ]
            : []),
    ];
}

// Offstreet parking info rows
export function getOffstreetInfoRows(
    data: OffstreetParkingDetail,
    isLoggedIn: boolean,
    copiedSpaceId: boolean,
    setCopiedSpaceId: (v: boolean) => void,
    copyLocationId: (e: React.MouseEvent) => void,
    t: TFunction,
): InfoTableRow[] {
    return [
        {
            icon: <ParkingSquare className="h-4 w-4 text-primary" />,
            label: t('offstreet.table.type'),
            value:
                data.type === 'parkandride' ? (
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {t('offstreet.table.parkandride')}
                    </span>
                ) : (
                    <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                        {t('offstreet.table.garage')}
                    </span>
                ),
        },
        ...(typeof data.api_state === 'string'
            ? [
                  {
                      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
                      label: t('offstreet.table.api_status'),
                      value: (
                          <span
                              className={
                                  'inline-block rounded px-2 py-0.5 text-xs font-semibold ' +
                                  (data.api_state === 'ok'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200')
                              }
                          >
                              {data.api_state === 'ok' ? 'Live' : data.api_state}
                          </span>
                      ),
                  },
              ]
            : []),
        {
            icon: <Globe2 className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.country'),
            value: data.country || '-',
        },
        {
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.province'),
            value: data.province || '-',
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: t('common.table.municipality'),
            value: data.municipality || '-',
        },
        {
            icon: <AlarmClock className="h-4 w-4 text-orange-400 dark:text-orange-300" />,
            label: t('offstreet.table.short_term'),
            value: (
                <span>
                    <strong>{data.free_space_short}</strong> / {data.short_capacity}
                </span>
            ),
        },
        ...(data.long_capacity
            ? [
                  {
                      icon: <AlarmClock className="h-4 w-4 text-orange-400 dark:text-orange-300" />,
                      label: t('offstreet.table.long_term'),
                      value: (
                          <span>
                              <strong>{data.free_space_long ?? '-'}</strong> / {data.long_capacity}
                          </span>
                      ),
                  },
              ]
            : []),
        {
            icon: <Link className="h-4 w-4 text-muted-foreground" />,
            label: t('offstreet.table.more_info'),
            value: data.url ? (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">
                    {t('common.table.website')}
                </a>
            ) : (
                <span className="text-zinc-400 italic">{t('offstreet.table.no_link')}</span>
            ),
        },
        {
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
            label: t('offstreet.table.latest_update'),
            value: new Date(data.updated_at).toLocaleString(undefined, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            }),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
                      label: t('common.table.location_id'),
                      value: (
                          <span className="flex items-center gap-1">
                              <span className="select-all">{data.id}</span>
                              <TooltipProvider>
                                  <Tooltip open={copiedSpaceId} onOpenChange={() => setCopiedSpaceId(false)} delayDuration={0}>
                                      <TooltipTrigger asChild>
                                          <button
                                              type="button"
                                              tabIndex={0}
                                              aria-label="Copy location ID"
                                              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                                              onClick={copyLocationId}
                                          >
                                              <Copy className="h-4 w-4" />
                                          </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center">
                                          {t('common.table.copied')}
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          </span>
                      ),
                  },
              ]
            : []),
    ];
}
