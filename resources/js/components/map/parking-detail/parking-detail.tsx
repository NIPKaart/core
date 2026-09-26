import { FavoriteButton } from '@/components/frontend/button/favorite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ParkingConfirmForm } from '@/pages/frontend/form/form-confirm-location';
import { login } from '@/routes';
import app from '@/routes/app';
import { show as municipalDetails } from '@/routes/map/parking-municipal';
import { show as offstreetDetails } from '@/routes/map/parking-offstreet';
import { show as communityDetails } from '@/routes/map/parking-spaces';
import type { ParkingResult } from '@/types/destination';
import { Link } from '@inertiajs/react';
import { Eye, FileText, Info as InfoIcon, MapPinCheckInside, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ParkingDetailBody, { type ParkingDetailData } from './parking-detail-body';
import { CommunityDescriptionCard, SourceIcon } from './parts';
import { formatDistance } from './utils';

type Props = {
    result: ParkingResult | null;
    open: boolean;
    onClose: () => void;
    onCloseAutoFocus?: (event: Event) => void;
    confirmationStatusOptions: Record<string, string>;
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

const tabTriggerClass =
    'flex flex-1 cursor-pointer items-center justify-center gap-1 data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white';

export default function ParkingDetail({ result, open, onClose, onCloseAutoFocus, confirmationStatusOptions }: Props) {
    const { t, i18n } = useTranslation('frontend/map/modals');
    const { t: tGlobal } = useTranslation('frontend/global');
    const { can, user } = useAuthorization();
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const [data, setData] = useState<ParkingDetailData | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [shared, setShared] = useState(false);
    const [reload, setReload] = useState(0);
    const [tab, setTab] = useState('info');

    const source = result?.source;
    const id = result?.id;

    useEffect(() => {
        setShared(false);
        setTab('info');
        if (!open || !source || !id) {
            setData(null);
            return;
        }
        const request = new AbortController();
        setStatus('loading');
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
                if (!request.signal.aborted) setStatus('error');
            });

        return () => request.abort();
    }, [open, source, id, reload]);

    const share = useCallback(() => {
        if (!result) return;
        const url = `${window.location.origin}${window.location.pathname}#18/${result.latitude.toFixed(5)}/${result.longitude.toFixed(5)}`;
        navigator.clipboard?.writeText(url).then(() => setShared(true));
    }, [result]);

    if (!result) return null;

    const detail = status === 'ready' && data?.source === result.source && data.detail.id === result.id ? data : null;
    const community = detail && detail.source === 'community' ? detail : null;
    const hasDescription = !!community?.detail.description;
    const showTabs = !!community && (!!user || hasDescription);
    const title =
        (detail?.source === 'offstreet' ? detail.detail.name : detail?.detail.street)?.trim() || result.title.trim() || t('detail.no_address');

    const distance =
        result.distance_metres !== null && Number.isFinite(result.distance_metres)
            ? t('detail.distance', { distance: formatDistance(result.distance_metres, i18n.language) })
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

    const signInHint = (
        <section aria-labelledby="parking-detail-contribute" className="flex flex-col gap-2">
            <h3 id="parking-detail-contribute" className="text-base font-semibold">
                {t('detail.sections.contribute')}
            </h3>
            <p className="text-sm">
                {t('detail.contribute_signed_out')}{' '}
                <Link href={login()} className="underline underline-offset-2">
                    {t('detail.log_in')}
                </Link>
            </p>
        </section>
    );

    const infoContent = detail && (
        <ParkingDetailBody data={detail} isLoggedIn={!!user} communityActions={community && !user ? signInHint : undefined} />
    );

    const confirmContent = community && user && (
        <div className="py-3">
            <ParkingConfirmForm
                spaceId={community.detail.id}
                confirmationStatusOptions={confirmationStatusOptions}
                confirmedToday={!!community.detail.confirmed_today}
                onConfirmed={() => setReload((value) => value + 1)}
            />
        </div>
    );

    const descriptionContent = community?.detail.description && (
        <CommunityDescriptionCard title={t('community.tabs.description')} description={community.detail.description} />
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
        ) : showTabs ? (
            <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="mb-2 flex w-full">
                    <TabsTrigger value="info" className={tabTriggerClass}>
                        <InfoIcon className="h-4 w-4" aria-hidden />
                        {t('community.tabs.info')}
                    </TabsTrigger>
                    {user && (
                        <TabsTrigger value="confirm" className={tabTriggerClass}>
                            <MapPinCheckInside className="h-4 w-4" aria-hidden />
                            {t('community.tabs.confirm')}
                        </TabsTrigger>
                    )}
                    {hasDescription && (
                        <TabsTrigger value="description" className={tabTriggerClass}>
                            <FileText className="h-4 w-4" aria-hidden />
                            {t('community.tabs.description')}
                        </TabsTrigger>
                    )}
                </TabsList>
                <TabsContent value="info">{infoContent}</TabsContent>
                {user && <TabsContent value="confirm">{confirmContent}</TabsContent>}
                {hasDescription && <TabsContent value="description">{descriptionContent}</TabsContent>}
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
            <Button size="icon" variant="ghost" className="size-11" aria-label={tGlobal('common.close')} onClick={onClose}>
                <X className="h-5 w-5" aria-hidden />
            </Button>
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
                        <DialogDescription className="text-center">{description}</DialogDescription>
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
            <DrawerContent onCloseAutoFocus={onCloseAutoFocus} className="mx-auto max-w-xl bg-white dark:bg-zinc-950">
                <DrawerHeader className="text-left">
                    <div className="flex items-start justify-between gap-2">
                        <DrawerTitle>{heading}</DrawerTitle>
                        {headerActions}
                    </div>
                    <DrawerDescription className="text-center">{description}</DrawerDescription>
                </DrawerHeader>
                {sharedStatus}
                <div className="overflow-y-auto px-4">{body}</div>
                {footer && <DrawerFooter className="flex flex-row justify-end gap-2">{footer}</DrawerFooter>}
            </DrawerContent>
        </Drawer>
    );
}
