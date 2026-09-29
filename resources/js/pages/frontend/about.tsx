import Footer from '@/components/frontend/footer';
import HomeSearch from '@/components/frontend/home/home-search';
import FrontendLayout from '@/layouts/frontend-layout';
import { pinSvg } from '@/lib/pin-svg';
import { Head } from '@inertiajs/react';
import { Code2, Signpost } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GITHUB_URL = 'https://github.com/NIPKaart';

const SOURCES = [
    { key: 'municipal', garage: false },
    { key: 'community', garage: false },
    { key: 'offstreet', garage: true },
] as const;

const DETAILS = ['orientation', 'times', 'rules', 'provenance', 'navigation'] as const;

const heading = 'text-[1.625rem] leading-tight font-bold tracking-tight lg:text-[2rem]';
const card = 'rounded-xl border border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';
const columns = 'lg:grid-cols-[17.5rem_minmax(0,1fr)_20rem]';

export default function About() {
    const { t } = useTranslation('frontend/about');
    const body = t('why.body', { returnObjects: true }) as string[];

    return (
        <FrontendLayout>
            <Head title={t('meta.title')}>
                <meta name="description" content={t('meta.description')} />
            </Head>

            <div className="bg-canvas dark:bg-neutral-950">
                <div className="mx-auto flex max-w-7xl flex-col gap-14 px-5 pt-10 pb-14 sm:px-6 lg:gap-24 lg:px-8 lg:pt-22 lg:pb-28">
                    <header className="flex max-w-4xl flex-col gap-4 lg:gap-6">
                        <h1 className="text-4xl leading-[1.06] font-bold tracking-[-0.035em] text-balance lg:text-6xl lg:leading-[1.04]">
                            {t('title')}
                        </h1>
                        <p className="max-w-3xl text-lg leading-relaxed text-stone-700 lg:text-[22px] dark:text-stone-300">{t('intro')}</p>
                    </header>

                    <section aria-labelledby="about-sources" className="flex flex-col gap-4 lg:gap-6">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                            <h2 id="about-sources" className={heading}>
                                {t('sources.title')}
                            </h2>
                            <p className="max-w-md text-stone-600 dark:text-stone-400">{t('sources.intro')}</p>
                        </div>
                        <div className={`overflow-hidden ${card}`}>
                            <div
                                aria-hidden
                                className={`hidden gap-8 border-b border-stone-200 bg-stone-100 px-6 py-3 text-xs font-semibold tracking-wider text-stone-600 uppercase lg:grid dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-stone-400 ${columns}`}
                            >
                                <span>{t('sources.columns.source')}</span>
                                <span>{t('sources.columns.shows')}</span>
                                <span>{t('sources.columns.freshness')}</span>
                            </div>
                            <dl className="divide-y divide-stone-100 dark:divide-neutral-800">
                                {SOURCES.map(({ key, garage }) => (
                                    <div key={key} className={`grid gap-2 px-4 py-4.5 lg:gap-8 lg:px-6 lg:py-5.5 ${columns}`}>
                                        <dt className="flex items-center gap-3.5">
                                            <span
                                                aria-hidden
                                                className="block h-9 w-7 shrink-0 [&_svg]:h-9 [&_svg]:w-7"
                                                dangerouslySetInnerHTML={{ __html: pinSvg(garage, null) }}
                                            />
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-[17px] font-semibold">{t(`sources.${key}.name`)}</span>
                                                <span className="text-sm text-stone-600 dark:text-stone-400">{t(`sources.${key}.kind`)}</span>
                                            </span>
                                        </dt>
                                        <dd className="leading-relaxed text-stone-700 dark:text-stone-300">
                                            <span className="sr-only">{t('sources.columns.shows')}: </span>
                                            {t(`sources.${key}.shows`)}
                                        </dd>
                                        <dd className="leading-relaxed text-stone-700 dark:text-stone-300">
                                            <span className="sr-only">{t('sources.columns.freshness')}: </span>
                                            {t(`sources.${key}.freshness`)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </section>

                    <div className="grid gap-14 lg:grid-cols-2 lg:gap-6">
                        <section aria-labelledby="about-why" className="flex flex-col gap-4 lg:pr-12">
                            <h2 id="about-why" className={heading}>
                                {t('why.title')}
                            </h2>
                            {body.map((paragraph) => (
                                <p key={paragraph} className="leading-[1.7] text-stone-700 lg:text-[17px] dark:text-stone-300">
                                    {paragraph}
                                </p>
                            ))}
                        </section>
                        <section aria-labelledby="about-details" className="flex flex-col">
                            <h2 id="about-details" className={`${heading} mb-4`}>
                                {t('details.title')}
                            </h2>
                            <dl className="border-t border-stone-200 dark:border-neutral-800">
                                {DETAILS.map((item) => (
                                    <div
                                        key={item}
                                        className="grid gap-0.5 border-b border-stone-200 py-3.5 lg:grid-cols-[11.25rem_minmax(0,1fr)] lg:gap-6 lg:py-4 dark:border-neutral-800"
                                    >
                                        <dt className="font-semibold">{t(`details.items.${item}.term`)}</dt>
                                        <dd className="text-[15px] text-stone-700 lg:text-base dark:text-stone-300">
                                            {t(`details.items.${item}.text`)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    </div>

                    <section aria-labelledby="about-notes" className="flex flex-col gap-4 lg:gap-6">
                        <h2 id="about-notes" className={heading}>
                            {t('notes.title')}
                        </h2>
                        <div className="grid border-t border-stone-200 lg:grid-cols-2 dark:border-neutral-800">
                            <div className="flex gap-4 border-b border-stone-200 py-5 lg:border-b-0 lg:py-7 lg:pr-12 dark:border-neutral-800">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas-strong dark:bg-neutral-800">
                                    <Code2 className="size-5 text-stone-700 dark:text-stone-300" aria-hidden />
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <h3 className="text-lg font-semibold">{t('open_source.title')}</h3>
                                    <p className="leading-relaxed text-stone-700 dark:text-stone-300">{t('open_source.text')}</p>
                                    <a
                                        href={GITHUB_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-h-11 items-center self-start font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400"
                                    >
                                        {t('open_source.link')}
                                    </a>
                                </div>
                            </div>
                            <div className="flex gap-4 py-5 lg:border-l lg:border-stone-200 lg:py-7 lg:pl-12 dark:lg:border-neutral-800">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas-strong dark:bg-neutral-800">
                                    <Signpost className="size-5 text-stone-700 dark:text-stone-300" aria-hidden />
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <h3 className="text-lg font-semibold">{t('disclaimer.title')}</h3>
                                    <p className="leading-relaxed text-stone-700 dark:text-stone-300">{t('disclaimer.text')}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        aria-labelledby="about-search"
                        className="grid gap-6 rounded-2xl bg-stone-900 p-6 text-white lg:grid-cols-[minmax(0,1fr)_38rem] lg:items-center lg:gap-12 lg:p-12 dark:bg-neutral-900"
                    >
                        <h2 id="about-search" className={`${heading} text-balance`}>
                            {t('search.title')}
                        </h2>
                        <HomeSearch hideLabel inverted />
                    </section>
                </div>
            </div>

            <Footer />
        </FrontendLayout>
    );
}
