import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import notifications from '@/routes/notifications';
import type { NotificationItem } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Check } from 'lucide-react';
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

    const quickItems = useMemo(() => recentFromProps.filter((n) => !n.read_at).slice(0, 12), [recentFromProps]);

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

    if (isDesktop) {
        return (
            <DropdownMenu
                onOpenChange={(o) => {
                    if (o) ensureLoaded();
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t('header.title')} className="relative cursor-pointer rounded-full">
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
                    className="z-50 w-[min(92vw,30rem)] rounded-xl border bg-background p-0 shadow-sm sm:w-[30rem]"
                >
                    <div className="flex items-center justify-between px-4 py-3">
                        <DropdownMenuLabel className="p-0 text-base font-semibold">{t('header.title')}</DropdownMenuLabel>
                        <Button variant="ghost" size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={markAll} disabled={unread === 0}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {t('actions.markAll')}
                        </Button>
                    </div>
                    <DropdownMenuSeparator />
                    <NotificationsList items={quickItems} loading={loading} onMarkOne={markOne} onOpen={markAndOpen} />
                    <DropdownMenuSeparator />
                    <div className="px-4 py-3">
                        <Link href={notifications.index()} className="block">
                            <Button variant="secondary" className="w-full cursor-pointer">
                                {t('actions.viewAll')}
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
                aria-label={t('header.title')}
                className="relative cursor-pointer rounded-full"
                onClick={() => {
                    setOpenDrawer(true);
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

            <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
                <DrawerContent className="p-0">
                    <DrawerHeader className="flex items-center justify-between border-b px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-center">
                            <Bell className="h-6 w-6" />
                            <DrawerTitle className="text-lg font-semibold">{t('header.title')}</DrawerTitle>
                        </div>
                        <DrawerDescription className="mt-1 mb-0 text-center text-sm text-muted-foreground">{t('header.subtitle')}</DrawerDescription>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll} disabled={unread === 0}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {t('actions.markAll')}
                        </Button>
                    </DrawerHeader>

                    <NotificationsList items={quickItems} loading={loading} onMarkOne={markOne} onOpen={markAndOpen} />

                    <DrawerFooter className="border-t px-4 py-3">
                        <Link href={notifications.index()} className="block w-full">
                            <Button variant="secondary" className="w-full">
                                {t('actions.viewAll')}
                            </Button>
                        </Link>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </>
    );
}
