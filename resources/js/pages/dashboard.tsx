import { show as importShow, index as municipalImports } from '@/actions/App/Http/Controllers/Admin/DatasetImportController';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import app from '@/routes/app';
import locationMap from '@/routes/location-map';
import notifications from '@/routes/notifications';
import profile from '@/routes/profile';
import type { SharedData } from '@/types';
import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { ArrowRight, Building, Check, Flag, Heart, Inbox, Pencil, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ItemType = 'submission' | 'improvement' | 'report';

type Todo = {
    moderation: { total: number; high: number; types: Partial<Record<ItemType, number>>; oldest: string | null } | null;
    sources: { total: number; items: { id: number; name: string; status: string; import_id: number | null; since: string | null }[] };
};

type ActivityEvent = {
    key: string;
    kind: string;
    at: string;
    unread: boolean;
    url: string | null;
    params: { space_label?: string | null; status?: string; new_status?: string; reason?: string; changes?: string[] };
};

type Favorite = {
    favorite_id: number;
    available: boolean;
    type: string;
    title: string;
    city: string | null;
    municipality: { name: string } | null;
    map_url: string | null;
};

type PageProps = {
    hasTodo: boolean;
    todo?: Todo;
    activity?: ActivityEvent[];
    stats: { added: number; published: number; pending: number; confirmed: number };
    favorites: Favorite[];
};

/**
 * The page people land on after signing in: what waits for them, what happened to their own contributions and their
 * saved places. One bordered list for the work; everything else is plain sections.
 */
export default function Dashboard({ hasTodo, todo, activity, stats, favorites }: PageProps) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const { auth } = usePage<SharedData>().props;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const today = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

    return (
        <AppLayout breadcrumbs={[{ title: t('title'), href: dashboard() }]}>
            <Head title={t('title')} />
            <div className="flex w-full flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{t(`greeting.${greeting}`, { name: auth.user.name.split(' ')[0] })}</h1>
                        <p className="text-sm text-muted-foreground first-letter:uppercase">{today}</p>
                    </div>
                    <Button asChild className="bg-orange-700 text-white hover:bg-orange-600">
                        <Link href={locationMap.add()}>
                            <Plus />
                            {t('add_location')}
                        </Link>
                    </Button>
                </header>

                {hasTodo && (
                    <Deferred data="todo" fallback={<TodoSkeleton />}>
                        <TodoList todo={todo} />
                    </Deferred>
                )}

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-12">
                    <div className="flex min-w-0 flex-col gap-10">
                        <section aria-labelledby="activity-title">
                            <SectionHeading id="activity-title" title={t('activity.title')} href={notifications.index()} link={t('activity.all')} />
                            <Deferred data="activity" fallback={<ActivitySkeleton />}>
                                {activity && <ActivityTimeline events={activity} />}
                            </Deferred>
                        </section>

                        <section aria-labelledby="favorites-title">
                            <SectionHeading
                                id="favorites-title"
                                title={t('favorites.title')}
                                href={profile.favorites.index()}
                                link={t('favorites.all')}
                            />
                            {favorites.length === 0 ? (
                                <p className="border-t py-4 text-sm text-muted-foreground">{t('favorites.empty')}</p>
                            ) : (
                                <ul>
                                    {favorites.map((favorite) => (
                                        <li
                                            key={favorite.favorite_id}
                                            className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 border-t py-3 text-sm sm:grid-cols-[1rem_minmax(0,1fr)_9rem_auto]"
                                        >
                                            <Heart className="size-4 fill-rose-600 text-rose-600" aria-hidden />
                                            <span className="min-w-0 truncate">
                                                <span className="font-medium">{favorite.title || t('favorites.untitled')}</span>
                                                {(favorite.city ?? favorite.municipality?.name) && (
                                                    <span className="text-muted-foreground"> · {favorite.city ?? favorite.municipality?.name}</span>
                                                )}
                                            </span>
                                            <span className="hidden text-muted-foreground sm:block">{t(`favorites.sources.${favorite.type}`)}</span>
                                            {favorite.map_url ? (
                                                <a
                                                    href={favorite.map_url}
                                                    className="justify-self-end text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                                >
                                                    {t('favorites.view_on_map')}
                                                </a>
                                            ) : (
                                                <span className="justify-self-end text-muted-foreground">{t('favorites.unavailable')}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <aside aria-labelledby="stats-title" className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                        <h2 id="stats-title" className="mb-3 text-sm font-semibold">
                            {t('stats.title')}
                        </h2>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                            {(['added', 'published', 'pending', 'confirmed'] as const).map((key) => (
                                <div key={key}>
                                    <dt className="text-sm text-muted-foreground">{t(`stats.${key}`)}</dt>
                                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{stats[key]}</dd>
                                </div>
                            ))}
                        </dl>
                        <Link
                            href={profile.parkingSpaces.index()}
                            className="mt-3 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            {t('stats.my_locations')}
                        </Link>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function SectionHeading({ id, title, href, link }: { id: string; title: string; href: Parameters<typeof Link>[0]['href']; link: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 pb-3">
            <h2 id={id} className="text-sm font-semibold">
                {title}
            </h2>
            <Link href={href} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                {link}
            </Link>
        </div>
    );
}

function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}

/** Work that waits for this person, each row with one action. Hidden for people without such work. */
function TodoList({ todo }: { todo?: Todo }) {
    const { t, i18n } = useTranslation('backend/dashboard');
    const ago = useAgo();
    if (!todo || (todo.moderation === null && todo.sources.total === 0)) return null;

    const moderation = todo.moderation;
    const details = moderation
        ? [
              (['submission', 'improvement', 'report'] as const)
                  .filter((type) => moderation.types[type])
                  .map((type) => t(`todo.types.${type}`, { count: moderation.types[type] }))
                  .join(', '),
              moderation.oldest ? t('todo.oldest', { ago: ago(moderation.oldest) }) : null,
          ].filter(Boolean)
        : [];

    return (
        <section aria-labelledby="todo-title" className="flex flex-col gap-3">
            <h2 id="todo-title" className="text-sm font-semibold">
                {t('todo.title')}
            </h2>
            <ul className="divide-y rounded-lg border">
                {moderation && (
                    <TodoRow
                        icon={Inbox}
                        title={moderation.total ? t('todo.moderation', { count: moderation.total }) : t('todo.moderation_done')}
                        description={
                            moderation.total > 0 && (
                                <span className="text-sm text-muted-foreground">
                                    {moderation.high > 0 && (
                                        <>
                                            <Flag className="mr-1 inline size-3.5 -translate-y-px text-orange-500" aria-hidden />
                                            {t('todo.high', { count: moderation.high })} ·{' '}
                                        </>
                                    )}
                                    {details.join(' · ')}
                                </span>
                            )
                        }
                        action={
                            moderation.total > 0 && (
                                <TodoAction href={app.moderation.index()} primary>
                                    {t('todo.review')}
                                    <ArrowRight />
                                </TodoAction>
                            )
                        }
                    />
                )}
                {todo.sources.items.map((source) => (
                    <TodoRow
                        key={source.id}
                        icon={Building}
                        title={t(`todo.source.${source.status}`, { name: source.name })}
                        description={
                            source.since && (
                                <span className="text-sm text-muted-foreground">
                                    {t('todo.source.since', {
                                        date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(
                                            new Date(source.since),
                                        ),
                                    })}
                                </span>
                            )
                        }
                        action={
                            <TodoAction href={source.import_id ? importShow(source.import_id) : municipalImports({ query: { status: 'attention' } })}>
                                {t('todo.check')}
                            </TodoAction>
                        }
                    />
                ))}
                {todo.sources.total > todo.sources.items.length && (
                    <li className="px-5 py-3 text-sm">
                        <Link
                            href={municipalImports({ query: { status: 'attention' } })}
                            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            {t('todo.more_sources', { count: todo.sources.total - todo.sources.items.length })}
                        </Link>
                    </li>
                )}
            </ul>
        </section>
    );
}

function TodoRow({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: typeof Inbox;
    title: string;
    description: React.ReactNode;
    action: React.ReactNode;
}) {
    return (
        <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{title}</span>
                {description}
            </div>
            {action && <div className="col-start-2 sm:col-start-auto">{action}</div>}
        </li>
    );
}

function TodoAction({ href, primary = false, children }: { href: Parameters<typeof Link>[0]['href']; primary?: boolean; children: React.ReactNode }) {
    return (
        <Button asChild variant={primary ? 'default' : 'outline'}>
            <Link href={href}>{children}</Link>
        </Button>
    );
}

function TodoSkeleton() {
    return <div className="h-20 animate-pulse rounded-lg bg-muted" aria-hidden />;
}

const TONES = {
    positive: { className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', icon: Check },
    pending: { className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300', icon: Plus },
    negative: { className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', icon: X },
    improvement: { className: 'bg-muted text-muted-foreground', icon: Pencil },
    saved: { className: 'bg-muted text-muted-foreground', icon: Heart },
    neutral: { className: 'bg-muted text-muted-foreground', icon: Flag },
} as const;

/** How one event reads: its sentence, an optional detail and the tone of its marker. */
function useEventText() {
    const { t } = useTranslation('backend/dashboard');
    const { t: tNotification } = useTranslation('global/notification');
    const { t: tModeration, i18n } = useTranslation('backend/moderation');
    /** "Gewijzigd: vak en onderbord." for the change groups an approved improvement applied. */
    const changed = (groups?: string[]) =>
        groups?.length
            ? t('activity.changed', {
                  fields: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
                      groups.map((group) => tModeration(`groups.${group}`).toLowerCase()),
                  ),
              })
            : null;

    return (event: ActivityEvent): { text: string; detail: string | null; tone: keyof typeof TONES } => {
        const place = event.params.space_label || t('activity.unknown_place');
        const reason = event.params.reason ? tNotification('reason', { reason: tNotification(`reasons.${event.params.reason}`) }) : null;

        switch (event.kind) {
            case 'added': {
                const status = event.params.status ?? 'pending';
                return {
                    text: t('activity.added', { place }),
                    detail: t(`activity.status.${status}`),
                    tone: status === 'approved' ? 'positive' : status === 'rejected' ? 'negative' : 'pending',
                };
            }
            case 'proposed':
                return { text: t('activity.proposed', { place }), detail: null, tone: 'improvement' };
            case 'saved':
                return { text: t('activity.saved', { place }), detail: null, tone: 'saved' };
            case 'community.space_status_changed': {
                const status = event.params.new_status;
                return status === 'approved'
                    ? { text: t('activity.published', { place }), detail: t('activity.published_detail'), tone: 'positive' }
                    : status === 'rejected'
                      ? { text: t('activity.rejected', { place }), detail: null, tone: 'negative' }
                      : { text: t('activity.status_changed', { place }), detail: null, tone: 'neutral' };
            }
            case 'community.improvement_approved':
                return { text: t('activity.improvement_approved', { place }), detail: changed(event.params.changes), tone: 'positive' };
            case 'community.improvement_rejected':
                return { text: t('activity.improvement_rejected', { place }), detail: reason, tone: 'negative' };
            case 'report.place_kept':
                return { text: t('activity.report_kept', { place }), detail: t('activity.report_kept_detail'), tone: 'neutral' };
            case 'report.place_removed':
                return { text: t('activity.report_removed', { place }), detail: reason, tone: 'neutral' };
            case 'community.space_deleted':
                return { text: t('activity.deleted', { place }), detail: null, tone: 'negative' };
            case 'community.space_restored':
                return { text: t('activity.restored', { place }), detail: null, tone: 'positive' };
            default:
                return { text: place, detail: null, tone: 'neutral' };
        }
    };
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
    const { t } = useTranslation('backend/dashboard');
    const ago = useAgo();
    const describe = useEventText();

    if (events.length === 0) {
        return <p className="border-t py-4 text-sm text-muted-foreground">{t('activity.empty')}</p>;
    }

    return (
        <ol>
            {events.map((event, index) => {
                const { text, detail, tone } = describe(event);
                const { className, icon: Icon } = TONES[tone];
                const sentence = <span className={cn('text-sm', event.unread && 'font-medium')}>{text}</span>;

                return (
                    <li
                        key={event.key}
                        className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
                    >
                        {index < events.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px bg-border" aria-hidden />}
                        <span className={cn('flex size-8 items-center justify-center rounded-full', className)} aria-hidden>
                            <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5 pt-1.5">
                            {event.url ? (
                                <a href={event.url} className="hover:underline hover:underline-offset-4">
                                    {sentence}
                                </a>
                            ) : (
                                sentence
                            )}
                            {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
                            <time dateTime={event.at} className="text-xs text-muted-foreground sm:hidden">
                                {ago(event.at)}
                            </time>
                        </span>
                        <time dateTime={event.at} className="hidden pt-1.5 text-xs whitespace-nowrap text-muted-foreground sm:block" aria-hidden>
                            {ago(event.at)}
                        </time>
                    </li>
                );
            })}
        </ol>
    );
}

function ActivitySkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-hidden>
            {[0, 1, 2].map((row) => (
                <div key={row} className="flex animate-pulse items-center gap-3">
                    <span className="size-8 rounded-full bg-muted" />
                    <span className="h-3 w-2/3 rounded bg-muted" />
                </div>
            ))}
        </div>
    );
}
