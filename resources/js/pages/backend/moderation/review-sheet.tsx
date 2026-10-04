import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getOrangeMarkerIcon } from '@/lib/icon-factory';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import { Link, router } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, Flag as FlagIcon, MapPinned, Pencil, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Marker, Polyline } from 'react-leaflet';
import { DecisionPopover } from './decision-popover';
import { GroupEditor } from './group-editor';
import { ContributorName, Flag, useAgo } from './parts';
import { TypeBadge } from './type-badge';
import {
    type ImprovementDetails,
    type ItemLink,
    type Options,
    type Position,
    type QueueItem,
    type ReportDetails,
    type SelectedItem,
    type SubmissionDetails,
} from './types';
import { CHANGE_GROUPS, type ChangeGroup, GROUP_FIELDS, type ImprovementValues, useValueFormatter } from './values';

const MAP_SIZE = 'h-64';
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The item under review, beside the queue. One sheet for every kind of item: the header and actions stay in place,
 * the body shows what this decision needs. After a decision the sheet stays open with the next item.
 */
export function ReviewSheet({
    selected,
    position,
    loading,
    options,
    query,
    onNavigate,
    onClose,
}: {
    selected: SelectedItem | null;
    position: Position | null;
    /** The item being opened, shown from the queue row while its details load. */
    loading: { preview: QueueItem | null } | null;
    options: Options;
    query: Record<string, string>;
    onNavigate: (link: ItemLink) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const item: QueueItem | null = loading?.preview ?? selected;
    const open = selected !== null || loading !== null;

    return (
        <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
            <SheetContent className="w-full gap-0 sm:max-w-2xl" showCloseButton={false}>
                {item && (
                    <>
                        <SheetHeader className="gap-2 px-6 pt-6 pb-4">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <TypeBadge type={item.type} />
                                {position && (
                                    <nav aria-label={t('review.position_label')} className="ml-auto flex items-center gap-1.5">
                                        {!loading && t('review.position', { index: position.index, total: position.total })}
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8 cursor-pointer"
                                            disabled={!position.previous || loading !== null}
                                            aria-label={t('review.previous')}
                                            onClick={() => position.previous && onNavigate(position.previous)}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8 cursor-pointer"
                                            disabled={!position.next || loading !== null}
                                            aria-label={t('review.next')}
                                            onClick={() => position.next && onNavigate(position.next)}
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </nav>
                                )}
                            </div>
                            <SheetTitle className="text-lg">
                                {[item.street, item.municipality].filter(Boolean).join(', ') || t('no_address')}
                            </SheetTitle>
                            <SheetDescription className="flex flex-wrap items-center gap-x-2">
                                {item.contributor ? (
                                    <span className="text-foreground">
                                        <ContributorName contributor={item.contributor} />
                                    </span>
                                ) : (
                                    <span>{t('contributor.reporters', { count: item.flags.reports ?? 0 })}</span>
                                )}
                                <span aria-hidden>·</span>
                                <span>{ago(item.waiting_since)}</span>
                            </SheetDescription>
                        </SheetHeader>

                        {(loading || !selected || !position) && <BodySkeleton />}
                        {!loading && selected && position && selected.type === 'submission' && (
                            <SubmissionReview
                                key={selected.key}
                                item={selected}
                                details={selected.details}
                                position={position}
                                options={options}
                                query={query}
                                onSkip={onNavigate}
                            />
                        )}
                        {!loading && selected && position && selected.type === 'improvement' && (
                            <ImprovementReview
                                key={selected.key}
                                item={selected}
                                details={selected.details}
                                position={position}
                                options={options}
                                query={query}
                                onSkip={onNavigate}
                            />
                        )}
                        {!loading && selected && position && selected.type === 'report' && (
                            <ReportReview key={selected.key} details={selected.details} options={options} query={query} />
                        )}
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

/** Stands in for the body while the item's details load, so the sheet opens at once. */
function BodySkeleton() {
    return (
        <div className="flex flex-1 flex-col gap-5 px-6 pb-6" aria-hidden>
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
    );
}

/** The scrolling body and the fixed action bar every kind of item shares. */
function Layout({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">{children}</div>
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-3">{actions}</footer>
        </>
    );
}

function Legend({ items }: { items: string[] }) {
    return (
        <p className="-mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {items.map((item) => (
                <span key={item}>{item}</span>
            ))}
        </p>
    );
}

/** The space's values for a decision, as the approve endpoints validate them. */
function payload(values: ImprovementValues) {
    const minutes = values.parking_time ?? 0;
    return {
        latitude: values.latitude,
        longitude: values.longitude,
        orientation: values.orientation,
        under_sign: values.under_sign,
        under_sign_text: values.under_sign_text,
        parking_hours: minutes ? Math.floor(minutes / 60) : null,
        parking_minutes: minutes ? minutes % 60 : null,
        restriction_days: values.restriction_days ?? [],
        restriction_starts_at: values.restriction_starts_at,
        restriction_ends_at: values.restriction_ends_at,
        description: values.description,
    };
}

function useApprove(url: string) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const approve = (values: ImprovementValues) =>
        router.post(url, payload(values), {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: setErrors,
        });

    return { approve, errors, processing };
}

function SkipButton({ position, onSkip }: { position: Position; onSkip: (link: ItemLink) => void }) {
    const { t } = useTranslation('backend/moderation');
    if (!position.next) return null;

    return (
        <Button variant="ghost" className="mr-auto cursor-pointer text-muted-foreground" onClick={() => position.next && onSkip(position.next)}>
            {t('review.skip')}
        </Button>
    );
}

/** A new community submission: its details, editable before approval, and the places around it. */
function SubmissionReview({
    item,
    details,
    position,
    options,
    query,
    onSkip,
}: {
    item: SelectedItem;
    details: SubmissionDetails;
    position: Position;
    options: Options;
    query: Record<string, string>;
    onSkip: (link: ItemLink) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const format = useValueFormatter(options);
    const [draft, setDraft] = useState<ImprovementValues>(details.current);
    const [editing, setEditing] = useState<ChangeGroup | null>(null);
    const { approve, errors, processing } = useApprove(app.moderation.submissions.approve.url({ parking_space: details.space.id }, { query }));
    const update = (values: Partial<ImprovementValues>) => setDraft((previous) => ({ ...previous, ...values }));
    const isEdited = (group: ChangeGroup) => GROUP_FIELDS[group].some((field) => !same(draft[field], details.current[field]));
    const moved = draft.latitude !== details.current.latitude || draft.longitude !== details.current.longitude;
    const nearby = item.flags.nearby_municipal_metres;

    return (
        <Layout
            actions={
                options.can.submission && (
                    <>
                        <SkipButton position={position} onSkip={onSkip} />
                        <DecisionPopover
                            kind="submission"
                            action={app.moderation.submissions.reject.url({ parking_space: details.space.id }, { query })}
                            reasons={options.reasons.submission}
                            trigger={t('review.reject')}
                        />
                        <Button className="cursor-pointer" disabled={processing} onClick={() => approve(draft)}>
                            {t('review.approve')}
                        </Button>
                    </>
                )
            }
        >
            <LocationMarkerCard
                latitude={draft.latitude}
                longitude={draft.longitude}
                nearbySpaces={details.nearbySpaces}
                nearbyMunicipalSpaces={details.nearbyMunicipalSpaces}
                onChange={options.can.submission ? (latitude, longitude) => update({ latitude, longitude }) : undefined}
                scrollWheelZoom={false}
                className={MAP_SIZE}
            />
            <Legend items={[t('review.legend.submitted'), t('review.legend.nearby'), t('review.legend.municipal')]} />

            {nearby != null && (
                <div role="alert" className="rounded-lg border-2 border-violet-300/60 bg-violet-50 px-3 py-3 dark:bg-violet-950/80">
                    <p className="flex items-center gap-2 font-semibold text-violet-900 dark:text-violet-100">
                        <MapPinned className="size-5 min-w-5 text-violet-500" aria-hidden />
                        {t('review.nearby_municipal.title', { distance: nearby })}
                    </p>
                    <p className="mt-2 text-sm text-zinc-800 dark:text-violet-50">{t('review.nearby_municipal.description')}</p>
                </div>
            )}

            <section aria-labelledby="submitted-title" className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-4">
                    <h3 id="submitted-title" className="text-sm font-semibold">
                        {t('review.submitted')}
                    </h3>
                    <span className="text-xs text-muted-foreground">{t('review.submitted_hint')}</span>
                </div>
                <InputError message={errors.general ?? Object.values(errors)[0]} />
                <ul className="divide-y rounded-xl border">
                    {CHANGE_GROUPS.map((group) => (
                        <li key={group} className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-start gap-3 px-4 py-3.5 text-sm">
                            <span className="font-medium">{t(`groups.${group}`)}</span>
                            <div className="flex min-w-0 flex-col gap-1">
                                {editing === group ? (
                                    <GroupEditor group={group} draft={draft} update={update} options={options} />
                                ) : (
                                    <span>{group === 'location' && moved ? t('review.location_moved') : format(group, draft)}</span>
                                )}
                                {isEdited(group) && (
                                    <span className="text-xs text-orange-700 dark:text-orange-400">
                                        {t('review.edited', { value: format(group, details.current) })}
                                    </span>
                                )}
                            </div>
                            {options.can.submission &&
                                (isEdited(group) ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 cursor-pointer"
                                        aria-label={t('review.restore')}
                                        onClick={() => {
                                            update(Object.fromEntries(GROUP_FIELDS[group].map((field) => [field, details.current[field]])));
                                            setEditing(null);
                                        }}
                                    >
                                        <RotateCcw className="size-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 cursor-pointer"
                                        aria-pressed={editing === group}
                                        aria-label={t('review.edit', { field: t(`groups.${group}`) })}
                                        onClick={() => setEditing(editing === group ? null : group)}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                ))}
                        </li>
                    ))}
                </ul>
            </section>
            <ContributorContext item={item} />
        </Layout>
    );
}

/** A proposed improvement: current against proposed values, each change taken over, adjusted or left out. */
function ImprovementReview({
    item,
    details,
    position,
    options,
    query,
    onSkip,
}: {
    item: SelectedItem;
    details: ImprovementDetails;
    position: Position;
    options: Options;
    query: Record<string, string>;
    onSkip: (link: ItemLink) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const format = useValueFormatter(options);
    const { current, submitted, changes } = details;
    const proposed = useMemo<ImprovementValues>(() => ({ ...current, ...submitted }), [current, submitted]);
    const [draft, setDraft] = useState<ImprovementValues>(proposed);
    const [accepted, setAccepted] = useState<Record<ChangeGroup, boolean>>(
        () => Object.fromEntries(changes.map((group) => [group, true])) as Record<ChangeGroup, boolean>,
    );
    const [editing, setEditing] = useState<ChangeGroup | null>(null);
    const [showUnchanged, setShowUnchanged] = useState(false);
    const { approve, errors, processing } = useApprove(app.moderation.improvements.approve.url({ improvement: details.id }, { query }));

    const update = (values: Partial<ImprovementValues>) => setDraft((previous) => ({ ...previous, ...values }));
    const isEdited = (group: ChangeGroup) => GROUP_FIELDS[group].some((field) => !same(draft[field], proposed[field]));
    const takenOver = changes.filter((group) => accepted[group]);
    /** The space as it will be after approval: taken-over groups from the draft, everything else as it is now. */
    const result = (): ImprovementValues => ({
        ...current,
        ...Object.fromEntries(
            CHANGE_GROUPS.flatMap((group) => GROUP_FIELDS[group].map((field) => [field, (accepted[group] ? draft : current)[field]])),
        ),
    });

    return (
        <Layout
            actions={
                options.can.improvement && (
                    <>
                        <SkipButton position={position} onSkip={onSkip} />
                        <DecisionPopover
                            kind="improvement"
                            action={app.moderation.improvements.reject.url({ improvement: details.id }, { query })}
                            reasons={options.reasons.improvement}
                            trigger={t('review.reject')}
                        />
                        <Button className="cursor-pointer" disabled={processing || takenOver.length === 0} onClick={() => approve(result())}>
                            {t('review.approve')}
                        </Button>
                    </>
                )
            }
        >
            <LocationMarkerCard
                latitude={current.latitude}
                longitude={current.longitude}
                nearbySpaces={details.nearbySpaces}
                scrollWheelZoom={false}
                className={MAP_SIZE}
            >
                {changes.includes('location') && (
                    <>
                        <Polyline
                            positions={[
                                [current.latitude, current.longitude],
                                [draft.latitude, draft.longitude],
                            ]}
                            pathOptions={{ color: '#ea580c', dashArray: '6 6', weight: 2 }}
                        />
                        <Marker
                            position={[draft.latitude, draft.longitude]}
                            icon={getOrangeMarkerIcon()}
                            opacity={accepted.location ? 1 : 0.4}
                            draggable={!!accepted.location && options.can.improvement}
                            eventHandlers={{
                                dragend: (event) => {
                                    const { lat, lng } = event.target.getLatLng();
                                    update({ latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) });
                                },
                            }}
                        />
                    </>
                )}
            </LocationMarkerCard>
            <Legend
                items={[
                    t('review.legend.current'),
                    ...(changes.includes('location') ? [t('review.legend.proposed')] : []),
                    t('review.legend.nearby'),
                ]}
            />

            <section aria-labelledby="changes-title" className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-4">
                    <h3 id="changes-title" className="text-sm font-semibold">
                        {t('review.changes')}
                    </h3>
                    <span className="text-xs text-muted-foreground">{t('review.changes_hint')}</span>
                </div>
                <InputError message={errors.general ?? Object.values(errors)[0]} />
                <ul className="divide-y rounded-xl border">
                    {changes.map((group) => (
                        <li
                            key={group}
                            className={cn(
                                'grid grid-cols-[1.25rem_6rem_minmax(0,1fr)_2rem] items-start gap-3 px-4 py-3.5',
                                !accepted[group] && 'text-muted-foreground',
                            )}
                        >
                            <Checkbox
                                id={`take-${group}`}
                                checked={accepted[group]}
                                disabled={!options.can.improvement}
                                onCheckedChange={(checked) => setAccepted((previous) => ({ ...previous, [group]: !!checked }))}
                                className="mt-0.5"
                            />
                            <Label htmlFor={`take-${group}`} className="font-medium">
                                {t(`groups.${group}`)}
                            </Label>
                            <div className="flex min-w-0 flex-col gap-1 text-sm">
                                <span className="text-muted-foreground line-through decoration-muted-foreground/40">{format(group, current)}</span>
                                {editing === group && accepted[group] ? (
                                    <GroupEditor group={group} draft={draft} update={update} options={options} />
                                ) : (
                                    <span className={cn(accepted[group] ? 'font-medium' : 'line-through')}>
                                        {group === 'location' && isEdited('location') ? t('review.location_moved') : format(group, draft)}
                                        {group === 'location' && details.distance_metres !== null && !isEdited('location') && (
                                            <span className="font-normal text-muted-foreground">
                                                {' '}
                                                · {t('review.moved', { distance: details.distance_metres })}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {group === 'location' &&
                                    accepted.location &&
                                    submitted.municipality_id !== undefined &&
                                    submitted.municipality !== current.municipality &&
                                    !isEdited('location') && (
                                        <span className="mt-0.5">
                                            <Flag>{t('flags.other_municipality')}</Flag>
                                        </span>
                                    )}
                                {isEdited(group) && accepted[group] && (
                                    <span className="text-xs text-orange-700 dark:text-orange-400">
                                        {t('review.edited', { value: format(group, proposed) })}
                                    </span>
                                )}
                            </div>
                            {accepted[group] &&
                                options.can.improvement &&
                                (isEdited(group) ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 cursor-pointer"
                                        aria-label={t('review.restore')}
                                        onClick={() => {
                                            update(Object.fromEntries(GROUP_FIELDS[group].map((field) => [field, proposed[field]])));
                                            setEditing(null);
                                        }}
                                    >
                                        <RotateCcw className="size-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 cursor-pointer"
                                        aria-pressed={editing === group}
                                        aria-label={t('review.edit', { field: t(`groups.${group}`) })}
                                        onClick={() => setEditing(editing === group ? null : group)}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                ))}
                        </li>
                    ))}
                </ul>
                <button
                    type="button"
                    aria-expanded={showUnchanged}
                    onClick={() => setShowUnchanged((value) => !value)}
                    className="inline-flex cursor-pointer items-center gap-1 self-start py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    {t(showUnchanged ? 'review.hide_unchanged' : 'review.show_unchanged')}
                    <ChevronDown className={cn('size-4 transition-transform', showUnchanged && 'rotate-180')} />
                </button>
                {showUnchanged && (
                    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-1 text-sm">
                        {CHANGE_GROUPS.filter((group) => !changes.includes(group)).map((group) => (
                            <div key={group} className="contents">
                                <dt className="text-muted-foreground">{t(`groups.${group}`)}</dt>
                                <dd>{format(group, current)}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </section>
            <p className="text-sm text-muted-foreground">
                <Link
                    href={app.parkingSpaces.show({ parking_space: details.space.id })}
                    className="underline underline-offset-2 hover:text-foreground"
                >
                    {t('review.view_space')}
                </Link>
                {!details.space.published && <> · {t('not_public')}</>}
            </p>
            <ContributorContext item={item} />
        </Layout>
    );
}

/** A place reported as gone: the reports, and whether people still confirmed it since. */
function ReportReview({ details, options, query }: { details: ReportDetails; options: Options; query: Record<string, string> }) {
    const { t } = useTranslation('backend/moderation');
    const ago = useAgo();
    const [keeping, setKeeping] = useState(false);
    const confirmed = details.confirmations_since_report > 0;
    const route = { source: details.source, id: details.id };

    const keep = () =>
        router.post(
            app.moderation.reports.keep.url(route, { query }),
            {},
            { preserveScroll: true, preserveState: true, onStart: () => setKeeping(true), onFinish: () => setKeeping(false) },
        );

    return (
        <Layout
            actions={
                options.can.report && (
                    <>
                        <Button variant="outline" className="cursor-pointer" disabled={keeping} onClick={keep}>
                            {t('reports.keep')}
                        </Button>
                        <DecisionPopover
                            kind={details.source}
                            action={app.moderation.reports.remove.url(route, { query })}
                            reasons={options.reasons.report}
                            trigger={t(`reports.remove.${details.source}`)}
                            variant="destructive"
                        />
                    </>
                )
            }
        >
            <LocationMarkerCard
                latitude={details.latitude}
                longitude={details.longitude}
                nearbySpaces={details.nearbySpaces}
                scrollWheelZoom={false}
                className={MAP_SIZE}
            />
            <Legend items={[t('review.legend.reported'), t('review.legend.nearby')]} />

            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`reports.sources.${details.source}`)}</Badge>
                {!details.published && <Badge variant="secondary">{t('not_public')}</Badge>}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{t('reports.signals.reports')}</dt>
                    <dd className="mt-0.5 font-semibold">
                        <FlagIcon className="mr-1 inline size-3.5 -translate-y-px text-orange-500" aria-hidden />
                        {t('reports.signals.report_count', { count: details.reports.length })}
                    </dd>
                    <dd className="text-xs text-muted-foreground">{t('reports.signals.first_reported', { ago: ago(details.first_reported_at) })}</dd>
                </div>
                <div
                    className={cn(
                        'rounded-md border px-3 py-2',
                        confirmed && 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/60',
                    )}
                >
                    <dt className="text-xs text-muted-foreground">{t('reports.signals.confirmations_since')}</dt>
                    <dd className="mt-0.5 font-semibold">{t('reports.signals.confirmation_count', { count: details.confirmations_since_report })}</dd>
                    <dd className="text-xs text-muted-foreground">
                        {details.last_confirmed_at
                            ? t('reports.signals.last_confirmed', { ago: ago(details.last_confirmed_at) })
                            : t('reports.signals.never_confirmed')}
                    </dd>
                </div>
            </dl>

            <section aria-labelledby="notes-title">
                <h3 id="notes-title" className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {t('reports.notes.title')}
                </h3>
                <ul className="flex flex-col gap-2">
                    {details.reports.map((report) => (
                        <li key={report.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                            {report.reason && <p className="font-medium">{report.reason}</p>}
                            {report.note ? (
                                <p>“{report.note}”</p>
                            ) : (
                                !report.reason && <p className="text-muted-foreground italic">{t('reports.notes.none')}</p>
                            )}
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {report.reporter ?? t('unknown_user')} · {ago(report.reported_at)}
                            </p>
                        </li>
                    ))}
                </ul>
            </section>

            {details.source === 'community' && (
                <p className="text-sm">
                    <Link
                        href={app.parkingSpaces.show({ parking_space: details.id })}
                        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        {t('review.view_space')}
                    </Link>
                </p>
            )}
        </Layout>
    );
}

/** The contributor's track record, shown as context only. */
function ContributorContext({ item }: { item: SelectedItem }) {
    const { t } = useTranslation('backend/moderation');
    if (!item.contributor) return null;

    return (
        <p className="text-sm text-muted-foreground">
            {t('contributor.history', {
                name: item.contributor.name ?? t('unknown_user'),
                approved: item.contributor.approved,
                rejected: item.contributor.rejected,
            })}
        </p>
    );
}
