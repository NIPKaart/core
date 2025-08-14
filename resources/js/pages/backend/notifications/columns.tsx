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
import { Link, router } from '@inertiajs/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, MoreVertical } from 'lucide-react';

const readVariantMap: Record<'read' | 'unread', 'secondary' | 'default'> = {
    read: 'secondary',
    unread: 'default',
};

function resolveTitle(n: NotificationItem, t: Translations['t']): string {
    const type = n.type || 'system_announcement';
    const params =
        ((n.data as any)?.params as Record<string, unknown>) ??
        ({
            spot_label: (n.data as any)?.spot_label ?? (n.data as any)?.spot_name ?? (n.data as any)?.label ?? undefined,
        } as Record<string, unknown>);

    const key = `titles.${type}`;
    const translated = t(key, params);
    if (!translated || translated === key) {
        return t('table.untitled');
    }
    return translated;
}

export function getNotificationColumns(can: (permission: string) => boolean, { t, tGlobal }: Translations): ColumnDef<NotificationItem>[] {
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
                const title = resolveTitle(n, t);
                const url = (n.data as any)?.url;

                if (typeof url === 'string' && url.length > 0) {
                    return (
                        <Link href={url} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                            {title}
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                    );
                }
                return title;
            },
        },
        {
            accessorKey: 'type',
            header: t('table.type'),
            cell: ({ row }) => {
                const type = row.original.type ?? '—';
                const label = t(`types.${type}`, type);
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
                const date = new Date(row.original.created_at);
                return (
                    <span className="text-muted-foreground">
                        {date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                );
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

                                {(n.data as any)?.url && typeof (n.data as any).url === 'string' && (
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={(n.data as any).url}>{t('table.actions.open')}</Link>
                                    </DropdownMenuItem>
                                )}

                                {isUnread && (
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            router.get(route('notifications.read', { id: n.id }), {}, { preserveState: true });
                                        }}
                                    >
                                        {t('table.actions.markRead')}
                                    </DropdownMenuItem>
                                )}

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
