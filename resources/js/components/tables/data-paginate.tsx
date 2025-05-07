import { Button } from '@/components/ui/button';
import { PaginatedResponse } from '@/types';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
    pagination: PaginatedResponse;
    preserveScroll?: boolean;
};

export function DataTablePagination({ pagination, preserveScroll = true }: Props) {
    const goTo = (url: string | null) => {
        if (url) router.get(url, {}, { preserveScroll });
    };

    return (
        <div className="mt-2 flex flex-col gap-2 px-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-muted-foreground text-center sm:text-left">
                Showing {pagination.from}–{pagination.to} of {pagination.total} result{pagination.total !== 1 && 's'}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goTo(pagination.prev_page_url)}
                    disabled={!pagination.prev_page_url}
                    className="px-2 cursor-pointer"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
                </Button>

                {pagination.links
                    .filter((link) => typeof link.label === 'string' && !link.label.includes('Previous') && !link.label.includes('Next'))
                    .map((link, i) => (
                        <Button
                            key={i}
                            variant={link.active ? 'default' : 'outline'}
                            size="sm"
                            disabled={!link.url}
                            onClick={() => goTo(link.url)}
                            className="min-w-[32px] px-2 text-sm cursor-pointer"
                        >
                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                        </Button>
                    ))}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goTo(pagination.next_page_url)}
                    disabled={!pagination.next_page_url}
                    className="px-2 cursor-pointer"
                >
                    <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
