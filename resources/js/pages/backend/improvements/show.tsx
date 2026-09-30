import InputError from '@/components/input-error';
import LocationMarkerCard from '@/components/map/card-location-marker';
import StreetViewCard from '@/components/map/card-location-streetview';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { getOrangeMarkerIcon } from '@/lib/icon-factory';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Marker, Polyline } from 'react-leaflet';
import { Flag, type Proposer, ProposerName, useAgo } from './parts';
import { CHANGE_GROUPS, type ChangeGroup, type EnumOption, GROUP_FIELDS, type ImprovementValues, useValueFormatter } from './values';

type PageProps = {
    improvement: {
        id: number;
        submitted_at: string;
        proposer: Proposer;
        space: { id: string; street: string | null; municipality: string | null; published: boolean; confirmations: number };
        current: ImprovementValues;
        submitted: Partial<ImprovementValues>;
        changes: ChangeGroup[];
        distance_metres: number | null;
    };
    position: { index: number; total: number; previous: number | null; next: number | null };
    nearbySpaces: ParkingSpace[];
    options: { orientations: EnumOption[]; underSign: EnumOption[]; restrictionDays: string[]; rejectionReasons: EnumOption[] };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default function Show({ improvement, position, nearbySpaces, options }: PageProps) {
    const { t } = useResourceTranslation('backend/improvements');
    const { can } = useAuthorization();
    const ago = useAgo();
    const format = useValueFormatter(options);
    const { current, submitted, changes, space } = improvement;

    const proposed = useMemo<ImprovementValues>(() => ({ ...current, ...submitted }), [current, submitted]);
    const [draft, setDraft] = useState<ImprovementValues>(proposed);
    const [accepted, setAccepted] = useState<Record<ChangeGroup, boolean>>(
        () => Object.fromEntries(changes.map((group) => [group, true])) as Record<ChangeGroup, boolean>,
    );
    const [editing, setEditing] = useState<ChangeGroup | null>(null);
    const [showUnchanged, setShowUnchanged] = useState(false);
    const [view, setView] = useState<'map' | 'streetview'>('map');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const update = (values: Partial<ImprovementValues>) => setDraft((previous) => ({ ...previous, ...values }));
    const isEdited = (group: ChangeGroup) => GROUP_FIELDS[group].some((field) => !same(draft[field], proposed[field]));
    const restore = (group: ChangeGroup) => {
        update(Object.fromEntries(GROUP_FIELDS[group].map((field) => [field, proposed[field]])));
        setEditing(null);
    };
    const takenOver = changes.filter((group) => accepted[group]);
    const pinMoved = accepted.location && (draft.latitude !== current.latitude || draft.longitude !== current.longitude);

    /** The space as it will be after approval: taken-over groups from the draft, everything else as it is now. */
    const approve = () => {
        const pick = (group: ChangeGroup) => (accepted[group] ? draft : current);
        const underSign = pick('under_sign');
        const minutes = underSign.parking_time ?? 0;
        router.post(
            app.improvements.approve.url({ improvement: improvement.id }),
            {
                latitude: pick('location').latitude,
                longitude: pick('location').longitude,
                orientation: pick('orientation').orientation,
                under_sign: underSign.under_sign,
                under_sign_text: underSign.under_sign_text,
                parking_hours: minutes ? Math.floor(minutes / 60) : null,
                parking_minutes: minutes ? minutes % 60 : null,
                restriction_days: underSign.restriction_days ?? [],
                restriction_starts_at: underSign.restriction_starts_at,
                restriction_ends_at: underSign.restriction_ends_at,
                description: pick('description').description,
            },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: setErrors,
            },
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('title'), href: app.improvements.index() },
        { title: [space.street, space.municipality].filter(Boolean).join(', '), href: app.improvements.show({ improvement: improvement.id }) },
    ];
    const next = position.next ? app.improvements.show({ improvement: position.next }) : app.improvements.index();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('review.title', { place: space.street ?? '' })} />
            <div className="flex min-h-[calc(100svh-5rem)] flex-col">
                <div className="grid flex-1 gap-8 px-4 py-6 sm:px-8 lg:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    {[space.street, space.municipality].filter(Boolean).join(', ') || t('no_address')}
                                </h1>
                                <nav
                                    aria-label={t('review.position_label')}
                                    className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground"
                                >
                                    {t('review.position', { index: position.index, total: position.total })}
                                    <Button
                                        asChild={!!position.previous}
                                        variant="outline"
                                        size="icon"
                                        className="size-8"
                                        disabled={!position.previous}
                                    >
                                        {position.previous ? (
                                            <Link href={app.improvements.show({ improvement: position.previous })} aria-label={t('review.previous')}>
                                                <ChevronLeft className="size-4" />
                                            </Link>
                                        ) : (
                                            <ChevronLeft className="size-4" aria-label={t('review.previous')} />
                                        )}
                                    </Button>
                                    <Button asChild={!!position.next} variant="outline" size="icon" className="size-8" disabled={!position.next}>
                                        {position.next ? (
                                            <Link href={next} aria-label={t('review.next')}>
                                                <ChevronRight className="size-4" />
                                            </Link>
                                        ) : (
                                            <ChevronRight className="size-4" aria-label={t('review.next')} />
                                        )}
                                    </Button>
                                </nav>
                            </div>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span className="text-foreground">
                                    <ProposerName proposer={improvement.proposer} />
                                </span>
                                <span aria-hidden>·</span>
                                <span>{ago(improvement.submitted_at)}</span>
                                <span aria-hidden>·</span>
                                <span>{t('review.confirmations', { count: space.confirmations })}</span>
                                {!space.published && (
                                    <>
                                        <span aria-hidden>·</span>
                                        <span>{t('not_public')}</span>
                                    </>
                                )}
                                <span aria-hidden>·</span>
                                <Link
                                    href={app.parkingSpaces.show({ parking_space: space.id })}
                                    className="underline underline-offset-2 hover:text-foreground"
                                >
                                    {t('review.view_space')}
                                </Link>
                            </p>
                        </div>

                        <section aria-labelledby="changes-title" className="flex flex-col gap-2.5">
                            <div className="flex items-baseline justify-between gap-4">
                                <h2 id="changes-title" className="font-semibold">
                                    {t('review.changes')}
                                </h2>
                                <span className="text-xs text-muted-foreground">{t('review.changes_hint')}</span>
                            </div>
                            <InputError message={errors.general ?? errors.latitude ?? errors.longitude} />

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
                                            onCheckedChange={(checked) => setAccepted((previous) => ({ ...previous, [group]: !!checked }))}
                                            className="mt-0.5"
                                        />
                                        <Label htmlFor={`take-${group}`} className="font-medium">
                                            {t(`groups.${group}`)}
                                        </Label>
                                        <div className="flex min-w-0 flex-col gap-1 text-sm">
                                            <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                                                {format(group, current)}
                                            </span>
                                            {editing === group && accepted[group] ? (
                                                <GroupEditor group={group} draft={draft} update={update} options={options} />
                                            ) : (
                                                <span className={cn(accepted[group] ? 'font-medium' : 'line-through')}>
                                                    {group === 'location' && isEdited('location') ? t('review.location_moved') : format(group, draft)}
                                                    {group === 'location' && improvement.distance_metres !== null && !isEdited('location') && (
                                                        <span className="font-normal text-muted-foreground">
                                                            {' '}
                                                            · {t('review.moved', { distance: improvement.distance_metres })}
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
                                            (isEdited(group) ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8"
                                                    onClick={() => restore(group)}
                                                    aria-label={t('review.restore')}
                                                >
                                                    <RotateCcw className="size-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8"
                                                    aria-pressed={editing === group}
                                                    onClick={() => setEditing(editing === group ? null : group)}
                                                    aria-label={t('review.edit', { field: t(`groups.${group}`) })}
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
                    </div>

                    <section aria-label={t('review.map')} className="flex flex-col gap-2.5">
                        <div className="flex justify-end">
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={view}
                                onValueChange={(value) => value && setView(value as 'map' | 'streetview')}
                            >
                                <ToggleGroupItem value="map">{t('review.view_map')}</ToggleGroupItem>
                                <ToggleGroupItem value="streetview">{t('review.view_streetview')}</ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        {view === 'map' ? (
                            <LocationMarkerCard
                                latitude={current.latitude}
                                longitude={current.longitude}
                                nearbySpaces={nearbySpaces}
                                scrollWheelZoom={false}
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
                                            draggable={!!accepted.location}
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
                        ) : (
                            <StreetViewCard
                                latitude={pinMoved ? draft.latitude : current.latitude}
                                longitude={pinMoved ? draft.longitude : current.longitude}
                            />
                        )}
                        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{t('review.legend.current')}</span>
                            {changes.includes('location') && <span>{t('review.legend.proposed')}</span>}
                            <span>{t('review.legend.nearby')}</span>
                        </p>
                    </section>
                </div>

                {can('parking-space-improvement.review') && (
                    <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
                        <span className="mr-auto text-xs text-muted-foreground">
                            {t('review.taking_over', { count: takenOver.length, total: changes.length })}
                        </span>
                        <Button asChild variant="ghost" className="text-muted-foreground">
                            <Link href={next}>{t('review.skip')}</Link>
                        </Button>
                        <RejectPopover improvementId={improvement.id} reasons={options.rejectionReasons} />
                        <Button className="cursor-pointer" disabled={processing || takenOver.length === 0} onClick={approve}>
                            {t('review.approve')}
                        </Button>
                    </footer>
                )}
            </div>
        </AppLayout>
    );
}

/** Inline editing of one change group, with the controls the add flow uses. */
function GroupEditor({
    group,
    draft,
    update,
    options,
}: {
    group: ChangeGroup;
    draft: ImprovementValues;
    update: (values: Partial<ImprovementValues>) => void;
    options: PageProps['options'];
}) {
    const { t } = useTranslation('backend/improvements');
    const { t: tContribute } = useTranslation('frontend/map/contribute');

    if (group === 'location') {
        return (
            <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                    {(['latitude', 'longitude'] as const).map((field) => (
                        <div key={field} className="grid gap-1">
                            <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                                {t(`review.${field}`)}
                            </Label>
                            <Input
                                id={`edit-${field}`}
                                type="number"
                                step="0.0000001"
                                value={draft[field]}
                                onChange={(event) => update({ [field]: Number(event.target.value) })}
                            />
                        </div>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">{t('review.drag_hint')}</span>
            </div>
        );
    }

    if (group === 'orientation') {
        return (
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draft.orientation ?? ''}
                onValueChange={(value) => value && update({ orientation: value })}
                className="justify-start"
            >
                {options.orientations.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        );
    }

    if (group === 'description') {
        return (
            <Textarea
                rows={3}
                maxLength={500}
                value={draft.description ?? ''}
                onChange={(event) => update({ description: event.target.value || null })}
            />
        );
    }

    const minutes = draft.parking_time ?? 0;

    return (
        <div className="grid gap-3">
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draft.under_sign ?? ''}
                onValueChange={(value) => value && update({ under_sign: value as 'yes' | 'no' })}
                className="justify-start"
            >
                {options.underSign.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {draft.under_sign === 'yes' && (
                <>
                    <Input
                        aria-label={tContribute('details.under_sign.text_label')}
                        placeholder={tContribute('details.under_sign.text_placeholder')}
                        maxLength={255}
                        value={draft.under_sign_text ?? ''}
                        onChange={(event) => update({ under_sign_text: event.target.value || null })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        {(['hours', 'minutes'] as const).map((unit) => (
                            <div key={unit} className="grid gap-1">
                                <Label htmlFor={`edit-${unit}`} className="text-xs text-muted-foreground">
                                    {tContribute(`details.under_sign.${unit}`)}
                                </Label>
                                <Input
                                    id={`edit-${unit}`}
                                    type="number"
                                    min={0}
                                    max={unit === 'hours' ? 24 : 59}
                                    value={unit === 'hours' ? Math.floor(minutes / 60) || '' : minutes % 60 || ''}
                                    onChange={(event) => {
                                        const value = Number(event.target.value || 0);
                                        const total = unit === 'hours' ? value * 60 + (minutes % 60) : Math.floor(minutes / 60) * 60 + value;
                                        update({ parking_time: total || null });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <ToggleGroup
                        type="multiple"
                        variant="outline"
                        size="sm"
                        value={draft.restriction_days ?? []}
                        onValueChange={(days) => update({ restriction_days: days.length ? days : null })}
                        aria-label={tContribute('details.under_sign.applies')}
                        className="justify-start"
                    >
                        {options.restrictionDays.map((day) => (
                            <ToggleGroupItem key={day} value={day}>
                                {tContribute(`days.${day}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <div className="grid grid-cols-2 gap-2">
                        {(['restriction_starts_at', 'restriction_ends_at'] as const).map((field) => (
                            <div key={field} className="grid gap-1">
                                <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                                    {tContribute(`details.under_sign.${field === 'restriction_starts_at' ? 'from' : 'until'}`)}
                                </Label>
                                <Input
                                    id={`edit-${field}`}
                                    type="time"
                                    value={draft[field] ?? ''}
                                    onChange={(event) => update({ [field]: event.target.value || null })}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function RejectPopover({ improvementId, reasons }: { improvementId: number; reasons: EnumOption[] }) {
    const { t } = useTranslation('backend/improvements');
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const reject = () =>
        router.post(
            app.improvements.reject.url({ improvement: improvementId }),
            { reason, note },
            { onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: () => setOpen(false) },
        );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="cursor-pointer">
                    {t('review.reject')}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="flex w-80 flex-col gap-3">
                <div>
                    <h2 className="text-sm font-semibold">{t('reject.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('reject.description')}</p>
                </div>
                <fieldset className="flex flex-col gap-0.5">
                    <legend className="sr-only">{t('reject.reason')}</legend>
                    {reasons.map((option) => (
                        <label
                            key={option.value}
                            className={cn(
                                'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-muted',
                                reason === option.value && 'bg-muted font-medium',
                            )}
                        >
                            <input
                                type="radio"
                                name="reason"
                                value={option.value}
                                checked={reason === option.value}
                                onChange={() => setReason(option.value)}
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
                <div className="grid gap-1.5">
                    <Label htmlFor="reject-note" className="text-xs text-muted-foreground">
                        {t('reject.note')}
                    </Label>
                    <Input id="reject-note" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        {t('reject.cancel')}
                    </Button>
                    <Button variant="destructive" className="cursor-pointer" disabled={!reason || processing} onClick={reject}>
                        {t('reject.confirm')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
