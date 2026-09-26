import LegendControl from '@/components/map/legend-control';
import LocateControl from '@/components/map/locate-control';
import ParkingMapLayer from '@/components/map/parking-map-layer';
import ParkingResults, { type DiscoveryStatus } from '@/components/map/parking-results';
import ViewportDiscovery from '@/components/map/viewport-discovery';
import ZoomControl from '@/components/map/zoom-control';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { DestinationResult, ParkingResult } from '@/types/destination';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { HashSync } from '@/components/map/hash-sync';
import ParkingDetail from '@/components/map/parking-detail/parking-detail';
import MapLayout from '@/layouts/map-layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { BaseLayer } = LayersControl;

/** A click on the map itself (not on a marker or cluster, which stop the event) clears the selection. */
function ClearSelectionOnMapClick({ onClear }: { onClear: () => void }) {
    useMapEvents({ click: onClear });
    return null;
}

function SelectedParking({ result }: { result: ParkingResult | null }) {
    const map = useMap();
    useEffect(() => {
        if (result)
            map.panInside([result.latitude, result.longitude], {
                animate: true,
                duration: 0.3,
                paddingTopLeft: [40, 40],
                paddingBottomRight: [40, window.matchMedia('(max-width: 767px)').matches ? map.getSize().y * 0.55 + 40 : 40],
            });
    }, [map, result]);
    return null;
}

function DestinationFocus({ destination }: { destination: DestinationResult | null }) {
    const map = useMap();
    useEffect(() => {
        if (destination?.bounds) {
            map.fitBounds(
                [
                    [destination.bounds.south, destination.bounds.west],
                    [destination.bounds.north, destination.bounds.east],
                ],
                {
                    maxZoom: 17,
                    paddingTopLeft: [40, 40],
                    paddingBottomRight: [40, map.getSize().y * 0.55 + 40],
                    animate: false,
                },
            );
        } else if (destination) map.setView([destination.latitude, destination.longitude], Math.max(map.getZoom(), 15));
    }, [destination, map]);
    return destination ? <Marker position={[destination.latitude, destination.longitude]} /> : null;
}

type PageProps = {
    selectOptions: {
        confirmationStatus: Record<string, string>;
    };
};

function getInitialPosition(): [number, number, number] {
    if (window.location.hash) {
        const match = window.location.hash.match(/^#(\d+(\.\d+)?)\/(-?\d+(\.\d+)?)\/(-?\d+(\.\d+)?)/);
        if (match) {
            const zoom = parseFloat(match[1]);
            const lat = parseFloat(match[3]);
            const lng = parseFloat(match[5]);
            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
                return [lat, lng, zoom];
            }
        }
    }
    return [52.3667136, 4.9808665, 8];
}

