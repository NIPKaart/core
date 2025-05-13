import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { PaginatedResponse } from '@/types';
import { router } from '@inertiajs/react';

type Props = {
    pagination: PaginatedResponse;
    preserveScroll?: boolean;
};

export function DataTablePagination({ pagination, preserveScroll = true }: Props) {
    const goTo = (url: string | null) => {
        if (url) {
            router.get(url, {}, { preserveScroll });
        }
    };

    const hasMultiplePages = pagination.last_page > 1;

    return (
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:px-2">
            <div className="text-muted-foreground text-sm text-center sm:text-left">
                Showing {pagination.from}–{pagination.to} of {pagination.total} result{pagination.total !== 1 && 's'}
            </div>

            {hasMultiplePages && (
                <div className="w-full sm:w-auto">
                    <Pagination>
                        <PaginationContent className="flex-wrap justify-center gap-1 sm:justify-end">
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        goTo(pagination.prev_page_url);
                                    }}
                                    className={!pagination.prev_page_url ? 'pointer-events-none opacity-50' : ''}
                                />
                            </PaginationItem>

                            {pagination.links
                                .filter((link) => typeof link.label === 'string' && !link.label.includes('Previous') && !link.label.includes('Next'))
                                .map((link, i) => (
                                    <PaginationItem key={i}>
                                        <PaginationLink
                                            href="#"
                                            isActive={link.active}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                goTo(link.url);
                                            }}
                                        >
                                            <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}

                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        goTo(pagination.next_page_url);
                                    }}
                                    className={!pagination.next_page_url ? 'pointer-events-none opacity-50' : ''}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
