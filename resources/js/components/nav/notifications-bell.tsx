import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Bell, BellRing, Check, ChevronRight, Inbox, Landmark, MapPin, Warehouse } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NotificationItem = {
    id: string;
    type?: string;
    data?: Record<string, unknown>;
    read_at?: string | null;
    created_at?: string;
};

type PageProps = {
    auth?: { user?: { id: number } | null };
    notifications?: { unread: number; recent: NotificationItem[] };
};

const getStr = (v: unknown) => (typeof v === 'string' ? v : undefined);

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    community_spot_submitted: MapPin,
    community_spot_status_changed: Landmark,
    offstreet_status_update: Warehouse,
    default: BellRing,
};

function relDayLabel(date: Date) {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d', { locale: enUS });
}

function groupByDay(items: NotificationItem[]) {
    const groups: Record<string, NotificationItem[]> = {};
    for (const n of items) {
        const d = n.created_at ? new Date(n.created_at) : new Date();
        const key = relDayLabel(d);
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
    }
    return groups;
}

function titleFor(n: NotificationItem) {
    switch (n.type) {
        case 'community_spot_submitted':
            return 'New community spot submitted';
        case 'community_spot_status_changed':
            return 'Your spot status changed';
        case 'offstreet_status_update':
            return 'Garage/P+R status update';
        default:
            return n.type ?? 'Notification';
    }
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

type RowProps = {
    n: NotificationItem;
    onMarkRead: (id: string) => void;
};

function Row({ n, onMarkRead }: RowProps) {
    const url = getStr(n.data?.['url']);
    const spotLabel = getStr(n.data?.['spot_label']);
    const unread = !n.read_at;
    const Icon = TYPE_ICON[n.type ?? 'default'] ?? TYPE_ICON.default;

    const Wrapper: any = url ? Link : 'div';
    const wrapperProps = url ? { href: url } : {};

    const handleClick = useCallback(() => {
        if (unread && n.id && url) onMarkRead(n.id);
    }, [n.id, unread, url, onMarkRead]);

    return (
        <Wrapper
            {...(wrapperProps as any)}
            onClick={handleClick}
            className={cn(
                'group relative block rounded-xl border p-3 transition',
                'bg-card hover:border-accent/50 hover:bg-accent/40',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
            )}
        >
            {/* Unread dot */}
            <span aria-hidden className={cn('absolute top-2 left-2 h-2 w-2 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} />

            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
                {/* Leading icon */}
                <div
                    className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-md',
                        unread ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                >
                    <Icon className="h-4 w-4" />
                </div>

                {/* Text */}
                <div className="min-w-0">
                    <div className="flex items-start gap-2 pr-8">
                        <span className={cn('truncate text-sm leading-5', unread && 'font-semibold')}>{titleFor(n)}</span>
                    </div>
                    {spotLabel && <div className="truncate text-xs text-muted-foreground">{spotLabel}</div>}

                    {/* Quick actions strip */}
                    <div className="mt-2 hidden items-center gap-2 text-xs text-muted-foreground group-hover:flex sm:mt-1">
                        {unread && (
                            <button
                                type="button"
                                className="cursor-pointer rounded-md border bg-background px-2 py-1 hover:bg-muted"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onMarkRead(n.id);
                                }}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" />
                                    Mark as read
                                </span>
                            </button>
                        )}
                        {url && (
                            <Link
                                href={url}
                                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 hover:bg-muted"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                Open
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="mt-0.5 flex items-center">
                    {n.created_at && (
                        <time className="text-[11px] text-muted-foreground" dateTime={n.created_at} title={new Date(n.created_at).toLocaleString()}>
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </time>
                    )}
                    {unread && (
                        <button
                            type="button"
                            className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
                            aria-label="Mark as read"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onMarkRead(n.id);
                            }}
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </Wrapper>
    );
}

export default function NotificationsBell() {
    const { props } = usePage<PageProps>();
    const unread = props.notifications?.unread ?? 0;
    const recent = props.notifications?.recent ?? [];
    const isLoggedIn = !!props.auth?.user?.id;

    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const firstOpenRef = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 640px)');

    const [localRecent, setLocalRecent] = useState<NotificationItem[] | null>(null);
    useEffect(() => {
        setLocalRecent(recent);
    }, [recent]);

    const ensureLoaded = () => {
        if (!firstOpenRef.current && isLoggedIn && (localRecent ?? recent).length === 0) {
            firstOpenRef.current = true;
            setLoading(true);
            router.reload({ only: ['notifications'], onFinish: () => setLoading(false) });
        }
    };

    const itemsSource = localRecent ?? recent;
    const items = useMemo(() => itemsSource.filter((n) => !n.read_at).slice(0, 12), [itemsSource]);
    const groups = useMemo(() => groupByDay(items), [items]);
    const hasItems = items.length > 0;

    const markAll = () => {
        setLocalRecent((prev) => (prev ?? recent).map((n) => ({ ...n, read_at: new Date().toISOString() })));

        router.visit(route('notify.readAll'), {
            method: 'get',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => router.reload({ only: ['notifications'] }),
            onError: () => {
                setLocalRecent(recent);
            },
        });
    };

    const markOne = (id: string) => {
        setLocalRecent((prev) => (prev ?? recent).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));

        router.visit(route('notify.read', id), {
            method: 'get',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => router.reload({ only: ['notifications'] }),
            onError: () => {
                setLocalRecent((prev) => (prev ?? recent).map((n) => (n.id === id ? { ...n, read_at: null } : n)));
            },
        });
    };

    const EmptyState = (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-card">
                <Inbox className="h-5 w-5" />
            </div>
            <div className="text-base font-medium text-foreground">No notifications yet</div>
            <div className="max-w-xs text-xs">When there’s activity on your spots, you’ll see it here.</div>
        </div>
    );

    const LoadingState = (
        <div className="space-y-2 p-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
        </div>
    );

    const List = (
        <div className="max-h-[70vh] overflow-auto">
            {loading ? (
                LoadingState
            ) : !hasItems ? (
                EmptyState
            ) : (
                <div className="space-y-4 p-3">
                    {Object.entries(groups).map(([label, arr]) => (
                        <Fragment key={label}>
                            <div className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
                            <ul className="space-y-2">
                                {arr.map((n) => (
                                    <li key={n.id}>
                                        <Row n={n} onMarkRead={markOne} />
                                    </li>
                                ))}
                            </ul>
                        </Fragment>
                    ))}
                </div>
            )}
        </div>
    );

    if (isDesktop) {
        return (
            <DropdownMenu
                onOpenChange={(o) => {
                    if (o) ensureLoaded();
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Notifications" className="relative cursor-pointer rounded-full">
                        <Bell className="h-5 w-5" />
                        {unread > 0 && (
                            <span className="absolute top-[3px] right-[3px] min-w-[16px] rounded-full border border-background bg-primary px-1 text-center text-[9px] leading-[14px] font-semibold text-primary-foreground">
                                {unread > 99 ? '99+' : unread}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="z-50 w-[min(92vw,32rem)] rounded-2xl border bg-background p-0 shadow-sm sm:w-[32rem]"
                >
                    <div className="flex items-center justify-between px-4 py-3">
                        <DropdownMenuLabel className="p-0 text-base font-semibold">Notifications</DropdownMenuLabel>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll} disabled={unread === 0}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Mark all
                        </Button>
                    </div>
                    <DropdownMenuSeparator />
                    {List}
                    <DropdownMenuSeparator />
                    <div className="px-4 py-3">
                        <Link href={route('notify.index')} className="block">
                            <Button variant="secondary" className="w-full cursor-pointer">
                                View all
                            </Button>
                        </Link>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    // Mobile drawer
    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative cursor-pointer rounded-full"
                onClick={() => {
                    setOpen(true);
                    ensureLoaded();
                }}
            >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                    <span className="absolute top-[3px] right-[3px] min-w-[16px] rounded-full border border-background bg-primary px-1 text-center text-[9px] leading-[14px] font-semibold text-primary-foreground">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Button>

            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent className="p-0">
                    <DrawerHeader className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                            <DrawerTitle className="text-base font-semibold">Notifications</DrawerTitle>
                            <DrawerDescription>Recent activity</DrawerDescription>
                        </div>
                    </DrawerHeader>

                    {List}

                    <DrawerFooter className="border-t px-4 py-3">
                        <Link href={route('notify.index')} className="block w-full">
                            <Button variant="secondary" className="w-full">
                                View all
                            </Button>
                        </Link>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </>
    );
}