export default function ParkingMap() {
    const { t } = useTranslation('frontend/map/main');
    const { t: tGlobal } = useTranslation('frontend/global');
    const initial = getInitialPosition();
    const position: LatLngTuple = [initial[0], initial[1]];
    const initialZoom = initial[2];

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const { selectOptions } = usePage<PageProps>().props;

    const [modalOpen, setModalOpen] = useState(false);
    const [destination] = useState<DestinationResult | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const latitude = Number(params.get('lat'));
        const longitude = Number(params.get('lng'));
        const label = params.get('destination');
        const boundsValues = ['south', 'north', 'west', 'east'].map((key) => (params.has(key) ? Number(params.get(key)) : NaN));
        const [south, north, west, east] = boundsValues;
        const bounds =
            boundsValues.every(Number.isFinite) && south >= -90 && north <= 90 && south <= north && west >= -180 && east <= 180 && west <= east
                ? { south, north, west, east }
                : undefined;
        return label && Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { key: 'url:destination', label, sub: null, type: 'destination', latitude, longitude, bounds }
            : null;
    });

    const [viewportResults, setViewportResults] = useState<ParkingResult[]>([]);

    const [status, setStatus] = useState<DiscoveryStatus>('loading');
    const [retry, setRetry] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [selectedResult, setSelectedResult] = useState<ParkingResult | null>(null);
    const [expanded, setExpanded] = useState(true);
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const returnFocus = useRef<HTMLElement | null>(null);
    const resultsHeading = useRef<HTMLHeadingElement>(null);

    const restoreFocus = useCallback(
        (event: Event) => {
            event.preventDefault();
            const resultButton = selectedResult ? document.getElementById(`parking-result-${selectedResult.key}`) : null;
            const target = returnFocus.current?.isConnected ? returnFocus.current : (resultButton ?? resultsHeading.current);
            target?.focus({ preventScroll: true });
        },
        [selectedResult],
    );

    const selectParkingResult = useCallback((marker: ParkingResult) => {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSelectedResult(marker);
        setModalOpen(true);
    }, []);

    return (
        <MapLayout>
            <Head title={t('head.title')} />
            <main className="relative flex min-h-0 flex-1 flex-col">
                {destination && (
                    <Collapsible
                        open={expanded}
                        onOpenChange={setExpanded}
                        className="absolute bottom-3 left-1/2 z-10 flex max-h-[55%] w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 flex-col rounded-xl border bg-background shadow-lg data-[state=closed]:w-auto"
                    >
                        <div className="flex items-center justify-between gap-2 p-2">
                            <h1 ref={resultsHeading} tabIndex={-1} className={expanded ? 'px-2 font-semibold' : 'sr-only'}>
                                {t('results.title')}
                            </h1>
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className={expanded ? 'min-h-11' : 'min-h-11 w-full'}>
                                    {expanded ? t('results.collapse') : t('results.expand')}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        {expanded && destination && <p className="px-4 pb-2 text-sm text-muted-foreground">{destination.label}</p>}
                        <CollapsibleContent forceMount className="min-h-0 overflow-y-auto data-[state=closed]:hidden">
                            <ParkingResults
                                page={page}
                                hasMore={hasMore}
                                onPageChange={setPage}
                                results={viewportResults}
                                selectedKey={selectedResult?.key ?? null}
                                status={status}
                                onSelect={selectParkingResult}
                                onRetry={() => setRetry((value) => value + 1)}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                )}
                <section aria-label={t('results.map')} className="relative min-h-0 flex-1">
                    <MapContainer center={position} zoom={initialZoom} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                        <HashSync />
                        <DestinationFocus destination={destination} />
                        {/* The result list keeps its own paged viewport query; map markers are clustered in the browser. */}
                        {destination && (
                            <ViewportDiscovery
                                origin={destination}
                                onResults={setViewportResults}
                                onStatus={setStatus}
                                retry={retry}
                                page={page}
                                onPageChange={setPage}
                                onHasMore={setHasMore}
                            />
                        )}
                        <SelectedParking result={selectedResult} />
                        <ClearSelectionOnMapClick onClear={() => setSelectedResult(null)} />
                        <LayersControl position="topright">
                            <BaseLayer checked name={tGlobal('layers.mapbox')}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                    url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                    maxZoom={22}
                                    keepBuffer={4}
                                />
                            </BaseLayer>

                            <BaseLayer name={tGlobal('layers.google')}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                    url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                    maxZoom={20}
                                    keepBuffer={4}
                                />
                            </BaseLayer>
                        </LayersControl>

                        <ParkingMapLayer onSelect={selectParkingResult} selectedKey={selectedResult?.key ?? null} />

                        <LegendControl />
                        <LocateControl />
                        <ZoomControl
                            position={isDesktop ? 'bottomright' : 'topright'}
                            focus={selectedResult ? [selectedResult.latitude, selectedResult.longitude] : null}
                        />
                    </MapContainer>
                </section>
            </main>

            <ParkingDetail
                result={selectedResult}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCloseAutoFocus={restoreFocus}
                confirmationStatusOptions={selectOptions.confirmationStatus}
            />
        </MapLayout>
    );
}
