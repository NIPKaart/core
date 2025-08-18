import { cn } from '@/lib/utils';
import { NotificationItem } from '@/types';
import { Link, router } from '@inertiajs/react';
import { isToday, isYesterday } from 'date-fns';
import { BellRing, Check, ChevronRight, Inbox, Landmark, MapPin } from 'lucide-react';
import { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type NotificationsMenuProps = {
    items: NotificationItem[];
    loading?: boolean;
    onMarkOne: (id: string) => void;
};

const getStr = (v: unknown) => (typeof v === 'string' ? v : undefined);

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    'community.spot_submitted': MapPin,
    'community.spot_status_changed': Landmark,
    default: BellRing,
};

function useI18nDates(ns = 'global/notification') {
    const { t, i18n } = useTranslation(ns);

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
        const key = labeler(d);
        (groups[key] ??= []).push(n);
    }
    return groups;
}

function SkeletonRow() {
    return (
        <div className="relative overflow-hidden rounded-xl border bg-card p-3">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-[linear-gradient(110deg,transparent,rgba(0,0,0,.04),transparent)]" />
            <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-muted" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="h-3 w-10 rounded bg-muted" />
            </div>
        </div>
    );
}

function Row({ n, onMarkOne }: { n: NotificationItem; onMarkOne: (id: string) => void }) {
    const { t, timeAgo } = useI18nDates('global/notification');
    const url = getStr(n.data?.url);
    const spotLabel = getStr(n.data?.params?.spot_label);

    const unread = !n.read_at;

    const rawType = n.type ?? n.data?.type ?? 'default';
    const Icon = TYPE_ICON[rawType] ?? TYPE_ICON.default;

    const title = t(`types.${rawType}`, { defaultValue: t('types.default') });

    const handleLinkClick: React.MouseEventHandler<Element> = () => {
        if (unread) onMarkOne(n.id);
    };
    const handleDivClick: React.MouseEventHandler<HTMLDivElement> = () => {
        if (unread) onMarkOne(n.id);
    };

    const commonClassName = cn(
        'group relative block rounded-xl border p-3 transition',
        'bg-card hover:border-accent/50 hover:bg-accent/40',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
    );

    const inner = (
        <>
            <span aria-hidden className={cn('absolute top-2 left-2 h-2 w-2 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} />
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
                <div
                    className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-md',
                        unread ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                >
                    <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                    <div className="flex items-start gap-2 pr-8">
                        <span className={cn('truncate text-sm leading-5', unread && 'font-semibold')}>{title}</span>
                    </div>

                    {n.created_at && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">
                            <time dateTime={n.created_at} title={new Date(n.created_at).toLocaleString()} aria-label={timeAgo(n.created_at)}>
                                {timeAgo(n.created_at)}
                            </time>
                        </div>
                    )}
                    {spotLabel && <div className="truncate text-xs text-muted-foreground">{spotLabel}</div>}

                    <div className="mt-2 hidden items-center gap-2 text-xs text-muted-foreground group-hover:flex sm:mt-1">
                        {unread && (
                            <button
                                type="button"
                                className="cursor-pointer rounded-md border bg-background px-2 py-1 hover:bg-muted"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onMarkOne(n.id);
                                }}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" />
                                    {t('actions.markRead')}
                                </span>
                            </button>
                        )}
                        {url && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 hover:bg-muted"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.visit(url);
                                }}
                            >
                                {t('actions.open')}
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-0.5 flex items-center">
                    {n.created_at && (
                        <time
                            className="hidden text-[11px] text-muted-foreground sm:inline"
                            dateTime={n.created_at}
                            title={new Date(n.created_at).toLocaleString()}
                            aria-label={timeAgo(n.created_at)}
                        >
                            {timeAgo(n.created_at)}
                        </time>
                    )}
                    {unread && (
                        <button
                            type="button"
                            className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
                            aria-label={t('actions.markRead')}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onMarkOne(n.id);
                            }}
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </>
    );

    return url ? (
        <Link href={url} onClick={handleLinkClick} className={commonClassName}>
            {inner}
        </Link>
    ) : (
        <div onClick={handleDivClick} className={commonClassName}>
            {inner}
        </div>
    );
}

export function NotificationsMenu({ items, loading = false, onMarkOne }: NotificationsMenuProps) {
    const { t, relDayLabel } = useI18nDates('global/notification');
    const groups = useMemo(() => groupByDay(items, (d) => relDayLabel(d)), [items, relDayLabel]);

    const EmptyState = (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-card">
                <Inbox className="h-5 w-5" />
            </div>
            <div className="text-base font-medium text-foreground">{t('empty.title')}</div>
            <div className="max-w-xs text-xs">{t('empty.subtitle')}</div>
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-2 p-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
            </div>
        );
    }

    if (items.length === 0) {
        return <div className="max-h-[70vh] overflow-auto">{EmptyState}</div>;
    }

    return (
        <div className="max-h-[70vh] overflow-auto">
            <div className="space-y-4 p-3">
                {Object.entries(groups).map(([label, arr]) => (
                    <Fragment key={label}>
                        <div className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
                        <ul className="space-y-2">
                            {arr.map((n) => (
                                <li key={n.id}>
                                    <Row n={n} onMarkOne={onMarkOne} />
                                </li>
                            ))}
                        </ul>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
