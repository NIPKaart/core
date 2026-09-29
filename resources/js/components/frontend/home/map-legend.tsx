import { pinSvg } from '@/lib/pin-svg';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** The map's own marker artwork, so this explanation always matches what visitors see on the map. */
function Pin({ markup }: { markup: string }) {
    return (
        <span className="block h-12 w-9 [&_svg]:h-12 [&_svg]:w-9 [&_svg]:overflow-visible" aria-hidden dangerouslySetInnerHTML={{ __html: markup }} />
    );
}

export default function MapLegend() {
    const { t } = useTranslation('frontend/home');
    const items: { key: string; marker: ReactNode }[] = [
        { key: 'space', marker: <Pin markup={pinSvg(false, null)} /> },
        { key: 'garage', marker: <Pin markup={pinSvg(true, { text: '484', tone: 'green', label: '' })} /> },
        {
            key: 'cluster',
            marker: (
                <span className="marker-cluster marker-cluster-small block size-10" aria-hidden>
                    <div>
                        <span>5</span>
                    </div>
                </span>
            ),
        },
        {
            key: 'destination',
            marker: (
                <span className="block size-11" aria-hidden>
                    <span className="destination-marker__area" />
                </span>
            ),
        },
    ];

    return (
        <section aria-labelledby="map-legend" className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-28">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                <h2 id="map-legend" className="text-[1.75rem] leading-tight font-bold tracking-tight lg:text-[2.5rem]">
                    {t('legend.title')}
                </h2>
                <p className="max-w-md text-base text-stone-600 lg:text-[17px] dark:text-stone-400">{t('legend.intro')}</p>
            </div>
            <ul className="mt-6 grid border-t border-stone-200 lg:mt-12 lg:grid-cols-2 xl:grid-cols-4 dark:border-neutral-800">
                {items.map(({ key, marker }) => (
                    <li
                        key={key}
                        className="flex gap-4 border-b border-stone-200 py-4.5 lg:flex-col lg:gap-3.5 lg:py-8 lg:odd:pr-8 lg:even:border-l lg:even:pl-8 xl:border-b-0 xl:border-l xl:px-8 xl:pb-0 xl:first:border-l-0 xl:first:pl-0 xl:last:pr-0 dark:border-neutral-800"
                    >
                        <span className="flex h-12 w-14 shrink-0 items-start lg:w-auto">{marker}</span>
                        <span className="flex flex-col gap-1 lg:gap-3.5">
                            <h3 className="text-[17px] font-semibold lg:text-lg">{t(`legend.${key}.title`)}</h3>
                            <p className="text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{t(`legend.${key}.text`)}</p>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
