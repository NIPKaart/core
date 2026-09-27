import DestinationSearch from '@/components/map/destination-search';
import DiscoveryFilters from '@/components/map/discovery-filters';
import LocateControl from '@/components/map/locate-control';
import MapDisplayControls, { type MapStyle } from '@/components/map/map-display-controls';
import NearbyDiscovery from '@/components/map/nearby-discovery';
import ParkingMapLayer from '@/components/map/parking-map-layer';
import { type DiscoveryStatus } from '@/components/map/parking-results';
import ZoomControl from '@/components/map/zoom-control';
import { useSearchOpen } from '@/components/search/search-store';
import { Button } from '@/components/ui/button';
import { destinationIcon } from '@/lib/destination-icon';
import {
    discoveryDestinationUrl,
    discoveryFilterUrl,
    isApproximateDestination,
    readDiscoveryFilters,
    type DiscoveryFilters as Filters,
} from '@/lib/discovery-filters';
import type { DestinationResult, ParkingResult } from '@/types/destination';
import { Head, usePage } from '@inertiajs/react';
import type { LatLngTuple } from 'leaflet';
import { MapContainer, Marker, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { HashSync } from '@/components/map/hash-sync';
import ParkingDetail from '@/components/map/parking-detail/parking-detail';
import MapLayout from '@/layouts/map-layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
                paddingTopLeft: [40, window.matchMedia('(max-width: 767px)').matches ? 160 : 100],
                paddingBottomRight: [40, window.matchMedia('(max-width: 767px)').matches ? map.getSize().y * 0.55 + 40 : 40],
            });
    }, [map, result]);
    return null;
}

