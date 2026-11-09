import DetailsStep from '@/components/contribute/details-step';
import { ContributionDetailsSummary } from '@/components/contribute/review-step';
import type { ContributionForm, OrientationOption } from '@/components/contribute/types';
import type { AerialLayer } from '@/components/map/aerial-imagery';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import app from '@/routes/app';
import type { RestrictionDay } from '@/types';
import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { nudge, NUDGE_METRES, type Direction, type MapPoint } from './geo';
import { ModerationMap } from './moderation-map';

type SourcePoint = MapPoint & { id: number };
type Bay = MapPoint & { source_point_id: number };
type Publication = Omit<ContributionForm, 'latitude' | 'longitude'> & { bays: Bay[] };
type Step = 'bays' | 'details' | 'check';

type Props = {
    proposal: number;
    points: SourcePoint[];
    comparison?: MapPoint;
    community?: MapPoint;
    municipal?: MapPoint;
    aerial?: AerialLayer;
    published: boolean;
    publishedBays: MapPoint[];
    orientations: OrientationOption[];
    restrictionDays: RestrictionDay[];
    maxBays: number;
    query: { municipality?: string | number; page?: number };
};

const DIRECTIONS: { key: Direction; symbol: string; label: 'north' | 'south' | 'west' | 'east' }[] = [
    { key: 'ArrowUp', symbol: '↑', label: 'north' },
    { key: 'ArrowDown', symbol: '↓', label: 'south' },
    { key: 'ArrowLeft', symbol: '←', label: 'west' },
    { key: 'ArrowRight', symbol: '→', label: 'east' },
];

