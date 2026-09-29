import { GarageTable, useMeasuredTime } from '@/components/frontend/garage-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGarageUpdates } from '@/hooks/use-garage-updates';
import FrontendLayout from '@/layouts/frontend-layout';
import {
    filterMunicipalities,
    overviewSummary,
    sortGarages,
    type GarageSort,
    type GarageTypeFilter,
    type OverviewMunicipality,
} from '@/lib/garage-overview';
import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = { municipalities: OverviewMunicipality[] };

export default function Garages({ municipalities }: Props) {
    const { t, i18n } = useTranslation('frontend/garages');
    const measured = useMeasuredTime();
    const [query, setQuery] = useState('');
    const [type, setType] = useState<GarageTypeFilter>('all');
    const [sort, setSort] = useState<GarageSort>('name');
    const summary = useMemo(() => overviewSummary(municipalities), [municipalities]);
    const visible = useMemo(
        () =>
            filterMunicipalities(municipalities, query, type, i18n.language).map((municipality) => ({
                ...municipality,
                garages: sortGarages(municipality.garages, sort),
            })),
        [municipalities, query, type, sort, i18n.language],
    );
    const shown = visible.reduce((count, municipality) => count + municipality.garages.length, 0);

    useGarageUpdates(['municipalities']);

    const typeOptions: { value: GarageTypeFilter; count: number }[] = [
        { value: 'all', count: summary.total },
        { value: 'garage', count: summary.garages },
        { value: 'parkandride', count: summary.parkandride },
    ];

    return (
        <FrontendLayout>
            <Head title={t('meta.title')}>
                <meta name="description" content={t('meta.description')} />
            </Head>

            <div className="min-h-screen bg-canvas dark:bg-neutral-950">
                <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 lg:px-8 lg:pt-12">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                        <div className="flex max-w-2xl flex-col gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight dark:text-white">
                                {t('title')}
                            </h1>
                            <p className="text-base text-stone-600 lg:text-[17px] dark:text-stone-300">{t('intro')}</p>
                        </div>
                        {summary.total > 0 && (
                            <div className="flex flex-col gap-2 lg:items-end">
                                {summary.latestObservedAt && (
                                    <span className="inline-flex items-center gap-2 self-start rounded-full border bg-white px-3 py-1.5 text-sm font-semibold lg:self-end dark:bg-neutral-900">
                                        <span
                                            className={`h-2 w-2 rounded-full ${summary.current > 0 ? 'bg-green-600' : 'bg-stone-400'}`}
                                            aria-hidden
                                        />
                                        {t('summary.latest', { time: measured(summary.latestObservedAt) })}
                                    </span>
                                )}
                                <span className="text-sm text-stone-600 dark:text-stone-400">
                                    {t('summary.states', { current: summary.current, closed: summary.closed, without: summary.withoutLiveData })}
                                </span>
                            </div>
                        )}
                    </header>

                    {summary.total === 0 ? (
                        <p className="mt-10 text-muted-foreground">{t('empty')}</p>
                    ) : (
                        <>
                            <div className="mt-6 flex flex-col gap-3 lg:mt-8 lg:flex-row lg:items-center lg:gap-4">
                                <div className="relative w-full lg:w-80">
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <label htmlFor="garage-filter" className="sr-only">
                                        {t('filter.label')}
                                    </label>
                                    <Input
                                        id="garage-filter"
                                        type="search"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder={t('filter.placeholder')}
                                        className="h-11 bg-white pl-10 dark:bg-neutral-900"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-1">
                                    <div
                                        role="group"
                                        aria-label={t('filter.type')}
                                        className="flex gap-1 self-start rounded-lg bg-stone-200/70 p-1 dark:bg-neutral-800"
                                    >
                                        {typeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={type === option.value}
                                                onClick={() => setType(option.value)}
                                                className={`h-9 rounded-md px-3 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3.5 ${
                                                    type === option.value
                                                        ? 'bg-white font-semibold shadow-sm dark:bg-neutral-950'
                                                        : 'text-stone-700 hover:bg-white/60 dark:text-stone-300 dark:hover:bg-neutral-900/60'
                                                }`}
                                            >
                                                {t(`filter.types.${option.value}`)}{' '}
                                                <span className="font-normal text-muted-foreground">{option.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                        <label htmlFor="garage-sort" className="sr-only sm:not-sr-only">
                                            {t('sort.label')}
                                        </label>
                                        <Select value={sort} onValueChange={(value: GarageSort) => setSort(value)}>
                                            <SelectTrigger id="garage-sort" className="min-h-11 w-40 bg-white text-foreground dark:bg-neutral-900">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent align="end">
                                                <SelectItem value="name">{t('sort.name')}</SelectItem>
                                                <SelectItem value="free">{t('sort.free')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <p className="sr-only" role="status">
                                {t('filter.count', { count: shown, total: summary.total })}
                            </p>

                            {visible.length === 0 ? (
                                <p className="mt-10 text-muted-foreground">{t('filter.none')}</p>
                            ) : (
                                visible.map((municipality) => (
                                    <GarageTable key={municipality.name} municipality={municipality} className="mt-6 lg:mt-8" />
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </FrontendLayout>
    );
}
