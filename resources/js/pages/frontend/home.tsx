import Footer from '@/components/frontend/footer';
import { GarageTable } from '@/components/frontend/garage-table';
import HomeSearch from '@/components/frontend/home/home-search';
import MapLegend from '@/components/frontend/home/map-legend';
import MapPreview from '@/components/frontend/home/map-preview';
import { useGarageUpdates } from '@/hooks/use-garage-updates';
import FrontendLayout from '@/layouts/frontend-layout';
import type { OverviewMunicipality } from '@/lib/garage-overview';
import { pinSvg } from '@/lib/pin-svg';
import { garages as garageOverview } from '@/routes';
import { add } from '@/routes/location-map';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

type Props = { garages: { municipality: OverviewMunicipality; total: number } | null };

const heading = 'text-[1.75rem] leading-tight font-bold tracking-tight text-balance lg:text-[2.5rem]';
const textLink = 'flex min-h-11 items-center font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400';

export default function Home({ garages }: Props) {
    const { t } = useTranslation('frontend/home');

    useGarageUpdates(['garages']);

    return (
        <FrontendLayout>
            <Head title={t('meta.title')}>
                <meta name="description" content={t('meta.description')} />
            </Head>

            <div className="bg-canvas dark:bg-neutral-950">
                <div className="border-b border-stone-200/70 bg-canvas-strong lg:grid lg:min-h-[660px] lg:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="flex flex-col gap-4 px-5 pt-9 pb-8 sm:px-6 lg:justify-center lg:gap-5.5 lg:py-20 lg:pr-16 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
                        <span className="text-sm font-medium text-stone-600 lg:text-[15px] dark:text-stone-400">{t('hero.eyebrow')}</span>
                        <h1 className="text-4xl leading-[1.06] font-bold tracking-[-0.035em] text-balance text-stone-900 lg:text-[3.5rem] lg:leading-[1.04] dark:text-white">
                            {t('hero.title')}
                        </h1>
                        <p className="max-w-lg text-[17px] leading-relaxed text-stone-600 lg:text-lg dark:text-stone-300">
                            <span className="lg:hidden">{t('hero.intro_short')}</span>
                            <span className="max-lg:hidden">{t('hero.intro')}</span>
                        </p>
                        <div className="mt-1.5 lg:mt-3.5">
                            <HomeSearch />
                        </div>
                    </div>
                    <MapPreview />
                </div>

                <MapLegend />

                <section aria-labelledby="home-garages" className="bg-canvas-strong dark:bg-neutral-900/40">
                    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-18 lg:px-8 lg:py-26">
                        <div className="flex flex-col gap-4 lg:w-100 lg:shrink-0 lg:gap-4.5">
                            <h2 id="home-garages" className={heading}>
                                {t('garages.title')}
                            </h2>
                            <p className="text-base leading-relaxed text-stone-600 lg:text-[17px] dark:text-stone-400">
                                <span className="lg:hidden">{t('garages.text_short')}</span>
                                <span className="max-lg:hidden">{t('garages.text')}</span>
                            </p>
                            <Link href={garageOverview()} className={`${textLink} max-lg:hidden`}>
                                {t('garages.link')}
                            </Link>
                        </div>
                        {garages && <GarageTable municipality={garages.municipality} total={garages.total} compact className="min-w-0 flex-1" />}
                        <Link href={garageOverview()} className={`${textLink} lg:hidden`}>
                            {t('garages.link')}
                        </Link>
                    </div>
                </section>

                <section
                    aria-labelledby="home-contribute"
                    className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-18 lg:px-8 lg:py-26"
                >
                    <div className="flex max-w-xl flex-1 flex-col gap-4 lg:gap-4.5">
                        <h2 id="home-contribute" className={heading}>
                            {t('contribute.title')}
                        </h2>
                        <p className="text-base leading-relaxed text-stone-600 lg:text-[17px] dark:text-stone-400">{t('contribute.text')}</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                            <Link
                                href={add()}
                                className="flex h-12 items-center justify-center rounded-xl bg-stone-900 px-5.5 font-semibold text-white hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                            >
                                {t('contribute.cta')}
                            </Link>
                        </div>
                    </div>
                    <div
                        aria-hidden
                        className="relative h-72 overflow-hidden rounded-xl border border-stone-200 max-sm:hidden lg:h-85 lg:w-140 lg:shrink-0 dark:border-neutral-800"
                    >
                        <img
                            src="/assets/images/home/map-preview.webp"
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full scale-150 object-cover object-[60%_70%]"
                        />
                        <span
                            className="absolute top-[36%] left-1/2 block h-12 w-9 -translate-x-1/2 [&_svg]:h-12 [&_svg]:w-9 [&_svg]:overflow-visible"
                            dangerouslySetInnerHTML={{ __html: pinSvg(false, null) }}
                        />
                        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-0.5 rounded-lg bg-white px-4 py-3.5 shadow-[0_8px_24px_rgb(28_25_23/16%)] dark:bg-neutral-900">
                            <span className="text-[15px] font-semibold">{t('contribute.step')}</span>
                            <span className="text-[13px] text-stone-600 dark:text-stone-400">{t('contribute.next')}</span>
                        </div>
                    </div>
                </section>
            </div>

            <Footer />
        </FrontendLayout>
    );
}
