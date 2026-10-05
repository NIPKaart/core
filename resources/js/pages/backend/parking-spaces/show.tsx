import LocationMarkerCard from '@/components/map/card-location-marker';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthorization } from '@/hooks/use-authorization';
import { useSpaceActionDialog } from '@/hooks/use-dialog-space-action';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, ParkingMunicipal, ParkingSpace, ParkingSpaceConfirmation, User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Flag, MoreHorizontal, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { StatusPill } from './parts';

type Option = { value: string; label: string; description: string };
type Contributor = User & { parking_spaces_count: number; published_spaces_count: number };
type HistoryEvent = { kind: 'added' | 'review' | 'improvement'; at: string; by: string | null; status?: string; reason?: string | null };

type PageProps = {
    parkingSpace: ParkingSpace & { user?: Contributor | null; open_reports_count: number; updated_at: string };
    selectOptions: { rejectionReasons: Option[]; orientation: Option[]; underSign: Option[]; confirmationStatuses: Option[] };
    nearbySpaces: ParkingSpace[];
    nearbyMunicipalSpaces: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
    openImprovement: { id: number; proposer: string | null; proposed_at: string; changes: string[] } | null;
    confirmations: { counts: Record<string, number>; total: number; recent: ParkingSpaceConfirmation[] };
    history: HistoryEvent[];
    mapUrl: string | null;
};

const CONFIRMATION_DOTS: Record<string, string> = { confirmed: 'bg-green-600', moved: 'bg-amber-600', unavailable: 'bg-red-600' };

/**
 * One community parking space for a moderator: what needs doing first, then where it is and what it says, with who added
 * it, what visitors confirmed and what happened to it beside that.
 */
