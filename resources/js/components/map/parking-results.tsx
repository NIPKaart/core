import { Button } from '@/components/ui/button';
import type { ParkingResult } from '@/types/destination';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SourceIcon } from './parking-detail/parts';

export type DiscoveryStatus = 'loading' | 'ready' | 'error';

type Props = {
    page?: number;
    hasMore?: boolean;
    onPageChange?: (page: number) => void;
    results: ParkingResult[];
    selectedKey: string | null;
    status: DiscoveryStatus;
    onSelect: (result: ParkingResult) => void;
    onRetry: () => void;
};

export default function ParkingResults({ results, selectedKey, status, onSelect, onRetry, page = 1, hasMore = false, onPageChange }: Props) {
    const { t } = useTranslation('frontend/map/main');

    return (
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6">
            <h2 className="text-lg font-semibold">{t('results.title')}</h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
                {status === 'loading'
                    ? t('results.loading')
                    : status === 'error'
                      ? t('results.error')
                      : t(hasMore || page > 1 ? 'results.page_count' : 'results.count', { count: results.length })}
            </p>
            {status === 'error' && (
                <Button onClick={onRetry} className="min-h-11">
                    {t('results.retry')}
                </Button>
            )}
            {status === 'ready' && results.length === 0 && <p>{t('results.empty')}</p>}
            {onPageChange && (hasMore || page > 1) && (
                <nav aria-label={t('results.pages')} className="flex items-center justify-between gap-2">
                    <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={page === 1 || status === 'loading'}
                        onClick={() => onPageChange(page - 1)}
                    >
                        {t('results.previous')}
                    </Button>
                    <span role="status" className="text-sm">
                        {t('results.page', { page })}
                    </span>
                    <Button variant="outline" className="min-h-11" disabled={!hasMore || status === 'loading'} onClick={() => onPageChange(page + 1)}>
                        {t('results.next')}
                    </Button>
                </nav>
            )}
            {results.length > 0 && (
                <>
                    <p className="text-xs text-muted-foreground">{t('results.unknown')}</p>
                    <ul aria-label={t('results.title')} className="divide-y">
                        {results.map((result) => (
                            <li key={result.key}>
                                <Button
                                    id={`parking-result-${result.key}`}
                                    variant={selectedKey === result.key ? 'secondary' : 'ghost'}
                                    aria-current={selectedKey === result.key ? 'true' : undefined}
                                    aria-haspopup="dialog"
                                    onClick={() => onSelect(result)}
                                    className="h-auto min-h-20 w-full justify-start gap-3 rounded-none px-1 py-4 text-left whitespace-normal"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950">
                                        <SourceIcon source={result.source} className="size-5" />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                                        <span className="font-semibold">{result.title.trim() || t('results.untitled')}</span>
                                        <span className="text-xs text-muted-foreground">{t(`results.sources.${result.source}`)}</span>
                                        {result.distance_metres !== null && (
                                            <span className="text-xs">{t('results.distance', { distance: Math.round(result.distance_metres) })}</span>
                                        )}
                                        {selectedKey === result.key && <span className="text-xs">{t('results.selected')}</span>}
                                    </span>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
