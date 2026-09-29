import { SourceIcon } from '@/components/map/parking-detail/parts';
import type { ParkingResult } from '@/types/destination';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** A fixed example around the Rijksmuseum, matching the screenshot behind it. */
const EXAMPLE: { title: string; source: ParkingResult['source']; distance: number }[] = [
    { title: 'Jan Luijkenstraat', source: 'municipal', distance: 92 },
    { title: 'Johannes Vermeerstraat', source: 'municipal', distance: 127 },
    { title: 'Garage Museumplein', source: 'offstreet', distance: 497 },
];

/**
 * A still of the real parking map with the result list over it. Decorative: the image carries the description and
 * the list repeats nothing a visitor can act on, so assistive technology skips it.
 */
export default function MapPreview() {
    const { t } = useTranslation('frontend/home');
    const { t: tMap } = useTranslation('frontend/map/main');

    return (
        <div className="relative h-[460px] overflow-hidden border-y border-stone-200 lg:h-auto lg:border-y-0 lg:border-l dark:border-neutral-800">
            <picture>
                <source media="(min-width: 1024px)" srcSet="/assets/images/home/map-preview.webp" />
                <img
                    src="/assets/images/home/map-preview-mobile.webp"
                    alt={t('preview.alt')}
                    className="absolute inset-0 h-full w-full object-cover object-[50%_35%] lg:object-[50%_45%]"
                    fetchPriority="high"
                />
            </picture>
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-white px-5 pt-2.5 pb-1 shadow-[0_-8px_24px_rgb(28_25_23/12%)] lg:inset-x-auto lg:top-7 lg:bottom-auto lg:left-7 lg:w-96 lg:rounded-xl lg:border lg:border-stone-200 lg:px-5 lg:pt-5 lg:pb-2 lg:shadow-[0_12px_32px_rgb(28_25_23/14%)] dark:bg-neutral-900 dark:lg:border-neutral-800"
            >
                <span className="mx-auto h-1 w-9 rounded-full bg-stone-300 lg:hidden dark:bg-neutral-700" />
                <span className="mt-2.5 font-semibold lg:mt-0 lg:text-lg">{tMap('results.title')}</span>
                <span className="hidden text-sm text-stone-600 lg:block dark:text-stone-400">{t('preview.sorted')}</span>
                <ul className="mt-1 divide-y divide-stone-100 lg:mt-2 dark:divide-neutral-800">
                    {EXAMPLE.map((result, index) => (
                        <li
                            key={result.title}
                            className={`flex min-h-16 items-center gap-3 py-2.5 lg:min-h-18 ${index === 2 ? 'max-lg:hidden' : ''}`}
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950">
                                <SourceIcon source={result.source} className="size-5" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="font-semibold">{result.title}</span>
                                <span className="text-xs text-stone-600 dark:text-stone-400">
                                    {tMap(`results.sources.${result.source}`)} · {result.distance} m
                                </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-stone-500 max-lg:hidden" />
                        </li>
                    ))}
                </ul>
            </div>
            <span className="absolute top-1.5 right-2 bg-white/85 px-1.5 py-0.5 text-[11px] text-stone-700 lg:top-auto lg:bottom-1.5">
                {t('preview.attribution')}
            </span>
        </div>
    );
}
