import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NotificationItem, Translations } from '@/types';
import { resolveNotificationTitleBackend, resolveTypeLabelBackend } from '@/utils/notifications';
import { Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, MoreVertical } from 'lucide-react';

const readVariantMap: Record<'read' | 'unread', 'secondary' | 'default'> = {
    read: 'secondary',
    unread: 'default',
};

const dtf = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

const resolveTitleForRow = (n: NotificationItem, tBackend: Translations['t']) => {
    const raw = (n.data ?? {}) as Record<string, unknown>;
    const params = (typeof raw.params === 'object' && raw.params !== null ? (raw.params as Record<string, unknown>) : {}) as Record<string, unknown>;
    const explicit = typeof raw.title === 'string' ? raw.title.trim() : '';

    if (explicit) return explicit;

    const type = (typeof n.type === 'string' && n.type) || (typeof raw.type === 'string' && (raw.type as string)) || '';

    if (type) {
        const translated = resolveNotificationTitleBackend(tBackend, type, params);
        if (translated) return translated;
    }

    const fallbackSpace =
        (typeof params.space_label === 'string' ? (params.space_label as string) : '') ||
        (typeof raw.space_label === 'string' ? (raw.space_label as string) : '');

    return fallbackSpace || tBackend('table.untitled');
};

export function getNotificationColumns({ t, tGlobal }: Translations): ColumnDef<NotificationItem>[] {
    return [
        {
            id: 'select',
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
                    aria-label="Select all"
                    className="cursor-pointer border border-input bg-background data-[state=checked]:bg-primary"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(!!checked)}
                    aria-label="Select row"
                    className="cursor-pointer"
                />
            ),
        },
        {
            id: 'title',
            header: t('table.title'),
            enableHiding: false,
            cell: ({ row }) => {
                const n = row.original;
                const raw = (n as { data?: unknown }).data;
                const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : undefined;
                const url = typeof data?.url === 'string' ? (data.url as string) : undefined;

                const title = resolveTitleForRow(n, t);

                return url ? (
                    <Link href={url} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                        {title}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                ) : (
                    title
                );
            },
        },
        {
            accessorKey: 'type',
            header: t('table.type'),
            cell: ({ row }) => {
                const type = row.original.type ?? 'default';
                const label = resolveTypeLabelBackend(t, type);
                return <Badge variant="outline">{label}</Badge>;
            },
        },
        {
            id: 'read_status',
            header: t('table.read'),
            cell: ({ row }) => {
                const status: 'read' | 'unread' = row.original.read_at ? 'read' : 'unread';
                return <Badge variant={readVariantMap[status]}>{t(`badges.${status}`)}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: t('table.createdAt'),
            cell: ({ row }) => {
                const s = row.original.created_at;
                const d = s ? new Date(s) : null;
                return <span className="text-muted-foreground">{d ? dtf.format(d) : '—'}</span>;
            },
        },
        {
            id: 'actions',
            enableSorting: false,
            enableHiding: false,
            meta: { align: 'right' },
            cell: ({ row }) => {
                const n = row.original;
                const isUnread = !n.read_at;

                const raw = (n as { data?: unknown }).data;
                const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : undefined;
                const url = typeof data?.url === 'string' ? (data.url as string) : undefined;

                const markRead = () =>
                    router.get(
                        route('notifications.read', { id: n.id }),
                        {},
                        { preserveState: true, onSuccess: () => router.reload({ only: ['notifications'] }) },
                    );

                const markUnread = () =>
                    router.get(
                        route('notifications.unread', { id: n.id }),
                        {},
                        { preserveState: true, onSuccess: () => router.reload({ only: ['notifications'] }) },
                    );

                const toggleRead = () => (isUnread ? markRead() : markUnread());

                return (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex size-8 cursor-pointer text-muted-foreground data-[state=open]:bg-muted"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">{tGlobal('common.openMenu')}</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-full">
                                <DropdownMenuLabel>{tGlobal('common.actions')}</DropdownMenuLabel>

                                {url && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={url}>{t('table.actions.open')}</Link>
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        toggleRead();
                                    }}
                                >
                                    {isUnread ? t('table.actions.markRead') : t('table.actions.markUnread')}
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        router.delete(route('notifications.remove', { id: n.id }), {
                                            preserveState: true,
                                            onSuccess: () => router.reload({ only: ['notifications'] }),
                                        });
                                    }}
                                >
                                    {tGlobal('common.delete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
