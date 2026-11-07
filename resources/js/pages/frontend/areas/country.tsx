import {
    AreaHero,
    AreaKicker,
    AreaMapPreview,
    AreaTitle,
    card,
    municipalityContactUrl,
    muted,
    PillLink,
    primaryButton,
    RuleRow,
    SectionTitle,
    textLink,
    useAreaFormat,
    VerificationStatus,
    VerifiedBar,
} from '@/components/frontend/areas/area-parts';
import Footer from '@/components/frontend/footer';
import { Input } from '@/components/ui/input';
import FrontendLayout from '@/layouts/frontend-layout';
import { cn } from '@/lib/utils';
import type { CountryArea } from '@/types/area';
import { Head, Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const tableHead = 'border-b border-neutral-200 px-4 py-3 dark:border-neutral-800';
const tableCell = 'border-b border-stone-100 px-4 py-3.5 dark:border-neutral-800';

export default function Country(area: CountryArea) {
    const { t } = useTranslation('frontend/areas');
    const [query, setQuery] = useState('');

    return (
        <FrontendLayout>
            <Head title={t('meta.title', { name: area.name })}>
                <meta head-key="description" name="description" content={t('meta.description.country', { name: area.name })} />
                <link head-key="canonical" rel="canonical" href={area.canonical} />
                {!area.indexable && <meta head-key="robots" name="robots" content="noindex" />}
            </Head>

            <div className="bg-canvas text-stone-900 dark:bg-neutral-950 dark:text-white">
                <AreaHero breadcrumbs={area.breadcrumbs}>
                    <section className="grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
                        <div className="flex min-w-0 flex-col gap-4 lg:gap-5.5">
                            <AreaKicker>{t('kicker.country')}</AreaKicker>
                            <AreaTitle name={area.name} />
                            <p className={cn('max-w-[540px] text-[17px] leading-[1.6] lg:text-lg', muted)}>
                                {t('intro.country', { count: area.municipalities.length })}
                            </p>
                            {area.municipalities.length > 0 && <MunicipalitySearch area={area} query={query} onQuery={setQuery} />}
                        </div>
                        {area.preview && area.map_url && (
                            <AreaMapPreview preview={area.preview} href={area.map_url} name={area.name} className="h-60 lg:h-[420px]" />
                        )}
                    </section>
                </AreaHero>

                <div className="mx-auto flex max-w-7xl flex-col gap-14 px-5 pt-10 pb-14 sm:px-6 lg:gap-20 lg:px-8 lg:pt-16 lg:pb-26">
                    {area.indexable ? (
                        <>
                            <Totals area={area} />
                            {area.regions.length > 0 && <Regions area={area} />}
                            <AllMunicipalities area={area} query={query} />
                            {area.without_open_data > 0 && <ForMunicipalities />}
                            <div className="flex flex-col gap-12 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-18 lg:gap-y-12">
                                <Rules area={area} />
                                <Sources area={area} />
                            </div>
                        </>
                    ) : (
                        <div className={cn(card, 'flex flex-col gap-1.5 p-6')}>
                            <strong>{t('empty.title')}</strong>
                            <span className={muted}>{t('empty.text')}</span>
                        </div>
                    )}
                    {area.countries.length > 0 && <OtherCountries area={area} />}
                </div>
            </div>
            <Footer />
        </FrontendLayout>
    );
}

function MunicipalitySearch({ area, query, onQuery }: { area: CountryArea; query: string; onQuery: (value: string) => void }) {
    const { t } = useTranslation('frontend/areas');
    const largest = [...area.municipalities].sort((a, b) => b.spaces - a.spaces).slice(0, 4);

    return (
        <form role="search" className="mt-1.5 flex max-w-[560px] flex-col gap-2.5" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="municipality-search" className="text-[15px] font-semibold">
                {t('search.label')}
            </label>
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-stone-500" aria-hidden />
                <Input
                    id="municipality-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                        onQuery(event.target.value);
                        if (event.target.value) document.getElementById('all-municipalities')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    }}
                    placeholder={t('search.placeholder')}
                    autoComplete="off"
                    aria-controls="all-municipalities"
                    className="h-14 rounded-xl border-stone-300 bg-white pl-11 text-[17px] md:text-[17px] dark:bg-neutral-900"
                />
            </div>
            <div className={cn('flex flex-wrap items-center gap-x-4.5 gap-y-1 text-[15px]', muted)}>
                <span>{t('search.largest')}</span>
                {largest.map((municipality) => (
                    <Link key={municipality.href} href={municipality.href} className={cn('flex min-h-11 items-center', textLink)}>
                        {municipality.name}
                    </Link>
                ))}
            </div>
        </form>
    );
}

