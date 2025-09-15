import { searchApi, type SearchResponse } from '@/lib/search';
import { useQuery } from '@tanstack/react-query';

export function useSearchQuery(query: string, limit = 10) {
    return useQuery<SearchResponse>({
        queryKey: ['search', query, limit],
        queryFn: ({ signal }) => searchApi(query, signal, limit),
        enabled: query.trim().length >= 2,
        placeholderData: (prev) => prev,
    });
}
