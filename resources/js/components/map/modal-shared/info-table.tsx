import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { AlarmClock, Compass, Copy, FileText, Hash, Landmark, MapPin, Tag, Users } from 'lucide-react';
import type { InfoTableRow } from './modal-parts';
import type { MunicipalParkingDetail, ParkingSpaceDetail } from './types';
import { formatParkingTime } from './utils';

// Community spot info rows
export function getCommunityInfoRows(
    data: ParkingSpaceDetail,
    isLoggedIn: boolean,
    copiedLocationId: boolean,
    setCopiedLocationId: (v: boolean) => void,
    copyLocationId: (e: React.MouseEvent) => void,
): InfoTableRow[] {
    return [
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
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
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: 'Orientation',
            value: data.orientation || '-',
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: 'Municipality',
            value: data.municipality || '-',
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
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
                    <span className="ml-2 text-xs text-muted-foreground">({new Date(data.last_confirmed_at).toLocaleDateString()})</span>
                </>
            ) : (
                <span className="text-zinc-400 italic">Never</span>
            ),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Compass className="h-4 w-4 text-muted-foreground" />,
                      label: 'Area',
                      value: data.amenity || '-',
                  },
                  {
                      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
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
                                              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
    copiedLocationId: boolean,
    setCopiedLocationId: (v: boolean) => void,
    copyLocationId: (e: React.MouseEvent) => void,
): InfoTableRow[] {
    return [
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: 'Street',
            value: data.street || '-',
        },
        {
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: 'Orientation',
            value: data.orientation || '-',
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: 'Municipality',
            value: data.municipality || '-',
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
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
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
            label: 'Last updated',
            value: new Date(data.updated_at).toLocaleDateString(),
        },
        ...(isLoggedIn
            ? [
                  {
                      icon: <Hash className="h-4 w-4 text-muted-foreground" />,
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
                                              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
              ]
            : []),
    ];
}
