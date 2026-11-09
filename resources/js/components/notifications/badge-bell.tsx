import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import notifications from '@/routes/notifications';
import type { NotificationItem } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationsList } from './list-notifications';

type PageProps = {
    auth?: { user?: { id: number } | null };
    notifications?: { unread: number; recent: NotificationItem[] };
};

export default function BellBadge() {
    const { t } = useTranslation('global/notification');

    const { props } = usePage<PageProps>();
    const isLoggedIn = !!props.auth?.user?.id;
    const unread = props.notifications?.unread ?? 0;
    const recentFromProps = useMemo<NotificationItem[]>(() => props.notifications?.recent ?? [], [props.notifications]);

    const [loading, setLoading] = useState(false);
    const [openDrawer, setOpenDrawer] = useState(false);
    const firstOpenRef = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 640px)');

    const ensureLoaded = () => {
        if (!firstOpenRef.current && isLoggedIn && recentFromProps.length === 0) {
            firstOpenRef.current = true;
            setLoading(true);
            router.reload({ only: ['notifications'], showProgress: false, onFinish: () => setLoading(false) });
        }
    };

    const [showAll, setShowAll] = useState(false);
    const quickItems = useMemo(
        () => (showAll ? recentFromProps : recentFromProps.filter((n) => !n.read_at)).slice(0, 12),
        [recentFromProps, showAll],
    );
    const unreadNotShown = Math.max(0, unread - recentFromProps.filter((n) => !n.read_at).length);

    const markRead = (id?: string, url?: string) => {
        router.get(
            id ? notifications.read(id) : notifications.readAll(),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                showProgress: false,
                only: ['notifications', 'notificationList'],
                optimistic: (pageProps) => {
                    const current = pageProps.notifications as PageProps['notifications'];
                    if (!current) return {};
                    const wasUnread = id ? current.recent.some((n) => n.id === id && !n.read_at) : true;
                    return {
                        notifications: {
                            unread: id ? Math.max(0, current.unread - Number(wasUnread)) : 0,
                            recent: current.recent.map((n) => (!n.read_at && (!id || n.id === id) ? { ...n, read_at: new Date().toISOString() } : n)),
                        },
                    };
                },
                onSuccess: () => {
                    if (url) router.visit(url);
                },
                onError: () => {
                    if (url) router.visit(url);
                },
            },
        );
    };

    const markAll = () => markRead();
    const markOne = (id: string) => markRead(id);
    const markAndOpen = (id: string, url: string) => markRead(id, url);

    const badge = unread > 0 && (
        <span className="absolute top-0.5 right-0 min-w-[18px] rounded-full border-2 border-background bg-orange-700 px-[5px] text-center text-[10px] leading-[14px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
        </span>
    );

    const filters = (
        <div className="flex gap-1">
            {[
                { all: false, label: t('filters.unread'), count: unread },
                { all: true, label: t('filters.all'), count: 0 },
            ].map((filter) => (
                <button
                    key={filter.label}
                    type="button"
                    aria-pressed={showAll === filter.all}
                    onClick={() => setShowAll(filter.all)}
                    className={cn(
                        'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        showAll === filter.all ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                    )}
                >
                    {filter.label}
                    {filter.count > 0 && (
                        <span
                            className={cn(
                                'rounded-full px-1.5 text-[11px] leading-[18px]',
                                showAll === filter.all ? 'bg-primary-foreground/20' : 'bg-muted',
                            )}
                        >
                            {filter.count > 99 ? '99+' : filter.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );

    const markAllButton = (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer px-2.5 text-[13px] text-foreground/80"
            onClick={markAll}
            disabled={unread === 0}
        >
            <CheckCheck className="size-4" />
            {t('actions.markAll')}
        </Button>
    );

    const list = <NotificationsList items={quickItems} loading={loading} caughtUp={!showAll} onMarkOne={markOne} onOpen={markAndOpen} />;

    const footer = (
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 py-2.5 pr-3 pl-5">
            <span className="text-xs text-muted-foreground">
                {!showAll && unreadNotShown > 0 && t('footer.moreUnread', { count: unreadNotShown })}
            </span>
            <Link
                href={notifications.index()}
                className="flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                {t('actions.viewAll')}
                <ChevronRight className="size-4" />
            </Link>
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
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('header.title')}
                        className="relative cursor-pointer rounded-full data-[state=open]:bg-muted"
                    >
                        <Bell className="h-5 w-5" />
                        {badge}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="z-50 w-[min(92vw,30rem)] overflow-hidden rounded-[14px] border bg-background p-0 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.04)] sm:w-[30rem]"
                >
                    <div className="flex items-center justify-between pt-3.5 pr-4 pb-2.5 pl-5">
                        <DropdownMenuLabel className="p-0 text-base font-semibold">{t('header.title')}</DropdownMenuLabel>
                        {markAllButton}
                    </div>
                    <div className="border-b px-4 pb-3">{filters}</div>
                    {list}
                    {footer}
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
                aria-label={t('header.title')}
                className="relative cursor-pointer rounded-full"
                onClick={() => {
                    setOpenDrawer(true);
                    ensureLoaded();
                }}
            >
                <Bell className="h-5 w-5" />
                {badge}
            </Button>

            <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
                <DrawerContent className="p-0">
                    <DrawerHeader className="gap-3 border-b px-4 pt-3 pb-3 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <DrawerTitle className="text-lg font-semibold">{t('header.title')}</DrawerTitle>
                            {markAllButton}
                        </div>
                        <DrawerDescription className="sr-only">{t('header.subtitle')}</DrawerDescription>
                        {filters}
                    </DrawerHeader>

                    {list}

                    <DrawerFooter className="p-0">{footer}</DrawerFooter>
                </DrawerContent>
            </Drawer>
        </>
    );
}