function Totals({ area }: { area: CountryArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const { totals } = area;
    const items = [
        { key: 'spaces', value: totals.spaces },
        { key: 'garages', value: totals.garages },
        { key: 'park_and_ride', value: totals.park_and_ride },
        { key: 'municipalities', value: area.municipalities.length },
    ] as const;

    return (
        <section aria-labelledby="totals" className="flex flex-col gap-5">
            <SectionTitle id="totals" size="medium">
                {t('country.totals', { name: area.name })}
            </SectionTitle>
            <dl className="grid grid-cols-2 border-y border-stone-200 lg:grid-cols-4 dark:border-neutral-800">
                {items.map((item, index) => (
                    <div
                        key={item.key}
                        className={cn(
                            'flex flex-col-reverse gap-0.5 border-stone-200 py-5 lg:py-6 dark:border-neutral-800',
                            index % 2 === 1 ? 'border-l pl-4 lg:pl-6' : 'pr-4 lg:pr-6',
                            index === 2 && 'max-lg:border-t lg:border-l lg:pl-6',
                            index === 3 && 'max-lg:border-t lg:pr-0',
                        )}
                    >
                        <dt className={cn('text-[15px]', muted)}>{t(`counts.${item.key}`)}</dt>
                        <dd className="text-[32px] leading-[1.1] font-bold tracking-[-0.03em] tabular-nums lg:text-[40px]">
                            {format.number(item.value)}
                        </dd>
                    </div>
                ))}
            </dl>
            {totals.spaces > 0 && <VerificationStatus totals={totals} showLast={false} split className={cn(card, 'px-5 py-5 lg:px-7 lg:py-6')} />}
        </section>
    );
}

function Regions({ area }: { area: CountryArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();

    return (
        <section aria-labelledby="regions" className="flex flex-col gap-5">
            <SectionTitle id="regions">{t('country.regions')}</SectionTitle>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <table aria-labelledby="regions" className="w-full min-w-[900px] border-collapse">
                    <thead>
                        <tr className="text-xs font-semibold tracking-[0.05em] text-neutral-500 uppercase dark:text-neutral-400">
                            <th scope="col" className={cn(tableHead, 'px-5 text-left')}>
                                {t('table.region')}
                            </th>
                            {(['municipalities', 'spaces', 'garages', 'park_and_ride'] as const).map((key) => (
                                <th key={key} scope="col" className={cn(tableHead, 'text-right')}>
                                    {t(`table.${key}`)}
                                </th>
                            ))}
                            <th scope="col" className={cn(tableHead, 'pr-5 pl-6 text-left')}>
                                {t('table.verified')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {area.regions.map((region) => (
                            <tr key={region.href}>
                                <th scope="row" className={cn(tableCell, 'px-5 text-left font-semibold')}>
                                    <Link
                                        href={region.href}
                                        className="text-stone-900 underline underline-offset-2 hover:text-orange-700 dark:text-white"
                                    >
                                        {region.name}
                                    </Link>
                                </th>
                                {(['municipalities', 'spaces', 'garages', 'park_and_ride'] as const).map((key) => (
                                    <td key={key} className={cn(tableCell, 'text-right tabular-nums')}>
                                        {format.number(region[key])}
                                    </td>
                                ))}
                                <td className={cn(tableCell, 'pr-5 pl-6')}>
                                    <VerifiedBar verified={region.verified} spaces={region.spaces} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function AllMunicipalities({ area, query }: { area: CountryArea; query: string }) {
    const { t, i18n } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const needle = query.trim().toLocaleLowerCase(i18n.language);
    const matches = useMemo(
        () => area.municipalities.filter((municipality) => !needle || municipality.name.toLocaleLowerCase(i18n.language).includes(needle)),
        [area.municipalities, needle, i18n.language],
    );
    const groups = useMemo(() => {
        const byLetter = new Map<string, typeof matches>();
        for (const municipality of matches) {
            const letter = municipality.name.normalize('NFD').charAt(0).toLocaleUpperCase(i18n.language);
            byLetter.set(letter, [...(byLetter.get(letter) ?? []), municipality]);
        }
        return [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b, i18n.language));
    }, [matches, i18n.language]);

    return (
        <section id="all-municipalities" aria-labelledby="az" className="flex scroll-mt-6 flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
                <SectionTitle id="az">{t('country.all')}</SectionTitle>
                <p role="status" className={cn('text-[15px]', muted)}>
                    {needle
                        ? t('country.filtered', { count: matches.length, total: area.municipalities.length })
                        : t('country.result', { count: area.municipalities.length })}
                </p>
            </div>
            {groups.length > 0 && (
                <nav aria-label={t('country.letters')} className="flex flex-wrap gap-1">
                    {groups.map(([letter]) => (
                        <a
                            key={letter}
                            href={`#letter-${letter}`}
                            className="flex size-11 items-center justify-center rounded-lg border border-stone-200 bg-white font-semibold text-stone-900 hover:border-stone-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        >
                            {letter}
                        </a>
                    ))}
                </nav>
            )}
            {groups.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-10 gap-y-7">
                    {groups.map(([letter, municipalities]) => (
                        <div key={letter} id={`letter-${letter}`} className="flex scroll-mt-6 flex-col gap-1.5">
                            <h3 className="border-b border-stone-200 pb-1.5 text-xl font-bold dark:border-neutral-800">{letter}</h3>
                            <ul className="flex flex-col">
                                {municipalities.map((municipality) => (
                                    <li key={municipality.href}>
                                        <Link
                                            href={municipality.href}
                                            className="flex min-h-10 items-center justify-between gap-3 text-stone-900 hover:text-orange-700 dark:text-white"
                                        >
                                            <span className="font-medium">{municipality.name}</span>
                                            <span className={cn('text-sm tabular-nums', muted)}>{format.number(municipality.spaces)}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={cn(card, 'flex flex-col gap-1.5 p-6')}>
                    <strong>{t('country.none_title')}</strong>
                    <span className={muted}>{t('country.none_text')}</span>
                </div>
            )}
        </section>
    );
}

function ForMunicipalities() {
    const { t } = useTranslation('frontend/areas');

    return (
        <section
            aria-labelledby="for-municipalities"
            className="flex flex-col gap-6 rounded-xl bg-canvas-strong px-5 py-7 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-12 lg:px-10 lg:py-9 dark:bg-neutral-900"
        >
            <div className="flex min-w-0 flex-col gap-2.5 lg:flex-[1_1_520px]">
                <span className={cn('text-[15px] font-medium', muted)}>{t('for_municipalities.kicker')}</span>
                <h2 id="for-municipalities" className="text-2xl leading-[1.2] font-bold tracking-[-0.025em] lg:text-[32px]">
                    {t('for_municipalities.country_title')}
                </h2>
                <p className={cn('max-w-[640px] text-[17px]', muted)}>{t('for_municipalities.country_text')}</p>
            </div>
            <Link href={municipalityContactUrl} className={cn(primaryButton, 'self-start lg:self-auto')}>
                {t('for_municipalities.action')}
            </Link>
        </section>
    );
}

function Rules({ area }: { area: CountryArea }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <section aria-labelledby="rules" className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_480px] lg:gap-5">
            <SectionTitle id="rules" size="medium">
                {t('rules.title')}
            </SectionTitle>
            {area.national_rule ? (
                <ul className={cn(card, 'overflow-hidden')}>
                    <RuleRow
                        rule={area.national_rule}
                        title={t('rules.national')}
                        scope={t('rules.national_scope', { host: area.national_rule.host })}
                    />
                </ul>
            ) : (
                <p className={muted}>{t('rules.none', { name: area.name })}</p>
            )}
            <p className={cn('text-[15px]', muted)}>{t('rules.country_note')}</p>
        </section>
    );
}

function Sources({ area }: { area: CountryArea }) {
    const { t } = useTranslation('frontend/areas');
    const rows = [
        { key: 'municipal' as const, count: area.sources.open_data, text: t('sources.open_data_count', { count: area.sources.open_data }) },
        { key: 'community' as const, count: area.sources.community, text: t('sources.community_count', { count: area.sources.community }) },
        { key: 'facilities' as const, count: area.sources.live, text: t('sources.live_count', { count: area.sources.live }) },
    ].filter((row) => row.count > 0);

    return (
        <section aria-labelledby="sources" className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_400px] lg:gap-5">
            <SectionTitle id="sources" size="medium">
                {t('sources.title')}
            </SectionTitle>
            <dl className="border-t border-stone-200 dark:border-neutral-800">
                {rows.map((row) => (
                    <div key={row.key} className="flex justify-between gap-4 border-b border-stone-200 py-3.5 dark:border-neutral-800">
                        <dt className="font-semibold">{t(`sources.${row.key}`)}</dt>
                        <dd className={cn('text-right text-[15px]', muted)}>{row.text}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function OtherCountries({ area }: { area: CountryArea }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <section aria-labelledby="countries" className="flex flex-col gap-4">
            <SectionTitle id="countries" size="small">
                {t('country.others')}
            </SectionTitle>
            <ul className="flex flex-wrap gap-2.5">
                {area.countries.map((country) => (
                    <li key={country.href}>
                        <PillLink href={country.href}>
                            {country.name}
                            <span className={cn('font-normal', muted)}>{t('country.others_count', { count: country.municipalities })}</span>
                        </PillLink>
                    </li>
                ))}
            </ul>
        </section>
    );
}