function DestinationFocus({ destination }: { destination: DestinationResult | null }) {
    const map = useMap();
    const { t } = useTranslation('frontend/map/main');
    const approximate = destination ? isApproximateDestination(destination) : true;
    const label = t(approximate ? 'toolbar.search_area' : 'toolbar.destination', { name: destination?.label ?? '' });
    const icon = useMemo(() => destinationIcon(label, approximate), [label, approximate]);
    const previous = useRef<DestinationResult | null>(destination);
    const initialized = useRef(false);
    useEffect(() => {
        const first = !initialized.current;
        initialized.current = true;
        const changed = previous.current !== destination;
        previous.current = destination;
        if (!first && !changed) return;
        if (first && /^#\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?$/.test(window.location.hash)) return;
        if (destination?.bounds) {
            map.fitBounds(
                [
                    [destination.bounds.south, destination.bounds.west],
                    [destination.bounds.north, destination.bounds.east],
                ],
                {
                    maxZoom: 17,
                    paddingTopLeft: [40, window.matchMedia('(max-width: 767px)').matches ? 160 : 100],
                    paddingBottomRight: [40, 40],
                    animate: false,
                },
            );
        } else if (destination) map.setView([destination.latitude, destination.longitude], Math.max(map.getZoom(), 15));
    }, [destination, map]);
    return destination ? (
        <Marker
            position={[destination.latitude, destination.longitude]}
            icon={icon}
            title={label}
            keyboard={false}
            interactive={false}
            zIndexOffset={500}
        />
    ) : null;
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
    const initial = getInitialPosition();
    const position: LatLngTuple = [initial[0], initial[1]];
    const initialZoom = initial[2];

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const { selectOptions } = usePage<PageProps>().props;

    const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
    const [modalOpen, setModalOpen] = useState(false);
    const searchOpen = useSearchOpen();
    const [destination, setDestination] = useState<DestinationResult | null>(() => {
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
        return label &&
            params.has('lat') &&
            params.has('lng') &&
            Number.isFinite(latitude) &&
            Math.abs(latitude) <= 90 &&
            Number.isFinite(longitude) &&
            Math.abs(longitude) <= 180
            ? { key: 'url:destination', label, sub: null, type: params.get('destination_type') ?? 'destination', latitude, longitude, bounds }
            : null;
    });

    const [filters, setFilters] = useState(() => readDiscoveryFilters(new URLSearchParams(window.location.search)));

    const [viewportResults, setViewportResults] = useState<ParkingResult[]>([]);

    const [status, setStatus] = useState<DiscoveryStatus>('loading');
    const [retry, setRetry] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [selectedResult, setSelectedResult] = useState<ParkingResult | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const resultsHeading = useRef<HTMLHeadingElement>(null);

    const changeFilters = (value: Filters) => {
        setFilters(value);
        setPage(1);
        setSelectedResult(null);
        setModalOpen(false);
        setViewportResults([]);
        setStatus('loading');
        window.history.replaceState(window.history.state, '', discoveryFilterUrl(new URL(window.location.href), value));
    };

    const changePage = (next: number) => {
        setPage(next);
        setSelectedResult(null);
        setViewportResults([]);
        setStatus('loading');
    };

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
        <MapLayout showSearch={false} mapSearch>
            <Head title={t('head.title')} />
            <main className="map-discovery relative flex min-h-0 flex-1 flex-col" data-search-open={searchOpen}>
                <h1 className="sr-only" ref={resultsHeading} tabIndex={-1}>
                    {t('results.title')}
                </h1>
                <div
                    className={`pointer-events-none absolute z-20 flex items-start justify-between gap-3 lg:inset-x-5 lg:top-5 ${searchOpen ? 'inset-x-0 top-0' : 'inset-x-3 top-3'}`}
                >
                    <div className={`pointer-events-none w-full items-start gap-3 lg:flex lg:w-auto ${searchOpen ? 'flex' : 'hidden'}`}>
                        <DestinationSearch
                            destination={destination}
                            onSelect={(value) => {
                                const next = { ...value, label: value.type === 'street' && value.sub ? `${value.label}, ${value.sub}` : value.label };
                                window.history.replaceState(window.history.state, '', discoveryDestinationUrl(new URL(window.location.href), next));
                                setDestination(next);
                                setPage(1);
                                setSelectedResult(null);
                                setModalOpen(false);
                                setViewportResults([]);
                                setStatus('loading');
                            }}
                        />
                        <div className="pointer-events-auto hidden lg:block">
                            <DiscoveryFilters value={filters} onChange={changeFilters} disabled={!destination} />
                        </div>
                    </div>
                    <div className={`pointer-events-auto lg:hidden ${searchOpen ? 'hidden' : ''}`}>
                        <DiscoveryFilters value={filters} onChange={changeFilters} disabled={!destination} />
                    </div>
                    <div className={`shrink-0 lg:block ${searchOpen ? 'hidden' : ''}`}>
                        <MapDisplayControls value={mapStyle} onChange={setMapStyle} />
                    </div>
                </div>
                {!searchOpen && destination && (status !== 'ready' || hasMore || page > 1 || viewportResults.length === 0) && (
                    <div
                        className="absolute top-16 right-20 left-3 z-20 flex max-w-3xl flex-wrap items-center justify-center gap-3 rounded-xl border bg-background px-3 py-2 text-sm shadow-sm lg:inset-x-5 lg:top-20"
                        role="status"
                    >
                        {status === 'loading' ? (
                            t('results.loading')
                        ) : status === 'error' ? (
                            <Button variant="ghost" onClick={() => setRetry((value) => value + 1)}>
                                {t('results.retry')}
                            </Button>
                        ) : (
                            <>
                                <span>{t(viewportResults.length === 0 ? 'toolbar.no_results' : 'results.page', { page })}</span>
                                {(page > 1 || hasMore) && (
                                    <>
                                        <Button variant="ghost" disabled={page === 1} onClick={() => changePage(page - 1)}>
                                            {t('results.previous')}
                                        </Button>
                                        <Button variant="ghost" disabled={!hasMore} onClick={() => changePage(page + 1)}>
                                            {t('results.next')}
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
                <div className="relative min-h-0 flex-1">
                    <section aria-label={t('results.map')} className="parking-discovery-map absolute inset-0">
                        <MapContainer center={position} zoom={initialZoom} scrollWheelZoom zoomControl={false} className="z-0 h-full w-full">
                            <HashSync />
                            <DestinationFocus destination={destination} />
                            {destination && (
                                <NearbyDiscovery
                                    origin={destination}
                                    filters={filters}
                                    onResults={setViewportResults}
                                    onStatus={setStatus}
                                    retry={retry}
                                    page={page}
                                    onHasMore={setHasMore}
                                />
                            )}
                            <SelectedParking result={modalOpen ? selectedResult : null} />
                            <ClearSelectionOnMapClick onClear={() => setSelectedResult(null)} />
                            {mapStyle === 'streets' ? (
                                <TileLayer
                                    key="streets"
                                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                                    url={`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`}
                                    maxZoom={22}
                                    keepBuffer={4}
                                />
                            ) : (
                                <TileLayer
                                    key="satellite"
                                    attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                    url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                    maxZoom={20}
                                    keepBuffer={4}
                                />
                            )}

                            <ParkingMapLayer
                                results={destination ? viewportResults : null}
                                onSelect={selectParkingResult}
                                selectedKey={selectedResult?.key ?? null}
                            />

                            <ScaleControl position="bottomleft" imperial={false} />
                            <ZoomControl position="bottomright" focus={selectedResult ? [selectedResult.latitude, selectedResult.longitude] : null} />
                            <LocateControl position="bottomright" />
                        </MapContainer>
                    </section>
                </div>
            </main>

            <ParkingDetail
                result={selectedResult}
                approximateDestination={destination ? isApproximateDestination(destination) : false}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCloseAutoFocus={restoreFocus}
                confirmationStatusOptions={selectOptions.confirmationStatus}
            />
        </MapLayout>
    );
}
