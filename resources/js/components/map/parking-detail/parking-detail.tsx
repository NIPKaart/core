import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEcho } from '@/echo';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { placeLinkPath } from '@/lib/place-link';
import { login } from '@/routes';
import app from '@/routes/app';
import { show as municipalDetails } from '@/routes/map/parking-municipal';
import { show as offstreetDetails } from '@/routes/map/parking-offstreet';
import { show as communityDetails } from '@/routes/map/parking-spaces';
import type { ParkingResult } from '@/types/destination';
import { Link } from '@inertiajs/react';
import { Eye, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Contributions from './contributions';
import ExistenceCheck from './existence-check';
import ParkingDetailBody, { type ParkingDetailData } from './parking-detail-body';
import { CommunityDescriptionCard, SourceIcon } from './parts';
import ReportStep from './report-step';
import { formatDistance } from './utils';

type Props = {
    result: ParkingResult | null;
    approximateDestination?: boolean;
    open: boolean;
    onClose: () => void;
    onCloseAutoFocus?: (event: Event) => void;
};

const detailUrls = {
    community: communityDetails.url,
    municipal: municipalDetails.url,
    offstreet: offstreetDetails.url,
} as const;

const favoriteTypes = {
    community: 'parking_space',
    municipal: 'parking_municipal',
    offstreet: 'parking_offstreet',
} as const;

export default function ParkingDetail({ result, approximateDestination = false, open, onClose, onCloseAutoFocus }: Props) {
    const { t, i18n } = useTranslation('frontend/map/modals');
    const { t: tGlobal } = useTranslation('global/common');
    const { can, user } = useAuthorization();
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = useState<ParkingDetailData | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [shared, setShared] = useState(false);
    const [reload, setReload] = useState(0);
    const [tab, setTab] = useState('info');
    // A step (reporting that the place is gone) temporarily replaces the tabs inside the same sheet.
    const [step, setStep] = useState<'report' | null>(null);
    // A refresh after confirming keeps the current view instead of flashing the loading state.
    const silentReload = useRef(false);

    const source = result?.source;
    const id = result?.id;

    useEffect(() => {
        const silent = silentReload.current;
        silentReload.current = false;
        if (!silent) {
            setShared(false);
            setTab('info');
            setStep(null);
        }
        if (!open || !source || !id) {
            setData(null);
            return;
        }
        const request = new AbortController();
        if (!silent) setStatus('loading');
        fetch(detailUrls[source](id), { signal: request.signal, headers: { Accept: 'application/json' } })
            .then((response) => {
                if (!response.ok) throw new Error('Parking detail request failed');
                return response.json();
            })
            .then((detail) => {
                setData({ source, detail } as ParkingDetailData);
                setStatus('ready');
            })
            .catch(() => {
                if (!request.signal.aborted && !silent) setStatus('error');
            });

        return () => request.abort();
    }, [open, source, id, reload]);

    // New garage occupancy replaces the shown values without a loading state; the server decides what is current.
    useEffect(() => {
        if (!open || source !== 'offstreet' || !id) return;
        const echo = getEcho();
        if (!echo) return;
        const channel = echo.channel('parking-offstreet');
        const request = new AbortController();
        const refresh = () => {
            fetch(detailUrls.offstreet(id), { signal: request.signal, headers: { Accept: 'application/json' } })
                .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Parking detail refresh failed'))))
                .then((detail) => setData({ source: 'offstreet', detail } as ParkingDetailData))
                .catch(() => {});
        };
        channel.listen('.observations.applied', refresh);

        // Only this listener is removed: the map shares the channel for its garage badges.
        return () => {
            request.abort();
            channel.stopListening('.observations.applied', refresh);
        };
    }, [open, source, id]);

    const share = useCallback(() => {
        if (!result) return;
        const url = `${window.location.origin}${window.location.pathname}#18/${result.latitude.toFixed(5)}/${result.longitude.toFixed(5)}`;
        navigator.clipboard?.writeText(url).then(() => setShared(true));
    }, [result]);

    if (!result) return null;

    const detail = status === 'ready' && data?.source === result.source && data.detail.id === result.id ? data : null;
    const community = detail && detail.source === 'community' ? detail : null;
    // Street places get the existence check and a Contributions tab; garages are facilities and keep one plain view.
    const street = detail && detail.source !== 'offstreet' ? detail : null;
    const title =
        (detail?.source === 'offstreet' ? detail.detail.name : detail?.detail.street)?.trim() || result.title.trim() || t('detail.no_address');

    const distance =
        result.distance_metres !== null && Number.isFinite(result.distance_metres)
            ? t(approximateDestination ? 'detail.distance_search_point' : 'detail.distance', {
                  distance: formatDistance(result.distance_metres, i18n.language),
              })
            : null;
    const description = t(
        `detail.descriptions.${result.source === 'offstreet' ? (detail?.source === 'offstreet' && detail.detail.type === 'parkandride' ? 'parkandride' : 'garage') : result.source}`,
    );
    const heading = (
        <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                <SourceIcon source={result.source} className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col text-left">
                <span className="text-base leading-tight font-semibold">{title}</span>
                {distance && <span className="mt-0.5 text-xs font-normal text-muted-foreground">{distance}</span>}
            </span>
        </span>
    );

    // Logging in from this dialog returns to the same place instead of the dashboard.
    const loginHref = login({ query: { return: placeLinkPath(result) } });

    const refreshSilently = () => {
        silentReload.current = true;
        setReload((value) => value + 1);
    };

    const existence = street && (
        <ExistenceCheck
            key={`${street.source}:${street.detail.id}`}
            source={street.source}
            id={street.detail.id}
            confirmedCount={street.detail.confirmations_count?.confirmed ?? 0}
            lastConfirmedAt={street.detail.last_confirmed_at}
            confirmedToday={!!street.detail.confirmed_today}
            reported={!!street.detail.reported_by_you}
            signedIn={!!user}
            loginHref={loginHref}
            onConfirmed={refreshSilently}
            onReport={() => setStep('report')}
        />
    );

    const infoContent = detail && (
        <div className="flex flex-col gap-4">
            <ParkingDetailBody data={detail} isLoggedIn={!!user} existence={existence || undefined} />
            {community?.detail.description && (
                <CommunityDescriptionCard title={t('community.tabs.description')} description={community.detail.description} />
            )}
        </div>
    );

    const body =
        status === 'error' ? (
            <div role="alert" className="flex flex-col items-start gap-3 py-6">
                <p>{t('detail.error')}</p>
                <Button variant="outline" className="min-h-11" onClick={() => setReload((value) => value + 1)}>
                    {t('detail.retry')}
                </Button>
            </div>
        ) : !detail ? (
            <p role="status" className="py-6 text-sm text-muted-foreground">
                {t('detail.loading')}
            </p>
        ) : street && step === 'report' ? (
            <ReportStep
                source={street.source}
                id={street.detail.id}
                onBack={() => setStep(null)}
                onReported={() => {
                    setStep(null);
                    setTab('info');
                    refreshSilently();
                }}
            />
        ) : street ? (
            <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger value="info" className="cursor-pointer">
                        {t('detail.tabs.info')}
                    </TabsTrigger>
                    <TabsTrigger value="contribute" className="cursor-pointer">
                        {t('detail.tabs.contribute')}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="info">{infoContent}</TabsContent>
                <TabsContent value="contribute">
                    <Contributions data={street} signedIn={!!user} loginHref={loginHref} onReport={() => setStep('report')} />
                </TabsContent>
            </Tabs>
        ) : (
            infoContent
        );

    const headerActions = (
        <div className="flex shrink-0 items-center gap-1">
            {user && detail && (
                <FavoriteButton
                    key={detail.detail.id}
                    initial={!!detail.detail.is_favorited}
                    id={detail.detail.id}
                    type={favoriteTypes[detail.source]}
                />
            )}
            <TooltipProvider>
                <Tooltip open={shared} onOpenChange={() => setShared(false)} delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-11" aria-label={t('detail.share')} onClick={share}>
                            <Share2 className="h-5 w-5" aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                        {t('common.table.copied')}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {isDesktop && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-11 rounded-full bg-muted text-muted-foreground"
                    aria-label={tGlobal('common.close')}
                    onClick={onClose}
                >
                    <X className="h-5 w-5" aria-hidden />
                </Button>
            )}
        </div>
    );

    const footer =
        detail?.source === 'community' && can('parking-space.view') ? (
            <Button asChild variant="outline" className="min-h-11">
                <Link href={app.parkingSpaces.show({ parking_space: detail.detail.id })} target="_blank" rel="noopener">
                    <Eye className="h-4 w-4" aria-hidden />
                    {t('detail.admin')}
                </Link>
            </Button>
        ) : null;

    const sharedStatus = (
        <p role="status" aria-live="polite" className="sr-only">
            {shared ? t('detail.shared') : ''}
        </p>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
                <DialogContent
                    onCloseAutoFocus={onCloseAutoFocus}
                    showClose={false}
                    className="flex max-h-[90vh] max-w-xl flex-col bg-white sm:rounded-xl dark:bg-zinc-950"
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-2">
                            <DialogTitle>{heading}</DialogTitle>
                            {headerActions}
                        </div>
                        <DialogDescription className="text-center text-pretty">{description}</DialogDescription>
                    </DialogHeader>
                    {sharedStatus}
                    <div className="min-h-0 overflow-y-auto pr-1">{body}</div>
                    {footer && <DialogFooter className="flex flex-row justify-end gap-2">{footer}</DialogFooter>}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer autoFocus open={open} onOpenChange={(value) => !value && onClose()}>
            <DrawerContent
                onCloseAutoFocus={onCloseAutoFocus}
                className="mx-auto max-w-xl overflow-hidden bg-white data-[vaul-drawer-direction=bottom]:max-h-[90dvh] dark:bg-zinc-950"
            >
                <DrawerHeader className="shrink-0 text-left">
                    <div className="flex items-start justify-between gap-2">
                        <DrawerTitle className="min-w-0">{heading}</DrawerTitle>
                        {headerActions}
                    </div>
                    <DrawerDescription className="text-left text-xs leading-relaxed text-pretty">{description}</DrawerDescription>
                </DrawerHeader>
                {sharedStatus}
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{body}</div>
                {footer && (
                    <DrawerFooter className="flex shrink-0 flex-row justify-end gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                        {footer}
                    </DrawerFooter>
                )}
            </DrawerContent>
        </Drawer>
    );
}
