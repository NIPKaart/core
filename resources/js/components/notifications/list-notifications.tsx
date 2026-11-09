import LocalizedDateTime from '@/components/localized-date-time';
import { cn } from '@/lib/utils';
import { NotificationItem } from '@/types';
import { getNotificationLabel } from '@/utils/notifications';
import { translateSourceValue } from '@/utils/translation';
import { Link, router } from '@inertiajs/react';
import { isToday, isYesterday } from 'date-fns';
import { BellRing, Check, CheckCheck, Database, FileSearch, Inbox, MapPin, Megaphone, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type NotificationsListProps = {
    items: NotificationItem[];
    loading?: boolean;
    /** True when only unread notifications are listed, so an empty list means everything has been read. */
    caughtUp?: boolean;
    onMarkOne: (id: string) => void;
    onOpen?: (id: string, url: string) => void;
};

const getStr = (v: unknown) => (typeof v === 'string' ? v : undefined);

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    'community.space_submitted': MapPin,
    'community.space_status_changed': Pencil,
    'community.space_deleted': Trash2,
    'community.space_deleted_by_user': Trash2,
    'community.space_restored': RotateCcw,
    'community.improvement_approved': Check,
    'community.improvement_rejected': Pencil,
    'report.place_kept': MapPin,
    'report.place_removed': Trash2,
    'dataset.source_awaiting_approval': Database,
    'dataset.source_awaiting_reapproval': RefreshCw,
    'dataset.import_ready_for_review': FileSearch,
    'system.announcement': Megaphone,
    default: BellRing,
};

type Tone = 'data' | 'place' | 'positive' | 'neutral';

/** Colours the icon tile by what a notification is about, so a long list can be scanned by kind. */
const TYPE_TONE: Record<string, Tone> = {
    'community.space_submitted': 'place',
    'community.space_restored': 'place',
    'community.improvement_approved': 'positive',
    'report.place_kept': 'positive',
    'dataset.source_awaiting_approval': 'data',
    'dataset.source_awaiting_reapproval': 'data',
    'dataset.import_ready_for_review': 'data',
};

const TONE_CLASS: Record<Tone, string> = {
    data: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    place: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    positive: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    neutral: 'bg-muted text-foreground/70',
};

function useI18nDates() {
    const { t, i18n } = useTranslation('global/notification');

    const dateFmt = useMemo(
        () =>
            new Intl.DateTimeFormat(i18n.language, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
        [i18n.language],
    );

    const relDayLabel = useCallback(
        (d: Date) => {
            if (isToday(d)) return t('relative.today');
            if (isYesterday(d)) return t('relative.yesterday');
            return dateFmt.format(d);
        },
        [dateFmt, t],
    );

    const rtf = useMemo(() => new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }), [i18n.language]);

    const timeAgo = useCallback(
        (iso: string) => {
            const now = Date.now();
            const then = new Date(iso).getTime();

            const diff = Math.round((then - now) / 1000);
            const abs = Math.abs(diff);
            if (abs >= 86400) return rtf.format(Math.trunc(diff / 86400), 'day');
            if (abs >= 3600) return rtf.format(Math.trunc(diff / 3600), 'hour');
            if (abs >= 60) return rtf.format(Math.trunc(diff / 60), 'minute');
            return rtf.format(diff, 'second');
        },
        [rtf],
    );

    return { t, relDayLabel, timeAgo };
}

function groupByDay(items: NotificationItem[], labeler: (d: Date) => string) {
    const groups: Record<string, NotificationItem[]> = {};
    for (const n of items) {
        const d = n.created_at ? new Date(n.created_at) : new Date();
        (groups[labeler(d)] ??= []).push(n);
    }
    return groups;
}

function SkeletonRow() {
    return (
        <div className="grid animate-pulse grid-cols-[2.25rem_1fr_2.5rem] items-start gap-3 px-3 py-2.5">
            <div className="size-9 rounded-[10px] bg-muted" />
            <div className="space-y-2 pt-1">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-2.5 w-1/3 rounded bg-muted" />
            </div>
            <div className="mt-1 h-2.5 rounded bg-muted" />
        </div>
    );
}

