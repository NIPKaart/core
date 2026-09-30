import DetailsStep from '@/components/contribute/details-step';
import { CenterPin } from '@/components/contribute/new-place-pin';
import ReviewStep from '@/components/contribute/review-step';
import type { ContributionForm, ContributionStep, OrientationOption, PinLocation } from '@/components/contribute/types';
import { usePinLocation } from '@/components/contribute/use-pin-location';
import InputError from '@/components/input-error';
import MapDisplayControls, { type MapStyle } from '@/components/map/map-display-controls';
import ParkingMapLayer from '@/components/map/parking-map-layer';
import { Button } from '@/components/ui/button';
import MapLayout from '@/layouts/map-layout';
import { placeLinkPath } from '@/lib/place-link';
import { cn } from '@/lib/utils';
import { store, update } from '@/routes/location-map';
import improve from '@/routes/map/places/improve';
import profile from '@/routes/profile';
import { Head, Link, useForm } from '@inertiajs/react';
import type { Map as LeafletMap } from 'leaflet';
import { AlertTriangle, Check, ChevronLeft, Info, LoaderCircle, LocateFixed, Move, PencilLine, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { toast } from 'sonner';

type ExistingSubmission = {
    id: string;
    latitude: number;
    longitude: number;
    orientation: string | null;
    under_sign: 'yes' | 'no' | null;
    under_sign_text: string | null;
    parking_time: number | null;
    restriction_days: string[] | null;
    restriction_starts_at: string | null;
    restriction_ends_at: string | null;
    description: string | null;
};

type PageProps = {
    orientationOptions: OrientationOption[];
    restrictionDays: string[];
    parkingSpace: ExistingSubmission | null;
    /** Proposing an improvement to a published space rather than editing one's own pending submission. */
    improving?: boolean;
};

const COUNTRY_VIEW = { latitude: 52.2, longitude: 5.3, zoom: 8 };
const DETAIL_FIELDS: (keyof ContributionForm)[] = [
    'orientation',
    'under_sign',
    'under_sign_text',
    'parking_hours',
    'parking_minutes',
    'restriction_days',
    'restriction_starts_at',
    'restriction_ends_at',
    'description',
];

/** The map position handed over from the discovery map, as `#zoom/lat/lng`. */
function viewFromHash(): { latitude: number; longitude: number; zoom: number } | null {
    const match = window.location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
    return match ? { zoom: Number(match[1]), latitude: Number(match[2]), longitude: Number(match[3]) } : null;
}

function initialForm(existing: ExistingSubmission | null): ContributionForm {
    return {
        latitude: existing?.latitude ?? null,
        longitude: existing?.longitude ?? null,
        orientation: existing?.orientation ?? '',
        under_sign: existing?.under_sign ?? '',
        under_sign_text: existing?.under_sign_text ?? '',
        parking_hours: existing?.parking_time ? String(Math.floor(existing.parking_time / 60)) : '',
        parking_minutes: existing?.parking_time ? String(existing.parking_time % 60) : '',
        restriction_days: existing?.restriction_days ?? [],
        restriction_starts_at: existing?.restriction_starts_at?.slice(0, 5) ?? '',
        restriction_ends_at: existing?.restriction_ends_at?.slice(0, 5) ?? '',
        description: existing?.description ?? '',
    };
}

function MapWatcher({
    onMove,
    onMoving,
}: {
    onMove: (center: { latitude: number; longitude: number }, zoom: number) => void;
    onMoving: (moving: boolean) => void;
}) {
    const map = useMapEvents({
        movestart: () => onMoving(true),
        moveend: () => {
            onMoving(false);
            const center = map.getCenter();
            onMove({ latitude: center.lat, longitude: center.lng }, map.getZoom());
        },
    });
    return null;
}

/** Locks the map once a location is chosen, and re-measures it when it becomes visible again. */
function MapState({ locked, step }: { locked: boolean; step: ContributionStep }) {
    const map = useMap();
    useEffect(() => {
        const handlers = [map.dragging, map.scrollWheelZoom, map.doubleClickZoom, map.touchZoom, map.boxZoom, map.keyboard];
        handlers.forEach((handler) => (locked ? handler.disable() : handler.enable()));
    }, [map, locked]);
    useEffect(() => {
        map.invalidateSize();
    }, [map, step]);
    return null;
}

function LocationStatus({ state, onRetry }: { state: PinLocation; onRetry: () => void }) {
    const { t } = useTranslation('frontend/map/contribute');

    if (state.status === 'zoom') {
        return (
            <p className="flex items-start gap-2.5 text-sm text-muted-foreground" role="status">
                <Move className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('location.zoom_in')}
            </p>
        );
    }
    if (state.status === 'resolving') {
        return (
            <p className="flex items-center gap-2.5 text-sm text-muted-foreground" role="status">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {t('location.resolving')}
            </p>
        );
    }
    if (state.status === 'failed') {
        return (
            <div className="flex items-start gap-3" role="alert">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    <AlertTriangle className="size-4" aria-hidden />
                </span>
                <div className="grid gap-1">
                    <h2 className="font-semibold">{t('location.failed_title')}</h2>
                    <p className="text-sm text-muted-foreground">{state.message || t('location.failed_text')}</p>
                    <Button variant="outline" className="mt-1 h-11 justify-self-start" onClick={onRetry}>
                        {t('location.retry')}
                    </Button>
                </div>
            </div>
        );
    }

    const { location, nearbyMetres } = state;

    return (
        <div className="grid gap-3" role="status">
            <div className="grid gap-1.5">
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('location.chosen')}</h2>
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                        <Check className="size-4" aria-hidden />
                    </span>
                    <div>
                        <p className="text-lg leading-6 font-semibold">{location.street ?? location.municipality}</p>
                        <p className="text-sm text-muted-foreground">
                            {[location.municipality, location.province, location.country].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>
            </div>
            {nearbyMetres !== null && (
                <p className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {t('location.nearby', { distance: nearbyMetres })}
                </p>
            )}
        </div>
    );
}

