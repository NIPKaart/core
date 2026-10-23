import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { about, contact, garages, home, locationMap } from '@/routes';
import { add } from '@/routes/location-map';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, ChevronRight, Plus, SquareParking } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const destinations = { home, 'location-map': locationMap, 'location-map.add': add, garages, about, contact };

type BioItem = {
    id: string;
    title: string;
    note: string | null;
    action: string | null;
    route: keyof typeof destinations | null;
    url: string | null;
    image: string | null;
};

interface BioProps {
    campaign: BioItem | null;
    links: BioItem[];
    socials: BioItem[];
    canonical: string;
    socialImage: string;
}

const focus =
    'outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-4 dark:focus-visible:ring-orange-400 dark:focus-visible:ring-offset-neutral-950';

function DestinationLink({ item, className, children }: { item: BioItem; className?: string; children: ReactNode }) {
    const classes = cn(focus, className);

    return item.route ? (
        <Link href={destinations[item.route]()} className={classes}>
            {children}
        </Link>
    ) : (
        <a href={item.url ?? undefined} className={classes}>
            {children}
        </a>
    );
}

export default function Bio({ campaign, links, socials, canonical, socialImage }: BioProps) {
    const { t } = useTranslation('frontend/bio');

    return (
        <div className="min-h-dvh bg-canvas text-stone-950 dark:bg-neutral-950 dark:text-stone-100">
            <Head title={t('meta.title')}>
                <meta head-key="description" name="description" content={t('meta.description')} />
                <link head-key="canonical" rel="canonical" href={canonical} />
                <meta head-key="og:title" property="og:title" content={`${t('meta.title')} - NIPKaart`} />
                <meta head-key="og:description" property="og:description" content={t('meta.description')} />
                <meta head-key="og:type" property="og:type" content="website" />
                <meta head-key="og:url" property="og:url" content={canonical} />
                <meta head-key="og:image" property="og:image" content={socialImage} />
                <meta head-key="twitter:card" name="twitter:card" content="summary_large_image" />
            </Head>

            <div className="mx-auto flex w-full max-w-[34rem] flex-col px-6 pt-3 pb-6 sm:px-8 sm:pt-8 sm:pb-10">
                <header className="mb-5 flex">
                    <Link href={home()} aria-label={t('home')} className={cn('inline-flex min-h-11 items-center rounded-sm', focus)}>
                        <img src="/assets/images/logo-light.svg" width="104" height="40" alt="NIPKaart" className="h-6 w-auto dark:hidden" />
                        <img src="/assets/images/logo-dark.svg" width="104" height="40" alt="NIPKaart" className="hidden h-6 w-auto dark:block" />
                    </Link>
                </header>

                <main className="flex flex-col gap-6">
                    <section aria-labelledby="bio-title" className="flex flex-col gap-3">
                        <p className="text-xs font-semibold tracking-[0.14em] text-orange-700 uppercase dark:text-orange-400">{t('eyebrow')}</p>
                        <h1 id="bio-title" className="text-[2rem] leading-[1.08] font-bold tracking-[-0.035em] sm:text-[2.5rem]">
                            {t('title')}
                        </h1>
                        <p className="text-base leading-relaxed text-stone-600 sm:text-lg dark:text-stone-300">{t('intro')}</p>
                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                asChild
                                className={cn(
                                    'relative h-auto min-h-12 w-full justify-center gap-3 rounded-lg bg-stone-900 px-10 py-3 text-center text-base font-semibold whitespace-normal text-white shadow-none hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white',
                                    focus,
                                )}
                            >
                                <Link href={locationMap()}>
                                    {t('primary')}
                                    <ArrowRight className="absolute right-4 size-5 shrink-0" aria-hidden />
                                </Link>
                            </Button>
                            <p className="text-sm text-stone-600 dark:text-stone-400">{t('no_account')}</p>
                        </div>
                    </section>

                    {campaign && (
                        <section aria-labelledby="bio-campaign" className="rounded-xl bg-canvas-strong p-2 dark:bg-neutral-900">
                            {campaign.image && (
                                <img
                                    src={campaign.image}
                                    alt=""
                                    width="1916"
                                    height="821"
                                    className="aspect-[2.33] w-full rounded-lg object-cover"
                                    decoding="async"
                                />
                            )}
                            <div className={cn('flex flex-col gap-2 px-1', campaign.image ? 'pt-3' : 'pt-2')}>
                                <p className="text-xs font-semibold tracking-[0.12em] text-orange-700 uppercase dark:text-orange-400">
                                    {t('featured')}
                                </p>
                                <h2
                                    id="bio-campaign"
                                    className="text-[1.625rem] leading-[1.12] font-bold tracking-[-0.025em] text-balance sm:text-[2rem]"
                                >
                                    {campaign.title}
                                </h2>
                                {campaign.note && <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{campaign.note}</p>}
                                <DestinationLink
                                    item={campaign}
                                    className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm text-base font-semibold underline decoration-orange-700 underline-offset-8 dark:decoration-orange-400"
                                >
                                    {campaign.action}
                                    <ArrowRight className="size-5" aria-hidden />
                                </DestinationLink>
                            </div>
                        </section>
                    )}

                    {links.length > 0 && (
                        <nav aria-label={t('links')}>
                            <ul className="divide-y divide-stone-200 dark:divide-neutral-800">
                                {links.map((item) => {
                                    const Icon = item.route === 'location-map.add' ? Plus : item.route === 'garages' ? SquareParking : null;

                                    return (
                                        <li key={item.id}>
                                            <DestinationLink
                                                item={item}
                                                className="group flex min-h-12 items-center gap-3 rounded-sm py-2 text-sm font-semibold hover:text-orange-800 dark:hover:text-orange-300"
                                            >
                                                {Icon && (
                                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100/60 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                                                        <Icon className="size-5" aria-hidden />
                                                    </span>
                                                )}
                                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                    {item.title}
                                                    {item.note && (
                                                        <span className="text-sm font-normal text-stone-600 dark:text-stone-400">{item.note}</span>
                                                    )}
                                                </span>
                                                <ChevronRight
                                                    className="size-4 shrink-0 text-stone-500 group-hover:text-current dark:text-stone-400"
                                                    aria-hidden
                                                />
                                            </DestinationLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                    )}

                    {socials.length > 0 && (
                        <nav aria-label={t('socials')} className="border-t border-stone-200 pt-4 dark:border-neutral-800">
                            <ul className="flex flex-wrap gap-x-5 gap-y-1">
                                {socials.map((item) => (
                                    <li key={item.id}>
                                        <DestinationLink
                                            item={item}
                                            className="inline-flex min-h-11 items-center rounded-sm text-sm underline underline-offset-4"
                                        >
                                            {item.title}
                                        </DestinationLink>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    )}
                </main>
            </div>
        </div>
    );
}
