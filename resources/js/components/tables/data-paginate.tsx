import { Button } from '@/components/ui/button';
import { PaginatedResponse } from '@/types';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
    pagination: PaginatedResponse;
    preserveScroll?: boolean;
};

export function DataTablePagination({ pagination, preserveScroll = true }: Props) {
    const { t } = useTranslation('backend/global');
    const goTo = (url: string | null) => {
        if (url) router.get(url, {}, { preserveScroll });
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
                {pagination.total === 0
                    ? t('table.no_results')
                    : t('table.results', { from: pagination.from, to: pagination.to, total: pagination.total })}
            </p>
            {pagination.last_page > 1 && (
                <nav aria-label={t('table.pagination')} className="flex max-w-full flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={!pagination.prev_page_url}
                        onClick={() => goTo(pagination.prev_page_url)}
                        aria-label={t('table.previous_page')}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <div className="hidden flex-wrap items-center gap-1 sm:flex">
                        {pagination.links
                            ?.filter((link) => /^\d+$/.test(link.label) || link.label === '...')
                            .map((link, index) =>
                                link.label === '...' ? (
                                    <span key={index} className="px-1 text-muted-foreground">
                                        …
                                    </span>
                                ) : (
                                    <Button
                                        key={index}
                                        variant={link.active ? 'outline' : 'ghost'}
                                        size="icon"
                                        disabled={!link.url}
                                        aria-current={link.active ? 'page' : undefined}
                                        onClick={() => goTo(link.url)}
                                    >
                                        {link.label}
                                    </Button>
                                ),
                            )}
                    </div>
                    <span className="text-muted-foreground sm:hidden">
                        {t('table.page', { current: pagination.current_page, total: pagination.last_page })}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={!pagination.next_page_url}
                        onClick={() => goTo(pagination.next_page_url)}
                        aria-label={t('table.next_page')}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </nav>
            )}
        </div>
    );
}