export default function Contribute({ orientationOptions, restrictionDays, parkingSpace, improving = false }: PageProps) {
    const { t } = useTranslation('frontend/map/contribute');
    const { t: tGlobal } = useTranslation('frontend/global');
    const editing = parkingSpace !== null;
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    const initialView = useMemo(
        () => (parkingSpace ? { latitude: parkingSpace.latitude, longitude: parkingSpace.longitude, zoom: 19 } : (viewFromHash() ?? COUNTRY_VIEW)),
        [parkingSpace],
    );
    const [map, setMap] = useState<LeafletMap | null>(null);
    const [step, setStep] = useState<ContributionStep>(editing ? 2 : 1);
    const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
    const [moving, setMoving] = useState(false);
    const [center, setCenter] = useState<{ latitude: number; longitude: number }>({
        latitude: initialView.latitude,
        longitude: initialView.longitude,
    });
    const [zoom, setZoom] = useState(initialView.zoom);
    const { state: pinState, retry } = usePinLocation(center, zoom, true);
    const panel = useRef<HTMLDivElement>(null);

    const form = useForm<ContributionForm>(initialForm(parkingSpace));

    const onMove = useCallback((next: { latitude: number; longitude: number }, nextZoom: number) => {
        setCenter(next);
        setZoom(nextZoom);
    }, []);

    const locateMe = useCallback(
        (quiet = false) => {
            if (!map || !('geolocation' in navigator)) return;
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => map.flyTo([coords.latitude, coords.longitude], 19),
                () => !quiet && toast.error(t('location.my_location_failed')),
                { enableHighAccuracy: true, timeout: 10000 },
            );
        },
        [map, t],
    );

    // Without a map position to continue from (for example from Mijn NIPKaart), start at the device's location.
    const startedFromContext = useRef(initialView !== COUNTRY_VIEW);
    useEffect(() => {
        if (map && !startedFromContext.current) {
            startedFromContext.current = true;
            locateMe(true);
        }
    }, [map, locateMe]);

    useEffect(() => {
        panel.current?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });
    }, [step]);

    const useLocation = () => {
        form.setData((data) => ({ ...data, latitude: center.latitude, longitude: center.longitude }));
        form.clearErrors('latitude', 'longitude');
        setStep(2);
    };

    const toReview = () => {
        form.clearErrors();
        const missing: Partial<Record<keyof ContributionForm, string>> = {};
        if (!form.data.orientation) missing.orientation = t('details.orientation.required');
        // An improvement may leave an unknown under-sign unknown rather than force a guess.
        if (!form.data.under_sign && !improving) missing.under_sign = t('details.under_sign.required');
        if (Object.keys(missing).length) {
            form.setError(missing);
            return;
        }
        setStep(3);
    };

    const submit = () => {
        const options = {
            preserveScroll: true,
            onError: (errors: Record<string, string>) => {
                if (errors.latitude || errors.longitude) setStep(1);
                else if (errors.general) setStep(2);
                else if (DETAIL_FIELDS.some((field) => Object.keys(errors).some((key) => key === field || key.startsWith(`${field}.`)))) setStep(2);
            },
        };
        if (improving) form.post(improve.store.url({ parking_space: parkingSpace!.id }), options);
        else if (editing) form.put(update.url({ parking_space: parkingSpace.id }), options);
        else form.post(store.url(), options);
    };

    const mode = improving ? 'improve' : editing ? 'edit' : 'add';
    const stepNames: Record<ContributionStep, string> = { 1: t('steps.location'), 2: t('steps.details'), 3: t('steps.review') };
    const canUseLocation = pinState.status === 'resolved' && !moving;
    const cancelHref = improving
        ? placeLinkPath({ source: 'community', id: parkingSpace!.id, latitude: parkingSpace!.latitude, longitude: parkingSpace!.longitude })
        : editing
          ? profile.parkingSpaces.show.url({ id: parkingSpace.id })
          : '/map' + (step === 1 ? `#${Math.round(zoom)}/${center.latitude.toFixed(5)}/${center.longitude.toFixed(5)}` : '');
    const locationLabel =
        pinState.status === 'resolved' ? [pinState.location.street, pinState.location.municipality].filter(Boolean).join(', ') : null;

    return (
        <MapLayout showSearch={false} mobileNavbar={false}>
            <Head title={t(`head.${mode}`)} />

            <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-1 md:hidden">
                {step === 1 ? (
                    <Button asChild variant="ghost" size="icon" className="size-11">
                        <Link href={cancelHref} aria-label={t('header.cancel')}>
                            <X className="size-5" aria-hidden />
                        </Link>
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={t('header.back')}
                        onClick={() => setStep((step - 1) as ContributionStep)}
                    >
                        <ChevronLeft className="size-5" aria-hidden />
                    </Button>
                )}
                <div className="text-center">
                    <h1 className="text-base font-semibold">{t(`header.${mode}`)}</h1>
                    <p className="text-xs text-muted-foreground">{t('header.step', { step, name: stepNames[step] })}</p>
                </div>
                <img src="/assets/images/logo-light.svg" alt="NIPKaart" className="mr-2 h-5 w-auto dark:hidden" />
                <img src="/assets/images/logo-dark.svg" alt="NIPKaart" className="mr-2 hidden h-5 w-auto dark:block" />
            </header>
            <div className="h-1 shrink-0 bg-muted md:hidden" aria-hidden>
                <div className="h-1 bg-orange-600 transition-[width]" style={{ width: `${(step / 3) * 100}%` }} />
            </div>

            <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
                <section aria-label={t('location.heading')} className={cn('relative min-h-0 flex-1', step > 1 && 'hidden md:block')}>
                    <MapContainer
                        ref={setMap}
                        center={[initialView.latitude, initialView.longitude]}
                        zoom={initialView.zoom}
                        maxZoom={21}
                        zoomControl={false}
                        className="z-0 h-full w-full"
                    >
                        {mapStyle === 'streets' ? (
                            <TileLayer
                                key="streets"
                                attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                maxZoom={22}
                            />
                        ) : (
                            <TileLayer
                                key="satellite"
                                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                maxZoom={21}
                            />
                        )}
                        <ParkingMapLayer onSelect={() => undefined} selectedKey={null} />
                        <MapWatcher onMove={onMove} onMoving={setMoving} />
                        <MapState locked={step > 1} step={step} />
                    </MapContainer>

                    <CenterPin muted={pinState.status === 'failed'} lifted={moving} />
                    {step > 1 && <div className="pointer-events-none absolute inset-0 z-[400] bg-background/25" aria-hidden />}

                    {step === 1 ? (
                        <>
                            <p className="absolute top-3 right-28 left-3 z-[600] rounded-xl border bg-background/95 px-3 py-2.5 text-sm shadow-md md:right-auto md:max-w-sm">
                                {t('location.hint')}
                            </p>
                            <div className="absolute top-3 right-3 z-[600]">
                                <MapDisplayControls value={mapStyle} onChange={setMapStyle} />
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="absolute right-3 bottom-4 z-[600] size-12 rounded-xl border-0 bg-background shadow-md"
                                aria-label={t('location.my_location')}
                                title={t('location.my_location')}
                                onClick={() => locateMe()}
                            >
                                <LocateFixed className="size-5" aria-hidden />
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            className="absolute bottom-4 left-4 z-[600] h-11 gap-2 rounded-xl border-0 bg-background shadow-md"
                            onClick={() => setStep(1)}
                        >
                            <PencilLine className="size-4" aria-hidden />
                            {t('review.change_location')}
                        </Button>
                    )}
                </section>

                <aside
                    aria-label={stepNames[step]}
                    className={cn(
                        'z-10 flex flex-col bg-background md:w-[460px] md:shrink-0 md:border-l',
                        step === 1
                            ? '-mt-4 rounded-t-2xl shadow-[0_-8px_28px_rgba(0,0,0,0.14)] md:mt-0 md:rounded-none md:shadow-none'
                            : 'min-h-0 flex-1 md:flex-none',
                    )}
                >
                    <div
                        ref={panel}
                        className={cn(
                            'flex flex-col gap-4 p-5 md:flex-1 md:gap-6 md:overflow-y-auto md:p-7',
                            step > 1 && 'flex-1 overflow-y-auto bg-muted/30 md:bg-background',
                        )}
                    >
                        {step === 1 && <div className="mx-auto h-1 w-10 rounded-full bg-border md:hidden" aria-hidden />}

                        <ol className="hidden gap-2 md:flex" aria-label={t('header.step', { step, name: stepNames[step] })}>
                            {([1, 2, 3] as const).map((number) => (
                                <li
                                    key={number}
                                    aria-current={number === step ? 'step' : undefined}
                                    className={cn(
                                        'flex flex-1 flex-col gap-1.5 text-sm',
                                        number === step ? 'font-semibold' : 'text-muted-foreground',
                                    )}
                                >
                                    <span className={cn('h-1 rounded-full', number <= step ? 'bg-orange-600' : 'bg-border')} aria-hidden />
                                    <span>
                                        <span className="tabular-nums">{number}</span>
                                        <span className="mx-1.5 text-muted-foreground/60" aria-hidden>
                                            ·
                                        </span>
                                        {stepNames[number]}
                                    </span>
                                </li>
                            ))}
                        </ol>

                        {step === 1 && (
                            <>
                                <div className="hidden gap-1.5 md:grid">
                                    <h1 className="text-2xl font-bold">{t('location.heading')}</h1>
                                    <p className="text-muted-foreground">{t('location.intro')}</p>
                                </div>
                                <LocationStatus state={pinState} onRetry={retry} />
                                <InputError message={form.errors.latitude ?? form.errors.longitude} />
                            </>
                        )}

                        {step === 2 && (
                            <>
                                {improving && (
                                    <>
                                        <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">{t('improve.intro')}</p>
                                        <InputError message={(form.errors as Record<string, string>).general} />
                                    </>
                                )}
                                <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 md:hidden">
                                    <div className="grid flex-1">
                                        <span className="font-semibold">{locationLabel ?? tGlobal('common.loading')}</span>
                                        <span className="text-sm text-muted-foreground">
                                            {pinState.status === 'resolved' ? pinState.location.province : null}
                                        </span>
                                    </div>
                                    <Button variant="ghost" className="h-11 text-orange-700 dark:text-orange-400" onClick={() => setStep(1)}>
                                        {t('details.change')}
                                    </Button>
                                </div>
                                <h1 className="hidden text-2xl font-bold md:block">{locationLabel}</h1>
                                <DetailsStep
                                    data={form.data}
                                    setData={(key, value) => form.setData(key, value as never)}
                                    errors={form.errors}
                                    orientationOptions={orientationOptions}
                                    restrictionDays={restrictionDays}
                                />
                            </>
                        )}

                        {step === 3 && (
                            <ReviewStep
                                data={form.data}
                                location={pinState.status === 'resolved' ? pinState.location : null}
                                orientationOptions={orientationOptions}
                                restrictionDays={restrictionDays}
                                onEditLocation={() => setStep(1)}
                                onEditDetails={() => setStep(2)}
                                after={improving ? 'improve.after' : 'review.after'}
                            />
                        )}
                    </div>

                    <div className="flex gap-2.5 border-t bg-background p-4 md:border-t-0 md:px-7 md:pt-0 md:pb-7">
                        {step > 1 && (
                            <Button
                                variant="outline"
                                className="hidden h-13 flex-1 text-base md:inline-flex"
                                onClick={() => setStep((step - 1) as ContributionStep)}
                            >
                                {t('header.back')}
                            </Button>
                        )}
                        {step === 1 && (
                            <Button className="h-13 flex-[2] text-base" disabled={!canUseLocation} onClick={useLocation}>
                                {t('location.use')}
                            </Button>
                        )}
                        {step === 2 && (
                            <Button className="h-13 flex-[2] text-base" onClick={toReview}>
                                {t('details.next')}
                            </Button>
                        )}
                        {step === 3 && (
                            <Button
                                className="h-13 flex-[2] bg-orange-600 text-base text-white hover:bg-orange-700"
                                disabled={form.processing}
                                onClick={submit}
                            >
                                {form.processing && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                                {t(improving ? 'improve.submit' : editing ? 'review.save' : 'review.submit')}
                            </Button>
                        )}
                    </div>
                </aside>
            </main>
        </MapLayout>
    );
}