function NotificationRow({
    n,
    onMarkOne,
    onOpen,
}: {
    n: NotificationItem;
    onMarkOne: (id: string) => void;
    onOpen?: (id: string, url: string) => void;
}) {
    const { t: tGlobal, timeAgo } = useI18nDates();

    const raw = (n.data ?? {}) as Record<string, unknown>;
    const url = getStr(raw.url);
    // What the notification is about: a data source or a community space.
    const subject = getStr(n.data?.params?.source_name) ?? getStr(n.data?.params?.space_label);
    // Why a moderator decided as they did, for example when rejecting an improvement.
    const reason = getStr(n.data?.params?.reason);

    const unread = !n.read_at;

    const rawType = (typeof n.type === 'string' && n.type) || (typeof raw.type === 'string' && (raw.type as string)) || 'default';

    const Icon = TYPE_ICON[rawType] ?? TYPE_ICON.default;
    const tone = TONE_CLASS[TYPE_TONE[rawType] ?? 'neutral'];

    const title = getNotificationLabel(tGlobal, rawType);

    const handleDivClick: React.MouseEventHandler<HTMLDivElement> = () => {
        if (unread) onMarkOne(n.id);
    };

    const handleOpen = (e: React.MouseEvent, targetUrl: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (onOpen) {
            onOpen(n.id, targetUrl);
        } else {
            if (unread) onMarkOne(n.id);
            router.visit(targetUrl);
        }
    };

    const commonClassName = cn(
        'grid grid-cols-[2.25rem_1fr_auto] items-start gap-3 rounded-[10px] px-3 py-2.5 transition-colors',
        'group-focus-within:bg-muted hover:bg-muted',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    );

    const time = n.created_at && <LocalizedDateTime value={n.created_at}>{timeAgo(n.created_at)}</LocalizedDateTime>;

    const inner = (
        <>
            <span aria-hidden className={cn('flex size-9 items-center justify-center rounded-[10px]', tone)}>
                <Icon className="size-[18px]" />
            </span>

            <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn('text-sm leading-5', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>{title}</span>
                {subject && <span className="line-clamp-2 text-[13px] leading-[18px] text-muted-foreground">{subject}</span>}
                {reason && (
                    <span className="mt-1 self-start rounded-md bg-muted px-2 py-0.5 text-xs leading-[18px] text-foreground/80">
                        {tGlobal('reason', { reason: translateSourceValue('global/notification', `reasons.${reason}`) })}
                    </span>
                )}
                {time && <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">{time}</span>}
            </span>

            <span
                className={cn(
                    'flex items-center gap-2 pt-0.5',
                    unread && 'max-sm:invisible sm:group-hover:invisible sm:group-has-[button:focus-visible]:invisible',
                )}
            >
                {time && <span className="hidden text-xs leading-4 text-muted-foreground sm:inline">{time}</span>}
                {unread && <span className="size-2 rounded-full bg-orange-600 dark:bg-orange-500" />}
                {unread && <span className="sr-only">{tGlobal('status.unread')}</span>}
            </span>
        </>
    );

    return (
        <li className="group relative">
            {url ? (
                <Link href={url} onClick={(e) => handleOpen(e, url)} className={commonClassName}>
                    {inner}
                </Link>
            ) : (
                <div onClick={handleDivClick} className={commonClassName}>
                    {inner}
                </div>
            )}
            {unread && (
                <button
                    type="button"
                    className={cn(
                        'absolute top-2.5 right-3 flex size-9 cursor-pointer items-center justify-center rounded-lg border bg-background text-foreground/80 hover:bg-muted hover:text-foreground sm:size-8',
                        'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    )}
                    aria-label={tGlobal('actions.markRead')}
                    title={tGlobal('actions.markRead')}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onMarkOne(n.id);
                    }}
                >
                    <Check className="size-4" />
                </button>
            )}
        </li>
    );
}

export function NotificationsList({ items, loading = false, caughtUp = false, onMarkOne, onOpen }: NotificationsListProps) {
    const { t, relDayLabel } = useI18nDates();
    const groups = useMemo(() => groupByDay(items, (d) => relDayLabel(d)), [items, relDayLabel]);

    if (loading) {
        return (
            <div className="p-2" aria-busy="true">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-12 items-center justify-center rounded-full',
                        caughtUp ? TONE_CLASS.positive : 'bg-muted text-muted-foreground',
                    )}
                >
                    {caughtUp ? <CheckCheck className="size-5" /> : <Inbox className="size-5" />}
                </span>
                <p className="text-[15px] font-semibold">{t(caughtUp ? 'empty.caughtUp' : 'empty.title')}</p>
            </div>
        );
    }

    return (
        <div className="max-h-[70vh] overflow-auto">
            <div className="px-2 pt-1 pb-2">
                {Object.entries(groups).map(([label, arr]) => (
                    <Fragment key={label}>
                        <h3 className="px-3 pt-3 pb-1 text-xs leading-4 font-medium text-muted-foreground">{label}</h3>
                        <ul>
                            {arr.map((n) => (
                                <NotificationRow key={n.id} n={n} onMarkOne={onMarkOne} onOpen={onOpen} />
                            ))}
                        </ul>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
