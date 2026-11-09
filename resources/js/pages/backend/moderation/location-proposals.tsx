import DetailsStep from '@/components/contribute/details-step';
import type { ContributionForm, OrientationOption } from '@/components/contribute/types';
import InputError from '@/components/input-error';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { RestrictionDay } from '@/types';
import { Link, router } from '@inertiajs/react';
import { ArrowRight, Camera, Check, CircleCheck, MapPinned, MousePointer2, RotateCcw, Trash2, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    addBay,
    bayNumber,
    browserStorage,
    canCheck,
    emptyDetails,
    emptyDraft,
    loadDraft,
    moveBay,
    publicationPayload,
    removeBay,
    saveDraft,
    setDetail,
    type BayDetails,
    type ProposalDraft,
    type PublishedBay,
} from './location-proposal-draft';
import type { BayMarker, MapPoint } from './moderation-map';
import type { EnumOption } from './values';
import { PanelNav, Workspace } from './workspace';

export type NearbyPlace = MapPoint & {
    id: string;
    street: string | null;
    distance_metres: number;
    possible_duplicate: boolean;
};

export type ProposalOverlap = MapPoint & { source: 'municipal' | 'community'; id: string; street: string | null; distance_metres: number };

/** A closed proposal's decision, for its panel: why it was closed and the parking space it duplicates. */
export type ClosedDecision = {
    reason: string | null;
    reasonLabel: string | null;
    decidedAt: string;
    moderator: string | null;
    existing: { source: 'municipal' | 'community'; street: string | null; distance_metres: number | null; url: string | null } | null;
};

/** The colours of existing parking on the moderation map, in lists too. */
export const EXISTING_COLOR = { community: '#16a34a', municipal: '#7c3aed' } as const;

/** Which existing parking space is how far away, as one line with the colour it has on the map. */
export function ExistingLine({ source, distance }: { source: 'municipal' | 'community'; distance: number | null }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: EXISTING_COLOR[source] }} aria-hidden />
            <span className="truncate">
                {distance === null ? t(`proposals.${source}`) : t('proposals.overlap_at', { place: t(`proposals.${source}`), distance })}
            </span>
        </span>
    );
}

export type LocationProposal = {
    id: number;
    source: string;
    street: string;
    municipality: string;
    status: 'open' | 'added';
    points: (MapPoint & { id: number; last_seen: string | null; overlap?: ProposalOverlap })[];
};

export type ProposalRow = {
    id: number;
    revision: number;
    municipality: string;
    status: 'open' | 'added';
    points: (MapPoint & {
        id: number;
        proposal_id: number;
        source: string;
        source_last_seen_on: string | null;
        overlap?: ProposalOverlap;
        candidates?: ProposalOverlap[];
    })[];
};

export function toLocationProposal(row: ProposalRow): LocationProposal {
    return {
        id: row.id,
        street: `${row.municipality} · #${row.id}`,
        municipality: row.municipality,
        source: row.points[0]?.source ?? '',
        status: row.status,
        points: row.points.map((point) => ({ ...point, last_seen: point.source_last_seen_on })),
    };
}

export type LocationProposalSelection = { proposal: LocationProposal; point: LocationProposal['points'][number] };

/** How close the map comes when the moderator zooms in on one bay. */
const BAY_ZOOM = 21;
/** The colour of proposal points, on the map and in the queue. */
export const SOURCE_COLOR = '#1e3a8a';

/**
 * Location proposals as their own group above the queue: one row per proposal point, like any other item. The status
 * comes from the work saved in this browser.
 */
