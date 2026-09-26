import { Button } from '@/components/ui/button';
import type { ParkingResult } from '@/types/destination';
import { useTranslation } from 'react-i18next';

export type DiscoveryStatus = 'loading' | 'ready' | 'error';

type Props = {
    results: ParkingResult[];
    selectedKey: string | null;
    status: DiscoveryStatus;
    onSelect: (result: ParkingResult) => void;
    onRetry: () => void;
};

export default function ParkingResults({ results, selectedKey, status, onSelect, onRetry }: Props) {
    const { t } = useTranslation('frontend/map/main');

    return (
        <div className="flex flex-col gap-3 p-4">
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
                {status === 'loading'
                    ? t('results.loading')
                    : status === 'error'
                      ? t('results.error')
                      : t('results.count', { count: results.length })}
            </p>
            {status === 'error' && (
                <Button onClick={onRetry} className="min-h-11">
                    {t('results.retry')}
                </Button>
            )}
            {status === 'ready' && results.length === 0 && <p>{t('results.empty')}</p>}
            {results.length >= 500 && <p className="text-sm">{t('results.limit')}</p>}
            {results.length > 0 && (
                <>
                    <p className="text-xs text-muted-foreground">{t('results.unknown')}</p>
                    <ul aria-label={t('results.title')} className="flex flex-col gap-2">
                        {results.map((result) => (
                            <li key={result.key}>
                                <Button
                                    id={`parking-result-${result.key}`}
                                    variant={selectedKey === result.key ? 'secondary' : 'outline'}
                                    aria-current={selectedKey === result.key ? 'true' : undefined}
                                    aria-haspopup="dialog"
                                    onClick={() => onSelect(result)}
                                    className="h-auto min-h-11 w-full justify-start p-3 text-left whitespace-normal"
                                >
                                    <span className="flex min-w-0 flex-col gap-1">
                                        <span className="font-semibold">{result.title.trim() || t('results.untitled')}</span>
                                        <span className="text-xs text-muted-foreground">{t(`results.sources.${result.source}`)}</span>
                                        {result.distance_metres !== null && (
                                            <span className="text-xs">{t('results.distance', { distance: Math.round(result.distance_metres) })}</span>
                                        )}
                                        {selectedKey === result.key && <span className="text-xs">{t('results.selected')}</span>}
                                    </span>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