export function ProposalBayEditor({
    proposal,
    points,
    comparison,
    community,
    municipal,
    aerial,
    published,
    publishedBays,
    orientations,
    restrictionDays,
    maxBays,
    query,
}: Props) {
    const { t } = useTranslation('backend/moderation');
    const [step, setStep] = useState<Step>('bays');
    const [sourceId, setSourceId] = useState(points[0].id);
    const [editing, setEditing] = useState<number | null>(null);
    const form = useForm<Publication>({
        bays: [],
        orientation: '',
        under_sign: '',
        under_sign_text: '',
        parking_hours: '',
        parking_minutes: '',
        restriction_days: [],
        restriction_starts_at: '',
        restriction_ends_at: '',
        description: '',
    });
    const { bays, ...details } = form.data;
    const source = points.find((point) => point.id === sourceId) ?? points[0];
    const canCheck = bays.length > 0 && details.orientation !== '' && details.under_sign !== '';

    const place = (point: MapPoint) => {
        if (form.processing || published || step !== 'bays') return;

        if (editing !== null) {
            form.setData(
                'bays',
                bays.map((bay, index) => (index === editing ? { ...bay, ...point } : bay)),
            );
            setEditing(null);
        } else if (bays.length < maxBays) {
            form.setData('bays', [...bays, { latitude: point.latitude, longitude: point.longitude, source_point_id: source.id }]);
        }
    };
    const remove = (index: number) => {
        form.setData(
            'bays',
            bays.filter((_, current) => current !== index),
        );
        setEditing(null);
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (step !== 'check' || !canCheck || published || form.processing) return;

        form.post(app.moderation.proposals.publish.url(proposal, { query }), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setEditing(null);
                setStep('bays');
            },
        });
    };

    return (
        <>
            <div className="relative h-80 overflow-hidden rounded-xl border">
                <ModerationMap
                    center={source}
                    layer="satellite"
                    aerial={aerial}
                    zoom={20}
                    fitNumbered={false}
                    numbered={bays}
                    nearby={community ? [community] : []}
                    municipal={municipal ? [municipal] : []}
                    sourcePoints={comparison ? [...points, comparison] : points}
                    publishedBays={publishedBays}
                    onMove={!published && step === 'bays' ? place : undefined}
                />
            </div>
            {published ? (
                <p role="status" className="rounded-lg border bg-muted p-3 text-sm font-medium">
                    {publishedBays.length ? t('proposals.added_count', { count: publishedBays.length }) : t('proposals.added')}
                </p>
            ) : (
                <form onSubmit={submit} className="space-y-3">
                    <h3 className="text-base font-semibold">{t(`proposals.steps.${step}`)}</h3>
                    {step === 'bays' && (
                        <>
                            <p className="text-sm text-muted-foreground">{t(editing === null ? 'proposals.draw_help' : 'proposals.move_help')}</p>
                            {points.length > 1 && (
                                <Select value={String(source.id)} onValueChange={(value) => setSourceId(Number(value))}>
                                    <SelectTrigger aria-label={t('proposals.source_point')}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {points.map((point, index) => (
                                            <SelectItem key={point.id} value={String(point.id)}>
                                                {t('proposals.source_point_number', { number: index + 1 })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                disabled={editing !== null || bays.length >= maxBays}
                                onClick={() => place(source)}
                            >
                                {t('proposals.add_at_source')}
                            </Button>
                        </>
                    )}
                    {(step === 'bays' || step === 'check') && (
                        <ol className="divide-y rounded-lg border">
                            {bays.map((bay, index) => (
                                <li key={index} className="space-y-2 p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <span className="font-medium">
                                            {t('proposals.bay_number', { number: index + 1 })} · {bay.latitude.toFixed(6)}, {bay.longitude.toFixed(6)}
                                        </span>
                                        {step === 'bays' ? (
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    aria-pressed={editing === index}
                                                    onClick={() => setEditing(editing === index ? null : index)}
                                                >
                                                    {t('proposals.move_bay')}
                                                </Button>
                                                <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)}>
                                                    {t('proposals.remove_bay')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={streetViewUrl(bay.latitude, bay.longitude) ?? undefined} target="_blank" rel="noreferrer">
                                                    Street View
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                    {step === 'bays' && editing === index && (
                                        <div className="flex gap-1">
                                            {DIRECTIONS.map(({ key, symbol, label }) => (
                                                <Button
                                                    key={key}
                                                    type="button"
                                                    size="icon"
                                                    variant="outline"
                                                    aria-label={t(`proposals.direction.${label}`)}
                                                    onClick={() =>
                                                        form.setData(
                                                            'bays',
                                                            bays.map((item, current) =>
                                                                current === index ? { ...item, ...nudge(item, key, NUDGE_METRES) } : item,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    {symbol}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                    {step === 'details' && (
                        <DetailsStep
                            data={{ ...details, latitude: null, longitude: null }}
                            setData={(key, value) => {
                                if (key !== 'latitude' && key !== 'longitude') form.setData((data) => ({ ...data, [key]: value }));
                            }}
                            errors={form.errors}
                            orientationOptions={orientations}
                            restrictionDays={restrictionDays}
                        />
                    )}
                    {step === 'check' && (
                        <>
                            <ContributionDetailsSummary
                                data={{ ...details, latitude: null, longitude: null }}
                                orientationOptions={orientations}
                                restrictionDays={restrictionDays}
                            />
                            <p className="text-sm text-muted-foreground">{t('proposals.verify_help')}</p>
                        </>
                    )}
                    {Object.keys(form.errors).length > 0 && (
                        <ul role="alert" className="space-y-1 text-sm text-destructive">
                            {Object.entries(form.errors).map(([key, error]) => (
                                <li key={key}>{error}</li>
                            ))}
                        </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {step !== 'bays' && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={form.processing}
                                onClick={() => setStep(step === 'check' ? 'details' : 'bays')}
                            >
                                {t('proposals.previous')}
                            </Button>
                        )}
                        {step === 'bays' && (
                            <Button
                                type="button"
                                disabled={bays.length === 0}
                                onClick={() => {
                                    setEditing(null);
                                    setStep('details');
                                }}
                            >
                                {t('proposals.steps.details')}
                            </Button>
                        )}
                        {step === 'details' && (
                            <Button type="button" disabled={!canCheck} onClick={() => setStep('check')}>
                                {t('proposals.steps.check')}
                            </Button>
                        )}
                        {step === 'check' && (
                            <Button type="submit" disabled={form.processing || !canCheck}>
                                {t('proposals.publish', { count: bays.length })}
                            </Button>
                        )}
                    </div>
                </form>
            )}
        </>
    );
}