export function LocationProposals({
    proposals,
    onOpen,
    total,
    title,
    action,
}: {
    proposals: LocationProposal[];
    onOpen: (selection: LocationProposalSelection) => void;
    total?: number;
    title?: string;
    action?: React.ReactNode;
}) {
    const { t } = useTranslation('backend/moderation');
    const storage = browserStorage();
    const points = proposals.flatMap((proposal) => proposal.points.map((point, index) => ({ proposal, point, index })));

    return (
        <>
            <div className="flex items-center justify-between gap-3 px-4.5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">
                <span>{title ?? t('proposals.title')}</span>
                {/* The count stands apart from the title, as in the other queue groups, so it never reads as part of it. */}
                <span className="tabular-nums">{total ?? proposals.length}</span>
            </div>
            {action && <div className="px-4.5 pb-2.5">{action}</div>}
            <ul className="flex flex-col">
                {points.map(({ proposal, point, index }) => (
                    <li key={point.id} className="border-t border-muted">
                        <button
                            type="button"
                            onClick={() => onOpen({ proposal, point })}
                            className="flex w-full cursor-pointer items-center gap-3 border-l-[3px] border-transparent py-2.5 pr-4 pl-[15px] text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                            <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                                style={{ background: `color-mix(in srgb, ${SOURCE_COLOR} 12%, transparent)`, color: SOURCE_COLOR }}
                                aria-hidden
                            >
                                <MapPinned className="size-[18px]" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-px">
                                <span className="truncate text-[15px] font-medium">{proposal.street}</span>
                                <span className="truncate text-[13px] text-muted-foreground">
                                    {point.overlap ? (
                                        <ExistingLine source={point.overlap.source} distance={point.overlap.distance_metres} />
                                    ) : (
                                        <StatusText draft={loadDraft(storage, proposal.id)} proposal={proposal} />
                                    )}
                                </span>
                            </span>
                            {proposal.points.length > 1 && (
                                <span className="shrink-0 text-[13px] text-muted-foreground">
                                    {t('proposals.point_numbered', { number: index + 1 })}
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
}

function StatusText({ draft, proposal }: { draft: ProposalDraft | null; proposal: LocationProposal }) {
    const { t } = useTranslation('backend/moderation');

    if (proposal.status === 'added') return t('proposals.added');
    if (draft?.bays.length) return t('proposals.status.draft', { count: draft.bays.length });

    return proposal.source;
}

export function LocationProposalReview({
    selection,
    imagery,
    options,
    publishedBays,
    revision,
    canReject,
    canAddStandalone,
    community,
    municipal,
    decision,
    query,
    onBack,
    onPointChange,
    nextUrl,
}: {
    selection: LocationProposalSelection;
    imagery: AerialLayer[];
    options: {
        orientations: OrientationOption[];
        restrictionDays: RestrictionDay[];
        maxBays: number;
        rejectionReasons: EnumOption[];
    };
    publishedBays: PublishedBay[];
    revision: number;
    canReject: boolean;
    canAddStandalone: boolean;
    community: NearbyPlace[];
    municipal: NearbyPlace[];
    decision?: ClosedDecision | null;
    query: { municipality?: string | number; page?: number; point?: number; from?: 'queue' };
    onBack: () => void;
    onPointChange: (id: number) => void;
    nextUrl?: string;
}) {
    const { t, i18n } = useTranslation('backend/moderation');
    const { proposal, point } = selection;
    const published = proposal.status === 'added';
    const storage = browserStorage();
    const [draft, setDraft] = useState<ProposalDraft>(() => loadDraft(storage, proposal.id) ?? emptyDraft());
    const [selected, setSelected] = useState<string | null>(null);
    const [chosenStep, setStep] = useState<Step>('place');
    const [view, setView] = useState<{ center: MapPoint; zoom?: number }>({ center: point });
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [existing, setExisting] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const [standalone, setStandalone] = useState<{
        id: string;
        pin: MapPoint | null;
        details: BayDetails;
        confirmed: boolean;
        error?: string;
    } | null>(null);

    const moveStandalone = (pin: MapPoint) => {
        setStandalone((current) => current && { ...current, pin, confirmed: false, error: undefined });
    };
    const standaloneStreet = standalone?.pin && streetViewUrl(standalone.pin.latitude, standalone.pin.longitude);
    const canSaveStandalone = !!standalone?.pin && standalone.confirmed && !!standalone.details.orientation && !!standalone.details.under_sign;

    const saveStandalone = () => {
        if (!standalone || !canSaveStandalone || processing) return;
        setProcessing(true);
        router.post(
            app.moderation.proposals.standaloneSpace.url(proposal.id, { query }),
            { ...standalone.details, ...standalone.pin, submission_id: standalone.id, street_view_confirmed: standalone.confirmed },
            {
                preserveState: true,
                onSuccess: () => setStandalone(null),
                onError: (errors) => setStandalone((current) => current && { ...current, error: Object.values(errors)[0] }),
                onFinish: () => setProcessing(false),
            },
        );
    };

    useEffect(() => saveDraft(storage, proposal.id, published ? emptyDraft() : draft), [storage, proposal.id, draft, published]);

    const submittedCount = publishedBays.length;
    const bays = published ? [] : draft.bays;
    // Without bays in progress there is nothing to describe or check, whatever step was open.
    const step: Step = bays.length === 0 ? 'place' : chosenStep;
    const selectedBay = draft.bays.find((bay) => bay.id === selected) ?? null;
    const seen = point.last_seen ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(point.last_seen)) : null;
    const orientation = options.orientations.find((option) => option.value === draft.details.orientation)?.label;
    const underSign =
        draft.details.under_sign === 'yes'
            ? draft.details.under_sign_text || t('proposals.summary.under_sign_yes')
            : t('proposals.summary.under_sign_no');
    const pickingDuplicate = rejecting && reason === 'duplicate';
    const reviewingLater = rejecting && reason === 'later';
    const duplicatePlaces = [
        ...community.map((place) => ({ ...place, source: 'community' as const, key: `community:${place.id}`, color: EXISTING_COLOR.community })),
        ...municipal.map((place) => ({ ...place, source: 'municipal' as const, key: `municipal:${place.id}`, color: EXISTING_COLOR.municipal })),
    ].sort((a, b) => a.distance_metres - b.distance_metres);
    const reopenable = published && canReject && !!decision;
    const duplicatePlace = duplicatePlaces.find((place) => place.key === existing);
    const lastPublishedNumber = Math.max(0, ...publishedBays.map((bay) => bay.number));

    const markers: BayMarker[] = [
        ...publishedBays.map((bay) => ({
            key: `submitted-${bay.number}`,
            point: bay,
            number: bay.number,
            state: 'submitted' as const,
            label: t('proposals.bay_submitted_label', { number: bay.number }),
        })),
        ...bays.map((bay) => {
            const number = lastPublishedNumber + bayNumber(draft, bay.id);
            return {
                key: bay.id,
                point: bay,
                number,
                state: bay.id === selected ? ('selected' as const) : ('placed' as const),
                label: t('proposals.bay_label', { number }),
            };
        }),
    ];

    const place = (position: MapPoint) => {
        if (published || processing || bays.length >= options.maxBays) return;
        const id = crypto.randomUUID();
        setDraft((current) => addBay(current, position, id, point.id));
        setSelected(id);
    };

    const remove = (id: string) => {
        setDraft((current) => removeBay(current, id));
        if (selected === id) setSelected(null);
    };

    const zoomTo = (point: MapPoint, id: string) => {
        setView({ center: { latitude: point.latitude, longitude: point.longitude }, zoom: BAY_ZOOM });
        setSelected(id);
    };

    const submit = () => {
        if (published || processing || !canCheck(draft)) return;
        setFailure(null);
        setProcessing(true);
        router.post(
            app.moderation.proposals.publish.url(proposal.id, { query }),
            { ...publicationPayload(draft), revision },
            {
                preserveScroll: true,
                onError: (errors) => setFailure(Object.values(errors)[0] ?? null),
                onSuccess: () => {
                    setDraft(emptyDraft());
                    setSelected(null);
                    setStep('place');
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    const reject = () => {
        if (processing || reviewingLater || !reason || (pickingDuplicate && !duplicatePlace)) return;
        setFailure(null);
        setProcessing(true);
        router.post(
            app.moderation.proposals.reject.url(proposal.id, { query }),
            {
                revision,
                reason,
                note,
                existing_parking_space_id: pickingDuplicate && duplicatePlace?.source === 'community' ? duplicatePlace.id : null,
                existing_parking_municipal_id: pickingDuplicate && duplicatePlace?.source === 'municipal' ? duplicatePlace.id : null,
            },
            {
                onError: (errors) => setFailure(Object.values(errors)[0] ?? null),
                onSuccess: () => saveDraft(storage, proposal.id, emptyDraft()),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const reopen = () => {
        if (processing) return;
        setProcessing(true);
        router.post(
            app.moderation.proposals.reopen.url(proposal.id, { query }),
            { revision },
            { onError: (errors) => setFailure(Object.values(errors)[0] ?? null), onFinish: () => setProcessing(false) },
        );
    };

    const decisionFields = () => (
        <fieldset className="flex flex-col gap-4" disabled={processing}>
            <legend id="proposal-reason-label" className="mb-2 text-[15px] font-semibold">
                {t('proposals.review_question')}
            </legend>
            <RadioGroup aria-labelledby="proposal-reason-label" className="grid gap-2" value={reason} onChange={setReason} disabled={processing}>
                {options.rejectionReasons
                    .filter((option) => option.value !== 'duplicate' || duplicatePlaces.length > 0)
                    .map((option) => (
                        <RadioGroupItem key={option.value} value={option.value}>
                            {option.label}
                        </RadioGroupItem>
                    ))}
                <RadioGroupItem value="later">{t('proposals.unclear')}</RadioGroupItem>
            </RadioGroup>
            {pickingDuplicate && (
                <div className="grid gap-2">
                    <p id="proposal-duplicate-label" className="text-sm font-medium">
                        {t('proposals.pick_duplicate')}
                    </p>
                    <RadioGroup
                        aria-labelledby="proposal-duplicate-label"
                        className="grid gap-2"
                        value={existing}
                        onChange={setExisting}
                        disabled={processing}
                    >
                        {duplicatePlaces.map((place) => (
                            <RadioGroupItem key={place.key} value={place.key}>
                                <span className="grid gap-0.5">
                                    <span className="font-medium">{duplicateLabel(place)}</span>
                                    <span className="text-muted-foreground">{t(`proposals.${place.source}`)}</span>
                                </span>
                            </RadioGroupItem>
                        ))}
                    </RadioGroup>
                </div>
            )}
            {reviewingLater ? (
                <p className="text-sm text-muted-foreground">{t('proposals.later_hint')}</p>
            ) : reason ? (
                <div className="grid gap-2">
                    <Label htmlFor="proposal-decision-note">{t('proposals.decision_note')}</Label>
                    <Textarea id="proposal-decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                </div>
            ) : null}
        </fieldset>
    );

    const duplicateLabel = (place: NearbyPlace) =>
        t('proposals.duplicate_location', {
            street: place.street || t('proposals.unknown_street'),
            distance: place.distance_metres,
        });

    const detailsForm: ContributionForm = { ...draft.details, latitude: null, longitude: null };
    const bayList = (checking: boolean) => (
        <ul className="divide-y overflow-hidden rounded-xl border">
            {publishedBays.map((bay) => (
                <li key={`submitted-${bay.number}`} className="flex items-center gap-3 px-3 py-2">
                    <PinBadge number={bay.number} state="submitted" />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{t('proposals.bay', { number: bay.number })}</span>
                        <span className="text-[13px] text-muted-foreground">{t('proposals.added')}</span>
                    </span>
                </li>
            ))}
            {bays.map((bay) => {
                const number = lastPublishedNumber + bayNumber(draft, bay.id);
                const isSelected = bay.id === selected;
                // Street View sits with the bay being placed; while checking, every bay gets it to walk them all.
                const street = checking || isSelected ? streetViewUrl(bay.latitude, bay.longitude) : null;
                const iconColor = isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-stone-600 dark:text-muted-foreground';
                const streetViewButton = street && (
                    <Button variant="ghost" size="icon" className={cn('size-10', iconColor)} asChild>
                        <a href={street} target="_blank" rel="noreferrer" aria-label={t('proposals.street_view', { number })}>
                            <Camera className="size-4" aria-hidden />
                        </a>
                    </Button>
                );

                return (
                    <li
                        key={bay.id}
                        aria-current={isSelected || undefined}
                        className={cn('flex items-center gap-1 py-1 pr-1.5 pl-3', isSelected && 'bg-blue-50 dark:bg-blue-950/50')}
                    >
                        <button
                            type="button"
                            onClick={() => setSelected(bay.id)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md py-1.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
                        >
                            <PinBadge number={number} state={isSelected ? 'selected' : 'placed'} />
                            <span className="text-sm font-semibold">{t('proposals.bay', { number })}</span>
                        </button>
                        {!checking && streetViewButton}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn('size-10', iconColor)}
                            aria-label={t('proposals.zoom', { number })}
                            onClick={() => zoomTo(bay, bay.id)}
                        >
                            <ZoomIn className="size-4" aria-hidden />
                        </Button>
                        {checking ? (
                            streetViewButton
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn('size-10', iconColor)}
                                aria-label={t('proposals.remove', { number })}
                                disabled={processing}
                                onClick={() => remove(bay.id)}
                            >
                                <Trash2 className="size-4" aria-hidden />
                            </Button>
                        )}
                    </li>
                );
            })}
            {!checking && !published && (
                <li className="flex items-center gap-3 px-3 py-3 text-[13px] text-muted-foreground">
                    <MousePointer2 className="size-4 shrink-0" aria-hidden />
                    {t('proposals.next_hint', { number: lastPublishedNumber + bays.length + 1 })}
                </li>
            )}
        </ul>
    );

    return (
        <Workspace
            scope="item"
            label={proposal.municipality}
            imageryLayers={imagery}
            streetView={standalone ? standalone.pin : (selectedBay ?? point)}
            mapHint={
                standalone
                    ? t('proposals.standalone.place')
                    : !published && !rejecting && step === 'place' && bays.length === 0 && submittedCount === 0
                      ? t('proposals.map_hint')
                      : undefined
            }
            map={{
                center: view.center,
                zoom: view.zoom ?? 19,
                sourcePoint: point,
                proposed: standalone ? (standalone.pin ?? point) : undefined,
                onMove: standalone && !processing ? moveStandalone : undefined,
                nearby: pickingDuplicate ? [] : community,
                municipal: pickingDuplicate ? [] : municipal,
                bays: pickingDuplicate || standalone ? undefined : markers,
                queue: pickingDuplicate
                    ? duplicatePlaces.map((place) => ({
                          key: place.key,
                          point: place,
                          color: place.color,
                          label: duplicateLabel(place),
                      }))
                    : undefined,
                fitQueue: false,
                highlighted: pickingDuplicate ? (existing ?? undefined) : undefined,
                inspectedPin: pickingDuplicate && duplicatePlace ? duplicatePlace : undefined,
                onPick: pickingDuplicate ? setExisting : undefined,
                onPlace: !standalone && !published && !rejecting && step === 'place' && !processing ? place : undefined,
                onMoveBay: published || rejecting || processing ? undefined : (id, point) => setDraft((current) => moveBay(current, id, point)),
                onRemoveBay: published || rejecting || processing || step === 'details' ? undefined : remove,
                onSelectBay: setSelected,
            }}
        >
            {standalone ? (
                <>
                    <PanelNav back={t('proposals.title')} onBack={() => !processing && setStandalone(null)} />
                    <section aria-labelledby="standalone-title" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                        <h2 id="standalone-title" className="text-lg font-bold">
                            {t('proposals.standalone.title')}
                        </h2>
                        <p className="text-sm text-muted-foreground">{t('proposals.standalone.place')}</p>
                        {standaloneStreet && (
                            <>
                                <a href={standaloneStreet} target="_blank" rel="noreferrer" className="w-fit text-sm font-medium underline">
                                    {t('review.views.street_view')}
                                </a>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={standalone.confirmed}
                                        disabled={processing}
                                        onCheckedChange={(checked) =>
                                            setStandalone((current) => current && { ...current, confirmed: checked === true })
                                        }
                                    />
                                    {t('proposals.standalone.confirm')}
                                </label>
                            </>
                        )}
                        <fieldset disabled={processing}>
                            <DetailsStep
                                data={{
                                    ...standalone.details,
                                    latitude: standalone.pin?.latitude ?? null,
                                    longitude: standalone.pin?.longitude ?? null,
                                }}
                                setData={(key, value) => {
                                    if (key === 'latitude' || key === 'longitude') return;
                                    setStandalone((current) => current && { ...current, details: { ...current.details, [key]: value } });
                                }}
                                errors={{}}
                                orientationOptions={options.orientations}
                                restrictionDays={options.restrictionDays}
                            />
                        </fieldset>
                        {standalone.error && (
                            <div role="alert">
                                <InputError message={standalone.error} />
                            </div>
                        )}
                    </section>
                    <div className="flex shrink-0 gap-2 border-t px-5 py-4">
                        <Button type="button" className="flex-1" disabled={!canSaveStandalone || processing} onClick={saveStandalone}>
                            {processing ? t('proposals.submitting') : t('proposals.standalone.save')}
                        </Button>
                        <Button type="button" variant="outline" disabled={processing} onClick={() => setStandalone(null)}>
                            {t('proposals.cancel')}
                        </Button>
                    </div>
                </>
            ) : (
                <PanelNav back={t('queue.label')} onBack={onBack} />
            )}
            <div hidden={!!standalone} className={cn('min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4', !standalone && 'flex')}>
                <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
                        {t('proposals.eyebrow', { source: proposal.source })}
                    </span>
                    <h2 className="text-2xl leading-tight font-bold tracking-tight">{proposal.municipality}</h2>
                    {seen && <span className="text-sm text-muted-foreground">{t('proposals.seen', { date: seen })}</span>}
                    {proposal.points.length > 1 && !published && !rejecting && (
                        <select
                            aria-label={t('proposals.source_point')}
                            className="mt-2 rounded-md border bg-background p-2 text-sm"
                            value={point.id}
                            onChange={(event) => onPointChange(Number(event.target.value))}
                        >
                            {proposal.points.map((item, index) => (
                                <option key={item.id} value={item.id}>
                                    {t('proposals.point_numbered', { number: index + 1 })}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div role="status" className="flex flex-col gap-0.5 rounded-xl border p-3">
                    <span className="text-xs text-muted-foreground">{t('proposals.progress')}</span>
                    <span className="font-semibold">
                        {published && canReject
                            ? t('decisions.rejected')
                            : submittedCount > 0
                              ? t('proposals.added_count', { count: submittedCount })
                              : t('proposals.progress_none')}
                    </span>
                </div>

                {!published && !rejecting && canAddStandalone && (
                    <Button
                        type="button"
                        variant="outline"
                        className="self-start"
                        disabled={processing}
                        onClick={() => setStandalone({ id: crypto.randomUUID(), pin: null, details: emptyDetails(), confirmed: false })}
                    >
                        <MapPinned aria-hidden />
                        {t('proposals.standalone.title')}
                    </Button>
                )}
                {published && canReject && decision && <ClosedCard decision={decision} source={proposal.source} />}

                {!rejecting && bays.length > 0 && <StepBar step={step} canCheck={canCheck(draft)} onStep={setStep} />}

                {rejecting ? null : step === 'check' ? (
                    <>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold">{t('proposals.check_title', { count: draft.bays.length })}</h3>
                            <p className="text-sm text-muted-foreground">{t('proposals.check_hint')}</p>
                        </div>
                        {bayList(true)}
                        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1.5 rounded-xl bg-muted p-3 text-sm">
                            <dt className="text-stone-600 dark:text-muted-foreground">{t('proposals.summary.orientation')}</dt>
                            <dd className="font-medium">{orientation}</dd>
                            <dt className="text-stone-600 dark:text-muted-foreground">{t('proposals.summary.under_sign')}</dt>
                            <dd className="font-medium">{underSign}</dd>
                        </dl>
                        {failure !== null && (
                            <div role="alert" className="flex flex-col gap-1">
                                <InputError message={failure} />
                            </div>
                        )}
                    </>
                ) : step === 'details' ? (
                    <section aria-labelledby="proposal-details" className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <h3 id="proposal-details" className="text-lg font-bold">
                                {t('proposals.details')}
                            </h3>
                            <p className="text-sm text-muted-foreground">{t('proposals.details_hint', { count: draft.bays.length })}</p>
                        </div>
                        <DetailsStep
                            data={detailsForm}
                            setData={(key, value) =>
                                key !== 'latitude' &&
                                key !== 'longitude' &&
                                setDraft((current) => setDetail(current, key as keyof BayDetails, value as never))
                            }
                            errors={{}}
                            orientationOptions={options.orientations}
                            restrictionDays={options.restrictionDays}
                        />
                    </section>
                ) : (
                    <>
                        <section aria-labelledby="proposal-bays" className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between">
                                <h3 id="proposal-bays" className="text-sm font-semibold">
                                    {t('proposals.bays')}
                                </h3>
                                {draft.bays.length > 0 && (
                                    <span className="text-[13px] text-muted-foreground">{t('proposals.placed', { count: draft.bays.length })}</span>
                                )}
                            </div>
                            {bays.length === 0 && submittedCount === 0 && !published ? (
                                <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed p-4">
                                    <MousePointer2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                    <span className="flex flex-col gap-0.5">
                                        <span className="font-semibold">{t('proposals.empty_title')}</span>
                                        <span className="text-[13px] text-muted-foreground">{t('proposals.empty_hint')}</span>
                                    </span>
                                </div>
                            ) : (
                                bayList(false)
                            )}
                        </section>
                    </>
                )}
                {rejecting && decisionFields()}
                {rejecting && <InputError message={failure ?? undefined} />}
            </div>
            <div hidden={!!standalone} className={cn('shrink-0 gap-2 border-t px-5 py-4', !standalone && 'flex')}>
                {rejecting ? (
                    <>
                        {reviewingLater ? (
                            nextUrl ? (
                                <Button asChild className="h-11 flex-[2]">
                                    <Link href={nextUrl}>{t('proposals.review_later')}</Link>
                                </Button>
                            ) : (
                                <Button type="button" className="h-11 flex-[2]" onClick={onBack}>
                                    {t('proposals.review_later')}
                                </Button>
                            )
                        ) : (
                            <Button
                                type="button"
                                variant={pickingDuplicate ? 'default' : 'destructive'}
                                className="h-11 flex-[2]"
                                disabled={processing || !reason || (pickingDuplicate && !duplicatePlace)}
                                onClick={reject}
                            >
                                {t(pickingDuplicate ? 'proposals.close_duplicate' : 'proposals.reject_title')}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            disabled={processing}
                            onClick={() => {
                                setRejecting(false);
                                setReason('');
                                setNote('');
                                setExisting(null);
                                setFailure(null);
                            }}
                        >
                            {t('proposals.cancel')}
                        </Button>
                    </>
                ) : step === 'check' ? (
                    <>
                        <Button type="button" className="h-11 flex-[2]" disabled={processing || draft.bays.length === 0} onClick={submit}>
                            {processing ? t('proposals.submitting') : t('proposals.publish', { count: draft.bays.length })}
                        </Button>
                        <Button type="button" variant="outline" className="h-11 flex-1" disabled={processing} onClick={() => setStep('details')}>
                            {t('proposals.back')}
                        </Button>
                    </>
                ) : step === 'details' ? (
                    <>
                        <Button
                            type="button"
                            className="h-11 flex-[2]"
                            disabled={!canCheck(draft)}
                            onClick={() => {
                                setFailure(null);
                                setStep('check');
                            }}
                        >
                            {t('proposals.check')}
                            <ArrowRight aria-hidden />
                        </Button>
                        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setStep('place')}>
                            {t('proposals.back')}
                        </Button>
                    </>
                ) : bays.length > 0 ? (
                    <Button type="button" className="h-11 flex-1" onClick={() => setStep('details')}>
                        {t('proposals.to_details')}
                        <ArrowRight aria-hidden />
                    </Button>
                ) : published ? (
                    <>
                        {reopenable && (
                            <Button type="button" variant="outline" className="h-11 flex-1" disabled={processing} onClick={reopen}>
                                <RotateCcw aria-hidden />
                                {t('proposals.reopen')}
                            </Button>
                        )}
                        {/* The way back is already at the top of the panel; the footer offers it only when nothing follows. */}
                        {nextUrl ? (
                            <Button className="h-11 flex-1" asChild>
                                <Link href={nextUrl}>
                                    {t('proposals.next_proposal')} <ArrowRight aria-hidden />
                                </Link>
                            </Button>
                        ) : (
                            <Button type="button" className="h-11 flex-1" onClick={onBack}>
                                {t('proposals.back_to_queue')}
                            </Button>
                        )}
                    </>
                ) : canReject ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1"
                        onClick={() => {
                            setReason('');
                            setNote('');
                            setFailure(null);
                            setRejecting(true);
                        }}
                    >
                        {t('proposals.review_proposal')}
                    </Button>
                ) : null}
            </div>
        </Workspace>
    );
}

/** Why a proposal without bays was closed; for a duplicate, the parking space already on the map. */
function ClosedCard({ decision, source }: { decision: ClosedDecision; source: string }) {
    const { t, i18n } = useTranslation('backend/moderation');
    const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(decision.decidedAt));
    const duplicate = decision.reason === 'duplicate';

    return (
        <section aria-labelledby="proposal-closed" className="overflow-hidden rounded-xl border">
            <div className="flex gap-2.5 bg-muted/60 p-3.5">
                <CircleCheck className="mt-0.5 size-[18px] shrink-0 text-green-700 dark:text-green-400" aria-hidden />
                <span className="flex flex-col gap-0.5">
                    <h3 id="proposal-closed" className="text-[15px] font-semibold">
                        {duplicate ? t('proposals.closed_duplicate') : t('proposals.closed_with', { reason: decision.reasonLabel })}
                    </h3>
                    {duplicate && <span className="text-[13px] text-muted-foreground">{t('proposals.closed_stays', { source })}</span>}
                </span>
            </div>
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] text-sm [&>*]:border-t [&>*]:px-3 [&>*]:py-2.5">
                {decision.existing && (
                    <>
                        <dt className="text-muted-foreground">{t('proposals.existing')}</dt>
                        <dd className="flex flex-col gap-0.5">
                            <ExistingLine source={decision.existing.source} distance={null} />
                            {decision.existing.url ? (
                                <a href={decision.existing.url} className="font-semibold underline underline-offset-4">
                                    {decision.existing.street ?? t('proposals.unknown_street')}
                                </a>
                            ) : (
                                <span className="font-semibold">{decision.existing.street ?? t('proposals.unknown_street')}</span>
                            )}
                        </dd>
                        {decision.existing.distance_metres !== null && (
                            <>
                                <dt className="text-muted-foreground">{t('proposals.distance')}</dt>
                                <dd className="tabular-nums">{t('proposals.distance_value', { distance: decision.existing.distance_metres })}</dd>
                            </>
                        )}
                    </>
                )}
                <dt className="text-muted-foreground">{t('proposals.closed')}</dt>
                <dd>{decision.moderator ? t('proposals.closed_by', { moderator: decision.moderator, date }) : date}</dd>
            </dl>
        </section>
    );
}

type Step = 'place' | 'details' | 'check';
const STEPS: Step[] = ['place', 'details', 'check'];

/** Where the moderator is: drawing in bays, describing the location, or checking before submitting. Earlier steps can be reopened. */
function StepBar({ step, canCheck, onStep }: { step: Step; canCheck: boolean; onStep: (step: Step) => void }) {
    const { t } = useTranslation('backend/moderation');
    const current = STEPS.indexOf(step);

    return (
        <ol aria-label={t('proposals.steps.label')} className="grid grid-cols-3 gap-1.5">
            {STEPS.map((option, index) => {
                const active = index === current;
                const done = index < current;
                const reachable = index < current || (index === current + 1 && (option !== 'check' || canCheck));

                return (
                    <li key={option}>
                        <button
                            type="button"
                            aria-current={active ? 'step' : undefined}
                            disabled={!active && !reachable}
                            onClick={() => onStep(option)}
                            className={cn(
                                'flex h-9 w-full items-center gap-2 rounded-[9px] px-2.5 text-[13px] focus-visible:outline-2 focus-visible:outline-ring',
                                active
                                    ? 'bg-foreground font-semibold text-background'
                                    : 'bg-muted font-medium text-stone-600 dark:text-muted-foreground',
                                !active && reachable && 'cursor-pointer hover:bg-muted/70',
                            )}
                        >
                            {done ? (
                                <Check className="size-4 shrink-0" aria-hidden />
                            ) : (
                                <span
                                    className={cn(
                                        'flex size-5 shrink-0 items-center justify-center rounded-full text-xs',
                                        active ? 'bg-background text-foreground' : 'border-[1.5px] border-stone-400',
                                    )}
                                    aria-hidden
                                >
                                    {index + 1}
                                </span>
                            )}
                            {t(`proposals.steps.${option}`)}
                            {done && <span className="sr-only">{t('proposals.steps.done')}</span>}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/** The bay pin as it looks on the map, small, so list and map read as one. */
function PinBadge({ number, state }: { number: number; state: 'placed' | 'selected' | 'submitted' }) {
    const [fill, stroke, text] = {
        placed: ['#fff', '#1d4ed8', '#1d4ed8'],
        selected: ['#1d4ed8', '#fff', '#fff'],
        submitted: ['#171717', '#fff', '#fff'],
    }[state];

    return (
        <svg viewBox="0 0 36 48" width="20" height="27" aria-hidden className="shrink-0">
            <path
                d="M18 46C18 46 3 29.5 3 18a15 15 0 0 1 30 0c0 11.5-15 28-15 28z"
                fill={fill}
                stroke={stroke}
                strokeWidth={state === 'placed' ? 3.2 : 2}
            />
            <text x="18" y="24" textAnchor="middle" fontSize="17" fontWeight="700" fill={text}>
                {number}
            </text>
        </svg>
    );
}
