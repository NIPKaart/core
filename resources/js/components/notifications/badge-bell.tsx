import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NotificationItem, NotificationsMenu } from './menu-recent';

type PageProps = {
    auth?: { user?: { id: number } | null };
    notifications?: { unread: number; recent: NotificationItem[] };
};

export default function BellBadge() {
    const { props } = usePage<PageProps>();
    const isLoggedIn = !!props.auth?.user?.id;

    const notifications = props.notifications;
    const recentFromProps = useMemo<NotificationItem[]>(() => notifications?.recent ?? [], [notifications]);
    const unread = notifications?.unread ?? 0;

    const [loading, setLoading] = useState(false);
    const [openDrawer, setOpenDrawer] = useState(false);
    const firstOpenRef = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 640px)');

    const [localRecent, setLocalRecent] = useState<NotificationItem[] | null>(null);
    useEffect(() => {
        setLocalRecent(recentFromProps);
    }, [recentFromProps]);

    const ensureLoaded = () => {
        const source = localRecent ?? recentFromProps;
        if (!firstOpenRef.current && isLoggedIn && source.length === 0) {
            firstOpenRef.current = true;
            setLoading(true);
            router.reload({ only: ['notifications'], onFinish: () => setLoading(false) });
        }
    };

    const itemsSource = localRecent ?? recentFromProps;
    const quickItems = useMemo(() => itemsSource.filter((n) => !n.read_at).slice(0, 12), [itemsSource]);

    const markAll = () => {
        setLocalRecent((prev) => (prev ?? recentFromProps).map((n) => ({ ...n, read_at: new Date().toISOString() })));

        router.visit(route('notify.readAll'), {
            method: 'get',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => router.reload({ only: ['notifications'] }),
            onError: () => {
                setLocalRecent(recentFromProps);
            },
        });
    };

    const markOne = (id: string) => {
        setLocalRecent((prev) => (prev ?? recentFromProps).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));

        router.visit(route('notify.read', id), {
            method: 'get',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => router.reload({ only: ['notifications'] }),
            onError: () => {
                setLocalRecent((prev) => (prev ?? recentFromProps).map((n) => (n.id === id ? { ...n, read_at: null } : n)));
            },
        });
    };

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
                    className="z-50 w-[min(92vw,30rem)] rounded-xl border bg-background p-0 shadow-sm sm:w-[30rem]"
                >
                    <div className="flex items-center justify-between px-4 py-3">
                        <DropdownMenuLabel className="p-0 text-base font-semibold">Notifications</DropdownMenuLabel>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll} disabled={unread === 0}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Mark all
                        </Button>
                    </div>
                    <DropdownMenuSeparator />
                    <NotificationsMenu items={quickItems} loading={loading} onMarkOne={markOne} />
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

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
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
                    <DrawerHeader className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                            <DrawerTitle className="text-base font-semibold">Notifications</DrawerTitle>
                            <DrawerDescription>Recent activity</DrawerDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll} disabled={unread === 0}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Mark all
                        </Button>
                    </DrawerHeader>

                    <NotificationsMenu items={quickItems} loading={loading} onMarkOne={markOne} />

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