export default function Show({
    parkingSpace: space,
    selectOptions,
    nearbySpaces,
    nearbyMunicipalSpaces,
    openImprovement,
    confirmations,
    history,
    mapUrl,
}: PageProps) {
    const { t, tGlobal } = useResourceTranslation('backend/parking/main');
    const { t: tModeration, i18n } = useTranslation('backend/moderation');
    const { can } = useAuthorization();
    const { openDialog, dialogElement } = useSpaceActionDialog();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;
    const ago = (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
    const moment = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(parseISO(value));
    const label = (options: Option[], value?: string | null) => options.find((option) => option.value === value)?.label ?? value;
    const copy = (value: string) => {
        navigator.clipboard.writeText(value);
        toast.success(t('show.toast.copied'));
    };

    const coordinates = `${space.latitude.toFixed(5)}, ${space.longitude.toFixed(5)}`;
    const streetView = `https://www.google.com/maps?q=&layer=c&cbll=${space.latitude},${space.longitude}`;
    const hours = space.parking_time ? Math.floor(space.parking_time / 60) : 0;
    const minutes = space.parking_time ? space.parking_time % 60 : 0;
    const days = space.restriction_days?.map((day) => t(`days.${day}`)).join(', ');
    const times =
        space.restriction_starts_at && space.restriction_ends_at
            ? `${space.restriction_starts_at.slice(0, 5)}–${space.restriction_ends_at.slice(0, 5)}`
            : null;
    const changed = openImprovement?.changes.length
        ? new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
              openImprovement.changes.map((group) => tModeration(`groups.${group}`).toLowerCase()),
          )
        : null;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('breadcrumbs.index'), href: app.parkingSpaces.index() },
        { title: space.street, href: app.parkingSpaces.show({ parking_space: space.id }) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={space.street} />
            <div className="flex flex-col gap-7 px-4 py-6 sm:px-8 sm:py-7 lg:px-10">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                        <Link
                            href={app.parkingSpaces.index()}
                            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" aria-hidden />
                            {t('breadcrumbs.index')}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight">{space.street}</h1>
                            <StatusPill status={space.status} className="px-2.5 py-0.5" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {[[space.postcode, space.city].filter(Boolean).join(' '), space.province?.name, space.country?.name]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {can('parking-space.update') && (
                            <Button asChild variant="outline">
                                <Link href={app.parkingSpaces.edit({ parking_space: space.id })}>
                                    <PencilLine />
                                    {tGlobal('common.edit')}
                                </Link>
                            </Button>
                        )}
                        {mapUrl && (
                            <Button asChild variant="outline">
                                <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                                    {t('show.view_on_map')}
                                    <ExternalLink />
                                </a>
                            </Button>
                        )}
                        {(can('parking-space-confirmation.view_any') || can('parking-space.delete')) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label={t('show.more_actions')}>
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    {can('parking-space-confirmation.view_any') && (
                                        <DropdownMenuItem asChild className="cursor-pointer">
                                            <Link href={app.parkingSpaces.confirmations.index({ parking_space: space.id })}>
                                                {t('show.manage_confirmations')}
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    {can('parking-space.delete') && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="cursor-pointer text-destructive"
                                                onSelect={(event) => {
                                                    event.preventDefault();
                                                    openDialog('delete', space);
                                                }}
                                            >
                                                {t('index.move_to_trash')}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </header>

                {space.status === 'pending' && (
                    <Notice tone="pending" action={t('show.review')} href={app.moderation.submissions.show({ parking_space: space.id })}>
                        <span className="font-medium">{t('show.notice.pending', { ago: ago(space.created_at) })}</span>
                        {space.nearby_municipal_metres != null && (
                            <span className="text-amber-900 dark:text-amber-200">
                                {' '}
                                {t('show.notice.nearby', { distance: space.nearby_municipal_metres })}
                            </span>
                        )}
                    </Notice>
                )}
                {openImprovement && (
                    <Notice
                        tone="neutral"
                        icon={<PencilLine className="size-4" aria-hidden />}
                        action={t('show.review')}
                        href={app.moderation.improvements.show({ improvement: openImprovement.id })}
                    >
                        <span className="font-medium">
                            {t('show.notice.improvement', {
                                name: openImprovement.proposer ?? t('show.someone'),
                                ago: ago(openImprovement.proposed_at),
                            })}
                        </span>
                        {changed && <span className="text-muted-foreground"> {t('show.notice.changed', { fields: changed })}</span>}
                    </Notice>
                )}
                {space.open_reports_count > 0 && (
                    <Notice
                        tone="pending"
                        icon={<Flag className="size-4" aria-hidden />}
                        action={t('show.review')}
                        href={app.moderation.reports.show({ source: 'community', id: space.id })}
                    >
                        <span className="font-medium">{t('show.notice.reports', { count: space.open_reports_count })}</span>
                    </Notice>
                )}

                <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="flex min-w-0 flex-col gap-8">
                        <section aria-labelledby="location-title">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2.5">
                                <h2 id="location-title" className="text-sm font-semibold">
                                    {t('show.location')}
                                </h2>
                                <span className="flex gap-4 text-[13px]">
                                    <a
                                        href={streetView}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    >
                                        {t('show.street_view')}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copy(coordinates)}
                                        className="cursor-pointer text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    >
                                        {t('show.copy_coordinates')}
                                    </button>
                                </span>
                            </div>
                            <div className="relative">
                                <LocationMarkerCard
                                    latitude={space.latitude}
                                    longitude={space.longitude}
                                    nearbySpaces={nearbySpaces}
                                    nearbyMunicipalSpaces={nearbyMunicipalSpaces}
                                    scrollWheelZoom={false}
                                    className="h-80 md:h-[380px]"
                                />
                                <p className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-x-3.5 gap-y-1 rounded-md bg-background/95 px-2.5 py-1.5 text-xs shadow-sm">
                                    <Legend color="bg-[#2A81CB]" label={t('show.legend.this')} />
                                    {nearbyMunicipalSpaces.length > 0 && <Legend color="bg-[#9C2BCB]" label={t('show.legend.municipal')} />}
                                    {nearbySpaces.length > 0 && <Legend color="bg-[#2AAD27]" label={t('show.legend.community')} />}
                                </p>
                            </div>
                            <p className="mt-2.5 text-[13px] text-muted-foreground">
                                <span className="font-mono text-foreground">{coordinates}</span>
                            </p>
                        </section>

                        <section aria-labelledby="details-title">
                            <h2 id="details-title" className="text-sm font-semibold">
                                {t('show.details')}
                            </h2>
                            <SubHeading>{t('show.address')}</SubHeading>
                            <Fields>
                                <Field label={t('edit.form.labels.street')}>{space.street}</Field>
                                <Field label={t('edit.form.labels.postcode')}>{space.postcode}</Field>
                                <Field label={t('edit.form.labels.city')}>{space.city}</Field>
                                <Field label={t('show.area')}>{[space.suburb, space.neighbourhood].filter(Boolean).join(' · ')}</Field>
                                <Field label={t('edit.form.labels.municipality')}>{space.municipality?.name}</Field>
                                <Field label={t('show.region')}>{[space.province?.name, space.country?.name].filter(Boolean).join(' · ')}</Field>
                            </Fields>
                            <SubHeading>{t('show.parking')}</SubHeading>
                            <Fields>
                                <Field label={t('show.orientation')}>{label(selectOptions.orientation, space.orientation)}</Field>
                                <Field label={t('show.parking_time')}>
                                    {hours || minutes
                                        ? t('show.max_time', {
                                              time: [hours && `${hours} ${t('show.hours')}`, minutes && `${minutes} ${t('show.minutes')}`]
                                                  .filter(Boolean)
                                                  .join(' '),
                                          })
                                        : t('show.no_max')}
                                </Field>
                                <Field label={t('edit.form.labels.underSign')}>
                                    {space.under_sign
                                        ? [label(selectOptions.underSign, space.under_sign), space.under_sign_text && `“${space.under_sign_text}”`]
                                              .filter(Boolean)
                                              .join(' · ')
                                        : null}
                                </Field>
                                <Field label={t('edit.form.labels.restriction')}>{[days, times].filter(Boolean).join(', ')}</Field>
                                <Field label={t('show.nearby')}>{space.amenity}</Field>
                            </Fields>
                            {space.description && (
                                <>
                                    <SubHeading>{t('show.comment')}</SubHeading>
                                    <blockquote className="border-l-2 py-0.5 pl-3.5 text-sm text-foreground/80">{space.description}</blockquote>
                                </>
                            )}
                        </section>
                    </div>

                    <aside className="flex flex-col gap-7">
                        <section aria-labelledby="contributor-title">
                            <h2 id="contributor-title" className="pb-2.5 text-sm font-semibold">
                                {t('show.contributor')}
                            </h2>
                            {space.user ? (
                                <>
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted font-semibold">
                                            {space.user.name
                                                .split(' ')
                                                .map((part) => part[0])
                                                .slice(0, 2)
                                                .join('')
                                                .toUpperCase()}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{space.user.name}</span>
                                            {space.user.email && (
                                                <span className="truncate text-[13px] text-muted-foreground">{space.user.email}</span>
                                            )}
                                        </span>
                                    </div>
                                    <p className="mt-2.5 text-[13px] text-muted-foreground">
                                        {t('show.contributions', {
                                            since: new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
                                                parseISO(space.user.created_at),
                                            ),
                                            count: space.user.parking_spaces_count,
                                            published: space.user.published_spaces_count,
                                        })}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('index.removed_account')}</p>
                            )}
                        </section>

                        <section aria-labelledby="confirmations-title">
                            <div className="flex items-baseline justify-between pb-2.5">
                                <h2 id="confirmations-title" className="text-sm font-semibold">
                                    {t('show.confirmations')}
                                </h2>
                                {confirmations.total > 0 && can('parking-space-confirmation.view_any') && (
                                    <Link
                                        href={app.parkingSpaces.confirmations.index({ parking_space: space.id })}
                                        className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    >
                                        {t('show.all_confirmations', { count: confirmations.total })}
                                    </Link>
                                )}
                            </div>
                            {confirmations.total === 0 ? (
                                <p className="border-t py-3 text-sm text-muted-foreground">{t('show.no_confirmations')}</p>
                            ) : (
                                <>
                                    <dl className="grid grid-cols-3 rounded-lg border">
                                        {selectOptions.confirmationStatuses.map((status, index) => (
                                            <div key={status.value} className={cn('px-3 py-2.5', index > 0 && 'border-l')}>
                                                <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                                    <span
                                                        className={cn('size-[7px] shrink-0 rounded-full', CONFIRMATION_DOTS[status.value])}
                                                        aria-hidden
                                                    />
                                                    {status.label}
                                                </dt>
                                                <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                                                    {confirmations.counts[status.value] ?? 0}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <ul className="mt-1">
                                        {confirmations.recent.map((confirmation) => (
                                            <li
                                                key={confirmation.id}
                                                className="grid grid-cols-[0.5rem_minmax(0,1fr)_auto] gap-2.5 border-b py-2.5 text-sm last:border-b-0"
                                            >
                                                <span
                                                    className={cn('mt-1.5 size-2 rounded-full', CONFIRMATION_DOTS[confirmation.status])}
                                                    aria-hidden
                                                />
                                                <span className="min-w-0">
                                                    <span className="block truncate">{confirmation.user?.name ?? t('show.someone')}</span>
                                                    {confirmation.comment && (
                                                        <span className="block text-[13px] text-muted-foreground">“{confirmation.comment}”</span>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{ago(confirmation.confirmed_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>

                        <section aria-labelledby="history-title">
                            <h2 id="history-title" className="pb-3 text-sm font-semibold">
                                {t('show.history.title')}
                            </h2>
                            <ol className="ml-1 flex flex-col gap-4 border-l pl-5">
                                {history.map((event, index) => (
                                    <li key={`${event.kind}-${index}`} className="relative text-sm">
                                        <span
                                            className={cn(
                                                'absolute top-1.5 -left-[25px] size-[9px] rounded-full',
                                                event.kind === 'review' && event.status === 'approved' && 'bg-green-600',
                                                event.kind === 'review' && event.status === 'rejected' && 'bg-red-600',
                                                event.kind === 'review' && event.status === 'pending' && 'bg-amber-600',
                                                event.kind !== 'review' && 'bg-muted-foreground/50',
                                            )}
                                            aria-hidden
                                        />
                                        <span className="block">
                                            {event.kind === 'review'
                                                ? t(`show.history.review.${event.status}`, { name: event.by ?? t('show.someone') })
                                                : t(`show.history.${event.kind}`, { name: event.by ?? t('show.someone') })}
                                            {event.kind === 'improvement' && event.status !== 'pending' && (
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    · {t(`show.history.improvement_status.${event.status}`)}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {[moment(event.at), event.reason && label(selectOptions.rejectionReasons, event.reason)]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section aria-labelledby="technical-title">
                            <h2 id="technical-title" className="pb-1.5 text-sm font-semibold">
                                {t('show.technical')}
                            </h2>
                            <dl className="text-[13px]">
                                <TechnicalRow
                                    label="ID"
                                    value={space.id}
                                    display={`${space.id.slice(0, 8)}…${space.id.slice(-7)}`}
                                    onCopy={copy}
                                    copyLabel={t('show.copy', { what: 'ID' })}
                                />
                                {space.ip_address && (
                                    <TechnicalRow
                                        label={t('show.ip_address')}
                                        value={space.ip_address}
                                        onCopy={copy}
                                        copyLabel={t('show.copy', { what: t('show.ip_address') })}
                                    />
                                )}
                                <div className="flex items-center justify-between gap-3 border-y py-2">
                                    <dt className="text-muted-foreground">{t('show.updated')}</dt>
                                    <dd>{moment(space.updated_at)}</dd>
                                </div>
                            </dl>
                        </section>
                    </aside>
                </div>
            </div>
            {dialogElement}
        </AppLayout>
    );
}

/** One thing that waits on this parking space, with the button that opens it in moderation. */
function Notice({
    tone,
    icon,
    action,
    href,
    children,
}: {
    tone: 'pending' | 'neutral';
    icon?: ReactNode;
    action: string;
    href: Parameters<typeof Link>[0]['href'];
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center',
                tone === 'pending' ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/60' : 'bg-muted/40',
            )}
        >
            {icon && <span className="hidden size-8 shrink-0 items-center justify-center rounded-md border bg-background sm:flex">{icon}</span>}
            <p className="flex-1">{children}</p>
            <Button asChild size="sm">
                <Link href={href}>
                    {action}
                    <ArrowRight />
                </Link>
            </Button>
        </div>
    );
}

function Legend({ color, label }: { color: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', color)} aria-hidden />
            {label}
        </span>
    );
}

function SubHeading({ children }: { children: ReactNode }) {
    return <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-3">{children}</h3>;
}

function Fields({ children }: { children: ReactNode }) {
    return <dl className="grid gap-x-8 text-sm sm:grid-cols-2">{children}</dl>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-t py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="wrap-break-word">{children || <span className="text-muted-foreground">—</span>}</dd>
        </div>
    );
}

function TechnicalRow({
    label,
    value,
    display,
    onCopy,
    copyLabel,
}: {
    label: string;
    value: string;
    display?: string;
    onCopy: (value: string) => void;
    copyLabel: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-t py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-1 font-mono text-xs">
                {display ?? value}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={() => onCopy(value)}
                    aria-label={copyLabel}
                >
                    <Copy className="size-3.5" />
                </Button>
            </dd>
        </div>
    );
}
