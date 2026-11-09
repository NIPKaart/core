import DetailsStep from '@/components/contribute/details-step';
import type { ContributionForm, OrientationOption } from '@/components/contribute/types';
import InputError from '@/components/input-error';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { RestrictionDay } from '@/types';
import { Link, router } from '@inertiajs/react';
import { ArrowRight, Camera, Check, MapPinned, MousePointer2, Trash2, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    addBay,
    bayNumber,
    browserStorage,
    canCheck,
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

export type LocationProposal = {
    id: number;
    source: string;
    street: string;
    reported_bays: number | null;
    status: 'open' | 'added';
    points: (MapPoint & { id: number; last_seen: string | null })[];
};

export type ProposalRow = {
    id: number;
    municipality: string;
    status: 'open' | 'added';
    bayCount: number | null;
    points: (MapPoint & { id: number; proposal_id: number; source: string; source_last_seen_on: string | null })[];
};

export function toLocationProposal(row: ProposalRow): LocationProposal {
    return {
        id: row.id,
        street: `${row.municipality} · #${row.id}`,
        source: row.points[0]?.source ?? '',
        reported_bays: row.bayCount,
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
}: {
    proposals: LocationProposal[];
    onOpen: (selection: LocationProposalSelection) => void;
    total?: number;
}) {
    const { t } = useTranslation('backend/moderation');
    const storage = browserStorage();
    const points = proposals.flatMap((proposal) => proposal.points.map((point, index) => ({ proposal, point, index })));

    return (
        <>
            <div className="flex justify-between px-4.5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">
                <span>{t('proposals.title')}</span>
                <span className="tabular-nums">{total ?? proposals.length}</span>
            </div>
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
                                    <StatusText draft={loadDraft(storage, proposal.id)} proposal={proposal} />
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

    return proposal.reported_bays === null ? proposal.source : t('proposals.reported', { count: proposal.reported_bays });
}

export function LocationProposalReview({
    selection,
    imagery,
    options,
    publishedBays,
    revision,
    canReject,
    community,
    municipal,
    comparison,
    group,
    query,
    onBack,
    nextUrl,
}: {
    selection: LocationProposalSelection;
    imagery: AerialLayer[];
    options: {
        orientations: OrientationOption[];
        restrictionDays: RestrictionDay[];
        maxBays: number;
        completionReasons: EnumOption[];
        rejectionReasons: EnumOption[];
    };
    publishedBays: PublishedBay[];
    revision: number;
    canReject: boolean;
    community: (MapPoint & { id: string; street: string | null })[];
    municipal: MapPoint[];
    comparison?: MapPoint;
    group?: React.ReactNode;
    query: { municipality?: string | number; page?: number; point?: number; from?: 'queue' };
    onBack: () => void;
    nextUrl?: string;
}) {
    const { t, i18n } = useTranslation('backend/moderation');
    const { proposal, point: initialPoint } = selection;
    const [sourcePointId, setSourcePointId] = useState(initialPoint.id);
    const point = proposal.points.find((candidate) => candidate.id === sourcePointId) ?? initialPoint;
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
    const totalBays = submittedCount + bays.length;
    const partial = proposal.reported_bays !== null && totalBays < proposal.reported_bays;
    const askReason = !published && !rejecting && step === 'check' && partial;
    const pickingDuplicate = rejecting && reason === 'duplicate';
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
        if (published || processing || !canCheck(draft) || (partial && !reason)) return;
        setFailure(null);
        setProcessing(true);
        router.post(
            app.moderation.proposals.publish.url(proposal.id, { query }),
            { ...publicationPayload(draft), revision, ...(partial ? { reason, note } : {}) },
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
        if (processing || !reason || (pickingDuplicate && !existing)) return;
        setFailure(null);
        setProcessing(true);
        router.post(
            app.moderation.proposals.reject.url(proposal.id, { query }),
            { revision, reason, note, existing_parking_space_id: pickingDuplicate ? existing : null },
            {
                onError: (errors) => setFailure(Object.values(errors)[0] ?? null),
                onSuccess: () => saveDraft(storage, proposal.id, emptyDraft()),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const decisionFields = (legend: string, reasons: EnumOption[]) => (
        <fieldset className="flex flex-col gap-2 rounded-xl border p-4" disabled={processing}>
            <legend className="px-1 text-[15px] font-semibold">{legend}</legend>
            {reasons.map((option) => (
                <label key={option.value} className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm">
                    <input
                        type="radio"
                        name="proposal-reason"
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        className="size-4 shrink-0 accent-foreground"
                    />
                    {option.label}
                </label>
            ))}
            {pickingDuplicate && (
                <label className="space-y-1 text-sm">
                    <span>{t('proposals.pick_duplicate')}</span>
                    <select
                        className="w-full rounded-md border bg-background p-2"
                        value={existing ?? ''}
                        onChange={(event) => {
                            const place = community.find((candidate) => candidate.id === event.target.value);
                            setExisting(place?.id ?? null);
                            if (place) setView({ center: place, zoom: BAY_ZOOM });
                        }}
                    >
                        <option value="">{t('proposals.choose')}</option>
                        {community.map((place) => (
                            <option key={place.id} value={place.id}>
                                {place.street || t('proposals.unknown_street')} ({place.latitude.toFixed(5)}, {place.longitude.toFixed(5)})
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <label className="space-y-1 text-sm">
                <span>{t('proposals.decision_note')}</span>
                <textarea
                    className="w-full rounded-md border bg-background p-2"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                />
            </label>
        </fieldset>
    );

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
                const street = streetViewUrl(bay.latitude, bay.longitude);

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
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-label={t('proposals.zoom', { number })}
                            onClick={() => zoomTo(bay, bay.id)}
                        >
                            <ZoomIn className="size-4" aria-hidden />
                        </Button>
                        {street && (
                            <Button variant="ghost" size="icon" className="size-10" asChild>
                                <a href={street} target="_blank" rel="noreferrer" aria-label={t('proposals.street_view', { number })}>
                                    <Camera className="size-4" aria-hidden />
                                </a>
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-red-700 hover:text-red-800"
                            aria-label={t('proposals.remove', { number })}
                            disabled={processing}
                            onClick={() => remove(bay.id)}
                        >
                            <Trash2 className="size-4" aria-hidden />
                        </Button>
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
            label={proposal.street}
            imageryLayers={imagery}
            streetView={selectedBay ?? point}
            map={{
                center: view.center,
                zoom: view.zoom ?? 19,
                sourcePoint: point,
                comparisonPoint: comparison,
                nearby: pickingDuplicate ? [] : community,
                municipal,
                bays: pickingDuplicate ? undefined : markers,
                queue: pickingDuplicate
                    ? community.map((place) => ({
                          key: place.id,
                          point: place,
                          color: '#15803d',
                          label: place.street ?? t('proposals.unknown_street'),
                      }))
                    : undefined,
                highlighted: pickingDuplicate ? (existing ?? undefined) : undefined,
                onPick: pickingDuplicate ? setExisting : undefined,
                onPlace: !published && !rejecting && (step === 'place' || askReason) && !processing ? place : undefined,
                onMoveBay: published || rejecting || processing ? undefined : (id, point) => setDraft((current) => moveBay(current, id, point)),
                onSelectBay: setSelected,
            }}
        >
            <PanelNav
                back={t('queue.label')}
                onBack={onBack}
                action={
                    nextUrl && !published && !processing ? (
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={nextUrl}>
                                {t('proposals.next_proposal')} <ArrowRight aria-hidden />
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-blue-700 dark:text-blue-300">
                        {t('proposals.eyebrow', { source: proposal.source })}
                    </span>
                    <h2 className="text-2xl leading-tight font-bold tracking-tight">{proposal.street}</h2>
                    {seen && <span className="text-sm text-muted-foreground">{t('proposals.seen', { date: seen })}</span>}
                    {proposal.points.length > 1 && !published && !rejecting && (
                        <select
                            aria-label={t('proposals.source_point')}
                            className="mt-2 rounded-md border bg-background p-2 text-sm"
                            value={point.id}
                            onChange={(event) => {
                                const next = proposal.points.find((candidate) => candidate.id === Number(event.target.value));
                                if (next) {
                                    setSourcePointId(next.id);
                                    setView({ center: next });
                                }
                            }}
                        >
                            {proposal.points.map((item, index) => (
                                <option key={item.id} value={item.id}>
                                    {t('proposals.point_numbered', { number: index + 1 })}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5 rounded-xl bg-muted p-3">
                        <span className="text-xs text-stone-600 dark:text-muted-foreground">{t('proposals.source')}</span>
                        <span className="font-semibold">
                            {proposal.reported_bays === null
                                ? t('proposals.unknown_count')
                                : t('proposals.reported', { count: proposal.reported_bays })}
                        </span>
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
                </div>

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

                        {group}
                    </>
                )}
                {askReason &&
                    decisionFields(t('proposals.partial_reason', { count: (proposal.reported_bays ?? 0) - totalBays }), options.completionReasons)}
                {rejecting && decisionFields(t('proposals.reject_title'), options.rejectionReasons)}
                {rejecting && <InputError message={failure ?? undefined} />}
            </div>
            <div className="flex shrink-0 gap-2 border-t px-5 py-4">
                {rejecting ? (
                    <>
                        <Button
                            type="button"
                            variant="destructive"
                            className="h-11 flex-[2]"
                            disabled={processing || !reason || (pickingDuplicate && !existing)}
                            onClick={reject}
                        >
                            {t('proposals.reject_title')}
                        </Button>
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
                        <Button
                            type="button"
                            className="h-11 flex-[2]"
                            disabled={processing || draft.bays.length === 0 || (partial && !reason)}
                            onClick={submit}
                        >
                            {processing
                                ? t('proposals.submitting')
                                : partial
                                  ? t('proposals.complete_with', { count: totalBays })
                                  : t('proposals.publish', { count: draft.bays.length })}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            disabled={processing}
                            onClick={partial ? onBack : () => setStep('details')}
                        >
                            {t(partial ? 'proposals.resume_later' : 'proposals.back')}
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
                        {nextUrl && (
                            <Button className="h-11 flex-1" asChild>
                                <Link href={nextUrl}>
                                    {t('proposals.next_proposal')} <ArrowRight aria-hidden />
                                </Link>
                            </Button>
                        )}
                        <Button type="button" variant={nextUrl ? 'outline' : 'default'} className="h-11 flex-1" onClick={onBack}>
                            {t('proposals.back_to_queue')}
                        </Button>
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
                        {t('proposals.reject_title')}
                    </Button>
                ) : null}
            </div>
        </Workspace>
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
