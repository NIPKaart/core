import ParkingSpaceStatusBanner from '@/components/alerts/status-parking-space';
import LocationMarkerCard from '@/components/map/card-location-marker';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace, ParkingSpaceConfirmation } from '@/types';
import { Head, Link } from '@inertiajs/react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Compass, Copy, Edit, Globe, Hash, Home, Landmark, MapPin, Server, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type PageProps = {
    parkingSpace: ParkingSpace;
    selectOptions: {
        orientation: { value: string; label: string; description: string }[];
        parkingStatuses: { value: string; label: string; description: string }[];
        confirmationStatuses: { value: string; label: string; description: string }[];
    };
    nearbySpaces: ParkingSpace[];
    recentConfirmations: ParkingSpaceConfirmation[];
};

export default function Show({ parkingSpace, selectOptions, nearbySpaces, recentConfirmations }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/main');
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpaceActionDialog();

    const statusOpt = selectOptions.parkingStatuses.find((s) => s.value === parkingSpace.status)!;

    function copyToClipboard(val: string) {
        navigator.clipboard.writeText(val);
        toast.success(t('show.toast.copied'));
    }

    const ipAddress = parkingSpace.ip_address ?? '';
    const orientation = selectOptions.orientation.find((o) => o.value === parkingSpace.orientation);
    const fields = [
        {
            icon: <Globe className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.country'),
            value: parkingSpace.country?.name ? (
                <>
                    {parkingSpace.country.name}
                    <span className="ml-1 font-normal text-muted-foreground">({parkingSpace.country.code})</span>
                </>
            ) : null,
        },
        {
            icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.province'),
            value: parkingSpace.province?.name,
        },
        {
            icon: <MapPin className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.municipality'),
            value: parkingSpace.municipality?.name,
        },
        {
            icon: <Home className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.city'),
            value: parkingSpace.city,
        },
        {
            icon: <Tag className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.street'),
            value: parkingSpace.street,
        },
        {
            icon: <Hash className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.postcode'),
            value: parkingSpace.postcode,
        },
        {
            icon: <Compass className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.amenity'),
            value: parkingSpace.amenity,
        },
        {
            icon: <Compass className="h-4 w-4 rotate-90 text-muted-foreground" />,
            label: t('show.cards.details.fields.orientation'),
            value: orientation ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-4">{orientation.label}</span>
                    </TooltipTrigger>
                    <TooltipContent>{orientation.description}</TooltipContent>
                </Tooltip>
            ) : (
                parkingSpace.orientation
            ),
        },
        {
            icon: <Server className="h-4 w-4 text-muted-foreground" />,
            label: t('show.cards.details.fields.ip_address'),
            value: ipAddress ? (
                <span className="flex items-center gap-1">
                    <a
                        href={`https://whatismyipaddress.com/?s=${ipAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-orange-600 hover:underline dark:text-orange-400"
                    >
                        {ipAddress}
                    </a>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(ipAddress)}
                        className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                        title={t('show.cards.details.fields.copy_ip')}
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </span>
            ) : null,
        },
    ];

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: route('app.parking-spaces.index') },
        { title: t('breadcrumbs.show', { id: parkingSpace.id }), href: route('app.parking-spaces.show', { id: parkingSpace.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.show', { id: parkingSpace.id })} />
            {/* Header */}
            <div className="mb-4 flex flex-col gap-4 px-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <h1 className="text-2xl font-bold tracking-tight">{t('head.show', { id: parkingSpace.id })}</h1>
                <div className="flex w-full gap-2 sm:w-auto sm:justify-end sm:self-start">
                    <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                        <Link href={route('app.parking-spaces.index')}>
                            <ArrowLeft className="h-4 w-4" />
                            {tGlobal('common.back')}
                        </Link>
                    </Button>

                    {can('parking-space.update') && (
                        <Button asChild variant="outline" className="w-1/2 sm:w-auto">
                            <Link href={route('app.parking-spaces.edit', { id: parkingSpace.id })}>
                                <Edit className="h-4 w-4" />
                                {tGlobal('common.edit')}
                            </Link>
                        </Button>
                    )}

                    {can('parking-space.delete') && (
                        <Button variant="destructive" className="w-1/2 cursor-pointer sm:w-auto" onClick={() => openDialog('delete', parkingSpace)}>
                            <Trash2 className="h-4 w-4" />
                            {t('show.trash')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Banner Notification */}
            <div className="px-4 sm:px-6">
                <ParkingSpaceStatusBanner parkingSpace={parkingSpace} label={statusOpt.label} description={statusOpt.description} />
            </div>

            {/* 2×2 grid met auto-rows-min */}
            <div className="grid auto-rows-min grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
                {/* Card 1: Details */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">{t('show.cards.details.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('show.cards.details.description')}</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                        <dl>
                            {fields.map(({ icon, label, value }, idx) => (
                                <div
                                    key={label}
                                    className={clsx(
                                        'flex items-center justify-between gap-3 px-4 py-3',
                                        'sm:grid sm:grid-cols-[2rem_10rem_1fr] sm:items-start',
                                        idx % 2 === 0 && 'bg-muted/20',
                                        idx === 0 && 'rounded-t-xl',
                                        idx === fields.length - 1 && 'rounded-b-xl',
                                    )}
                                >
                                    {/* Icon + Label (mobile) */}
                                    <div className="flex items-center gap-2 sm:col-span-1 sm:justify-center">
                                        <div className="text-muted-foreground">{icon}</div>
                                        <dt className="text-xs text-muted-foreground sm:hidden">{label}</dt>
                                    </div>

                                    {/* Label (desktop only) */}
                                    <dt className="hidden text-xs text-muted-foreground sm:block">{label}</dt>

                                    {/* Value */}
                                    <dd className="text-right text-sm font-medium break-words text-foreground sm:text-left">
                                        {value || <span className="text-muted-foreground">—</span>}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>

                {/* Card 2: Recent confirmations */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">{t('show.cards.confirmations.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('show.cards.confirmations.description')}</p>
                    </div>
                    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                        {recentConfirmations && recentConfirmations.length > 0 ? (
                            <>
                                <ul>
                                    {recentConfirmations.map((confirmation, i) => {
                                        const statusOpt = selectOptions.confirmationStatuses.find((s) => s.value === confirmation.status);
                                        const badgeVariant: 'default' | 'secondary' | 'destructive' =
                                            confirmation.status === 'confirmed'
                                                ? 'secondary'
                                                : confirmation.status === 'moved'
                                                  ? 'default'
                                                  : confirmation.status === 'unavailable'
                                                    ? 'destructive'
                                                    : 'default';
                                        return (
                                            <li key={confirmation.id} className={`px-3 py-2 ${i !== 0 ? 'border-t border-muted' : ''}`}>
                                                <div className="flex items-start gap-2">
                                                    {/* Badge links */}
                                                    <Badge variant={badgeVariant} className="mt-0.5 shrink-0">
                                                        {statusOpt?.label ?? confirmation.status}
                                                    </Badge>
                                                    {/* Main info + comment */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center justify-between">
                                                            <span className="truncate font-medium">
                                                                {confirmation.user?.name ?? t('show.cards.confirmations.unknown_user')}
                                                            </span>
                                                            <span className="shrink-0 pl-2 text-xs text-muted-foreground">
                                                                {formatDistanceToNow(new Date(confirmation.confirmed_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        {confirmation.comment && (
                                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground italic">
                                                                “{confirmation.comment}”
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                {can('parking-space-confirmation.view_any') && (
                                    <div className="flex justify-end bg-muted/50 px-3 py-3">
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="transition-colors hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Link href={route('app.parking-spaces.confirmations.index', { parking_space: parkingSpace.id })}>
                                                {t('show.cards.confirmations.show_all')}
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="px-3 py-5 text-sm text-muted-foreground">{t('show.cards.confirmations.empty')}</div>
                        )}
                    </div>
                </div>

                {/* Card 3: Map */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">{t('show.cards.location.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('show.cards.location.description')}</p>
                    </div>
                    <LocationMarkerCard latitude={parkingSpace.latitude} longitude={parkingSpace.longitude} nearbySpaces={nearbySpaces} />
                </div>

                {/* Card 4: Street View */}
                <div>
                    <div className="mb-4 space-y-1">
                        <h2 className="text-lg font-semibold">{t('show.cards.street_view.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('show.cards.street_view.description')}</p>
                    </div>
                    <StreetViewCard latitude={parkingSpace.latitude} longitude={parkingSpace.longitude} />
                </div>
            </div>
            {dialogElement}
        </AppLayout>
    );
}
