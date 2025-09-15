import type { Hit } from '@/types/search';

export type SearchResponse = {
    hits: Hit[];
    estimatedTotalHits?: number;
};

export async function searchApi(q: string, signal?: AbortSignal, limit = 10): Promise<SearchResponse> {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    const res = await fetch(`/api/search?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
}
