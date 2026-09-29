import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { CircleCheck, ExternalLink, Flag, Landmark, MapPinned } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ReportedPlace = {
    key: string;
    source: 'community' | 'municipal';
    id: string;
    street: string | null;
    municipality: string | null;
    latitude: number;
    longitude: number;
    published: boolean;
    first_reported_at: string;
    last_reported_at: string;
    reports: { id: number; reporter: string | null; note: string | null; reported_at: string }[];
    confirmations_since_report: number;
    last_confirmed_at: string | null;
};

type PageProps = {
    places: ReportedPlace[];
    options: { removalReasons: { value: string; label: string; description: string }[] };
};

const NOTE_MAX_LENGTH = 1000;

export default function Index({ places, options }: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/reports');
    const { can } = useAuthorization();
    const [removing, setRemoving] = useState<ReportedPlace | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('title'), href: app.reports.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('title')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="mt-1 max-w-3xl text-muted-foreground">{t('description')}</p>
                </div>

                {places.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                        <CircleCheck className="h-8 w-8 text-green-600" aria-hidden />
                        <p className="font-medium">{t('empty.title')}</p>
                        <p className="text-sm text-muted-foreground">{t('empty.description')}</p>
                    </div>
                ) : (
                    <ul className="grid gap-4 xl:grid-cols-2">
                        {places.map((place) => (
                            <li key={place.key}>
                                <ReportedPlaceCard
                                    place={place}
                                    canResolve={can('parking-place-report.resolve')}
                                    onRemove={() => setRemoving(place)}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {removing && (
                <RemoveDialog
                    place={removing}
                    reasons={options.removalReasons}
                    onClose={() => setRemoving(null)}
                    cancelLabel={tGlobal('common.cancel')}
                />
            )}
        </AppLayout>
    );
}

function ReportedPlaceCard({ place, canResolve, onRemove }: { place: ReportedPlace; canResolve: boolean; onRemove: () => void }) {
    const { t } = useResourceTranslation('backend/reports');
    const ago = useAgo();
    const [keeping, setKeeping] = useState(false);
    const SourceIcon = place.source === 'community' ? MapPinned : Landmark;
    const mapUrl = `/map#19/${place.latitude.toFixed(5)}/${place.longitude.toFixed(5)}`;

    const keep = () =>
        router.post(
            app.reports.keep({ source: place.source, id: place.id }),
            {},
            { preserveScroll: true, onStart: () => setKeeping(true), onFinish: () => setKeeping(false) },
        );

    return (
        <Card className="h-full gap-4">
            <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                        <SourceIcon className="h-3.5 w-3.5" aria-hidden />
                        {t(`sources.${place.source}`)}
                    </Badge>
                    {!place.published && <Badge variant="secondary">{t('not_public')}</Badge>}
                </div>
                <CardTitle className="text-lg">{place.street?.trim() || t('no_address')}</CardTitle>
                {place.municipality && <p className="-mt-1 text-sm text-muted-foreground">{place.municipality}</p>}
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{t('signals.reports')}</dt>
                        <dd className="mt-0.5 font-semibold">
                            <Flag className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-orange-500" aria-hidden />
                            {t('signals.report_count', { count: place.reports.length })}
                        </dd>
                        <dd className="text-xs text-muted-foreground">{t('signals.first_reported', { ago: ago(place.first_reported_at) })}</dd>
                    </div>
                    <div
                        className={`rounded-md border px-3 py-2 ${place.confirmations_since_report > 0 ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/60' : ''}`}
                    >
                        <dt className="text-xs text-muted-foreground">{t('signals.confirmations_since')}</dt>
                        <dd className="mt-0.5 font-semibold">{t('signals.confirmation_count', { count: place.confirmations_since_report })}</dd>
                        <dd className="text-xs text-muted-foreground">
                            {place.last_confirmed_at
                                ? t('signals.last_confirmed', { ago: ago(place.last_confirmed_at) })
                                : t('signals.never_confirmed')}
                        </dd>
                    </div>
                </dl>

                <div>
                    <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('notes.title')}</h3>
                    <ul className="flex flex-col gap-2">
                        {place.reports.map((report) => (
                            <li key={report.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                                {report.note ? <p>“{report.note}”</p> : <p className="text-muted-foreground italic">{t('notes.none')}</p>}
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {report.reporter ?? t('notes.unknown_reporter')} · {ago(report.reported_at)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>

            <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={mapUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 underline underline-offset-2">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {t('actions.map')}
                    </a>
                    {place.source === 'community' && (
                        <Link href={app.parkingSpaces.show({ parking_space: place.id })} className="underline underline-offset-2">
                            {t('actions.details')}
                        </Link>
                    )}
                </div>
                {canResolve && (
                    <div className="flex gap-2">
                        <Button variant="outline" className="cursor-pointer" disabled={keeping} onClick={keep}>
                            {t('actions.keep')}
                        </Button>
                        <Button variant="destructive" className="cursor-pointer" onClick={onRemove}>
                            {t(`actions.remove.${place.source}`)}
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}

function RemoveDialog({
    place,
    reasons,
    onClose,
    cancelLabel,
}: {
    place: ReportedPlace;
    reasons: PageProps['options']['removalReasons'];
    onClose: () => void;
    cancelLabel: string;
}) {
    const { t } = useResourceTranslation('backend/reports');
    const form = useForm({ reason: 'no_longer_exists', note: '' });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.submit(app.reports.remove({ source: place.source, id: place.id }), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{t(`remove.${place.source}.title`)}</DialogTitle>
                        <DialogDescription>{t(`remove.${place.source}.description`)}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="removal-reason">{t('remove.reason')}</Label>
                        <Select value={form.data.reason} onValueChange={(value) => form.setData('reason', value)}>
                            <SelectTrigger id="removal-reason" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {reasons.map((reason) => (
                                    <SelectItem key={reason.value} value={reason.value}>
                                        {reason.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.reason} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="removal-note">
                            {t('remove.note')} <span className="font-normal text-muted-foreground">{t('remove.optional')}</span>
                        </Label>
                        <Textarea
                            id="removal-note"
                            rows={3}
                            maxLength={NOTE_MAX_LENGTH}
                            value={form.data.note}
                            onChange={(event) => form.setData('note', event.target.value)}
                            aria-invalid={!!form.errors.note}
                        />
                        <InputError message={form.errors.note} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {cancelLabel}
                        </Button>
                        <Button type="submit" variant="destructive" disabled={form.processing}>
                            {t(`remove.${place.source}.confirm`)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Relative time in the interface language, e.g. "3 dagen geleden". */
function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}
