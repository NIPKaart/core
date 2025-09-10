import { locationAdd } from '@/actions/App/Http/Controllers/Frontend/ParkingSpaceController';
import FeatureCard from '@/components/frontend/feature-card';
import HeroAbout from '@/components/frontend/hero-about';
import FrontendLayout from '@/layouts/frontend-layout';
import { garages, locationMap } from '@/routes';

import { Head, Link } from '@inertiajs/react';
import { Building2, CheckCircle, Plus, Search, Share2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** Types & helpers */
type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type FeatureItem = { icon: IconType; title: string; desc: string; href: string; cta: string };

function arrayFrom<T = string>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string') {
        const parts = value
            .split(/[\n,|]/g)
            .map((s) => s.trim())
            .filter(Boolean);
        return parts as unknown as T[];
    }
    if (value && typeof value === 'object') return Object.values(value as Record<string, T>);
    return [];
}

function Pill({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-gray-200 dark:ring-neutral-700">
            {label}
        </span>
    );
}

/** Page */
export default function About() {
    const { t } = useTranslation('frontend/about');

    const features: FeatureItem[] = [
        {
            icon: Plus,
            title: t('features.items.addSpot.title'),
            desc: t('features.items.addSpot.desc'),
            href: '/map/add',
            cta: t('features.items.addSpot.cta'),
        },
        {
            icon: Share2,
            title: t('features.items.share.title'),
            desc: t('features.items.share.desc'),
            href: locationMap().url,
            cta: t('features.items.share.cta'),
        },
        {
            icon: Building2,
            title: t('features.items.offstreet.title'),
            desc: t('features.items.offstreet.desc'),
            href: garages().url,
            cta: t('features.items.offstreet.cta'),
        },
        {
            icon: Search,
            title: t('features.items.search.title'),
            desc: t('features.items.search.desc'),
            href: locationMap().url,
            cta: t('features.items.search.cta'),
        },
    ];

    const whatList = arrayFrom<string>(t('what.list', { returnObjects: true }));
    const keywords = arrayFrom<string>(t('meta.keywords', { returnObjects: true }));
    const introBody = arrayFrom<string>(t('intro.body', { returnObjects: true }));

    return (
        <FrontendLayout>
            <Head title={String(t('meta.title'))}>
                <meta name="description" content={String(t('meta.description'))} />
                <meta name="keywords" content={keywords.length ? keywords.join(',') : 'about'} />
            </Head>

            <HeroAbout eyebrow={t('hero.eyebrow')} title={t('hero.title')} subtitle={t('hero.subtitle')} align="center" />

            <main className="mx-auto -mt-14 max-w-7xl px-6 pb-24">
                <section className="grid items-start gap-10 md:grid-cols-2">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('intro.heading')}</h2>
                        <div className="mt-4 space-y-4 text-base leading-7 text-gray-700 dark:text-gray-300">
                            {introBody.map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Pill label={t('stats.euCoverage')} />
                            <Pill label={t('stats.openData')} />
                            <Pill label={t('stats.rebuiltBadge')} />
                            <Pill label={t('stats.communityPowered')} />
                        </div>
                    </div>

                    <div className="self-start rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/60">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('what.heading')}</h3>
                        <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <p>{t('what.text')}</p>
                            <ul className="mt-2 space-y-1">
                                {whatList.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="mt-16">
                    <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('features.heading')}</h3>
                    <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                        {features.map((f, i) => (
                            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} cta={{ href: f.href, label: f.cta }} />
                        ))}
                    </div>
                </section>

                <section className="mt-16">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 italic dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-gray-300">
                        {t('disclaimer')}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 p-5 dark:border-neutral-800">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{t('cta.heading')}</h4>
                            <p className="text-gray-700 dark:text-gray-300">{t('cta.body')}</p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href={locationAdd()}
                                className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
                            >
                                {t('cta.primary')}
                            </Link>
                            <Link
                                href={locationMap()}
                                className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800"
                            >
                                {t('cta.secondary')}
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        </FrontendLayout>
    );
}
