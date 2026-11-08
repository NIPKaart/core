import {
    actionLink,
    AreaHero,
    AreaKicker,
    AreaMapPreview,
    AreaTitle,
    card,
    MapButton,
    municipalityContactUrl,
    muted,
    primaryButton,
    RuleRow,
    RulesDisclaimer,
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
import { garages } from '@/routes';
import type { RegionArea } from '@/types/area';
import { Head, Link } from '@inertiajs/react';
import { Landmark, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Sort = 'count' | 'verified' | 'facilities' | 'name';

const tableHead = 'border-b border-neutral-200 px-4 py-3 dark:border-neutral-800';
const tableCell = 'border-b border-stone-100 px-4 py-3.5 dark:border-neutral-800';

export default function Region(area: RegionArea) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const { totals } = area;

    return (
        <FrontendLayout>
            <Head title={t('meta.title', { name: area.name })}>
                <meta head-key="description" name="description" content={t('meta.description.region', { name: area.name })} />
                <link head-key="canonical" rel="canonical" href={area.canonical} />
                {!area.indexable && <meta head-key="robots" name="robots" content="noindex" />}
            </Head>

            <div className="bg-canvas text-stone-900 dark:bg-neutral-950 dark:text-white">
                <AreaHero breadcrumbs={area.breadcrumbs}>
                    <section className="grid gap-4 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-7">
                        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-5.5">
                            <AreaKicker>{t('kicker.region', { country: area.country.name })}</AreaKicker>
                            <AreaTitle name={area.name} />
                            <dl className="mt-1.5 flex flex-wrap gap-x-10 gap-y-4">
                                {(['spaces', 'garages', 'park_and_ride'] as const)
                                    .filter((key) => totals[key] > 0)
                                    .map((key) => (
                                        <div key={key} className="flex flex-col-reverse">
                                            <dt className={cn('text-[15px]', muted)}>{t(`counts.${key}`)}</dt>
                                            <dd className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] tabular-nums lg:text-4xl">
                                                {format.number(totals[key])}
                                            </dd>
                                        </div>
                                    ))}
                            </dl>
                            {totals.spaces > 0 && (
                                <VerificationStatus
                                    totals={totals}
                                    showLast={false}
                                    className={cn(card, 'max-w-[540px] px-4.5 py-4 lg:px-5.5 lg:py-5')}
                                />
                            )}
                        </div>
                        {area.preview && area.map_url && (
                            <AreaMapPreview
                                preview={area.preview}
                                href={area.map_url}
                                name={area.name}
                                className="mt-1 h-60 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:h-auto lg:min-h-[400px]"
                            />
                        )}
                        {area.map_url && (
                            <div className="flex flex-wrap gap-3 lg:col-start-1 lg:row-start-2">
                                <MapButton href={area.map_url} name={area.name} className="h-13 w-full lg:h-12 lg:w-auto" />
                            </div>
                        )}
                    </section>
                </AreaHero>

                <div className="mx-auto flex max-w-7xl flex-col gap-14 px-5 pt-10 pb-14 sm:px-6 lg:gap-20 lg:px-8 lg:pt-16 lg:pb-26">
                    {area.municipalities.length > 0 && <MunicipalityTable area={area} />}
                    {totals.garages + totals.park_and_ride > 0 && <Facilities area={area} />}
                    <ForMunicipalities area={area} />

                    <div className="flex flex-col gap-12 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-18 lg:gap-y-12">
                        <Rules area={area} />
                        <OtherRegions area={area} />
                    </div>
                </div>
            </div>
            <Footer />
        </FrontendLayout>
    );
}

function MunicipalityTable({ area }: { area: RegionArea }) {
    const { t, i18n } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('count');
    const rows = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase(i18n.language);
        const matching = area.municipalities.filter((row) => !needle || row.name.toLocaleLowerCase(i18n.language).includes(needle));
        const share = (row: (typeof matching)[number]) => (row.spaces > 0 ? row.verified / row.spaces : -1);

        return [...matching].sort((a, b) => {
            if (sort === 'count') return b.spaces - a.spaces;
            if (sort === 'verified') return share(b) - share(a);
            if (sort === 'facilities') return b.garages + b.park_and_ride - (a.garages + a.park_and_ride) || b.spaces - a.spaces;
            return a.name.localeCompare(b.name, i18n.language);
        });
    }, [area.municipalities, query, sort, i18n.language]);

    return (
        <section aria-labelledby="municipalities" className="flex flex-col gap-5">
            <SectionTitle id="municipalities">
                {t('region.municipalities')} <span className={cn('font-medium', muted)}>{area.municipalities.length}</span>
            </SectionTitle>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-90">
                    <label htmlFor="region-filter" className="sr-only">
                        {t('search.region_label', { name: area.name })}
                    </label>
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-500" aria-hidden />
                    <Input
                        id="region-filter"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('search.region_placeholder')}
                        autoComplete="off"
                        className="h-11 rounded-[10px] border-stone-300 bg-white pl-10 text-[15px] dark:bg-neutral-900"
                    />
                </div>
                <div
                    role="group"
                    aria-label={t('table.sort')}
                    className="flex flex-wrap gap-1 rounded-[10px] bg-stone-200/70 p-1 dark:bg-neutral-800"
                >
                    {(['count', 'verified', 'facilities', 'name'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={sort === value}
                            onClick={() => setSort(value)}
                            className={cn(
                                'h-9 rounded-[7px] px-3.5 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                sort === value
                                    ? 'bg-white font-semibold text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-neutral-950 dark:text-white'
                                    : 'text-stone-700 hover:bg-white/60 dark:text-stone-300 dark:hover:bg-neutral-900/60',
                            )}
                        >
                            {t(`table.sorts.${value}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <table aria-labelledby="municipalities" className="w-full min-w-[900px] border-collapse">
                    <thead>
                        <tr className="text-xs font-semibold tracking-[0.05em] text-neutral-500 uppercase dark:text-neutral-400">
                            <th scope="col" className={cn(tableHead, 'px-5 text-left')}>
                                {t('table.municipality')}
                            </th>
                            <th scope="col" className={cn(tableHead, 'text-right')}>
                                {t('table.spaces')}
                            </th>
                            <th scope="col" className={cn(tableHead, 'text-right')}>
                                {t('table.garages')}
                            </th>
                            <th scope="col" className={cn(tableHead, 'text-right')}>
                                {t('table.park_and_ride')}
                            </th>
                            <th scope="col" className={cn(tableHead, 'pl-6 text-left')}>
                                {t('table.verified')}
                            </th>
                            <th scope="col" className={cn(tableHead, 'pr-5 text-left')}>
                                {t('table.data')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.href}>
                                <th scope="row" className={cn(tableCell, 'px-5 text-left font-semibold')}>
                                    <Link
                                        href={row.href}
                                        className="text-stone-900 underline underline-offset-2 hover:text-orange-700 dark:text-white"
                                    >
                                        {row.name}
                                    </Link>
                                </th>
                                <td className={cn(tableCell, 'text-right tabular-nums')}>{row.spaces > 0 ? format.number(row.spaces) : <Dash />}</td>
                                <td className={cn(tableCell, 'text-right tabular-nums')}>
                                    {row.garages > 0 ? format.number(row.garages) : <Dash />}
                                </td>
                                <td className={cn(tableCell, 'text-right tabular-nums')}>
                                    {row.park_and_ride > 0 ? format.number(row.park_and_ride) : <Dash />}
                                </td>
                                <td className={cn(tableCell, 'pl-6')}>
                                    <VerifiedBar verified={row.verified} spaces={row.spaces} />
                                </td>
                                <td className={cn(tableCell, 'pr-5 text-sm text-stone-700 dark:text-stone-300')}>
                                    <span className="inline-flex items-center gap-2">
                                        {row.spaces === 0 ? null : row.municipal ? (
                                            <Landmark className="size-4 text-stone-600" aria-hidden />
                                        ) : (
                                            <Users className="size-4 text-stone-600" aria-hidden />
                                        )}
                                        {t(row.spaces === 0 ? 'table.facilities_only' : row.municipal ? 'table.municipal' : 'table.community')}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && <p className={cn('p-5', muted)}>{t('table.none', { name: area.name })}</p>}
            </div>
        </section>
    );
}

function Dash() {
    return <span className="text-stone-500">–</span>;
}

function Facilities({ area }: { area: RegionArea }) {
    const { t, i18n } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const { totals } = area;
    const live = totals.live_garages + totals.live_park_and_ride;
    const places = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(area.live_municipalities.slice(0, 3));
    const title = [
        totals.garages > 0 ? t('region.garages', { count: totals.garages, value: format.number(totals.garages) }) : null,
        totals.park_and_ride > 0 ? t('region.park_and_ride', { count: totals.park_and_ride }) : null,
    ].filter(Boolean) as string[];

    return (
        <section
            aria-labelledby="facilities"
            className="flex flex-col gap-5 rounded-xl bg-canvas-strong px-5 py-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-10 lg:px-9 lg:py-8 dark:bg-neutral-900"
        >
            <div className="flex min-w-0 items-center gap-4.5 lg:flex-[1_1_460px]">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#27313a] text-[22px] font-bold text-white"
                >
                    P
                </span>
                <span className="flex flex-col gap-1">
                    <h2 id="facilities" className="text-xl leading-[1.3] font-bold tracking-[-0.02em] lg:text-2xl">
                        {title.length === 2
                            ? t('region.facilities_title', { garages: title[0], parkAndRide: title[1], name: area.name })
                            : `${title[0]}`}
                    </h2>
                    <span className={cn('text-base', muted)}>{live > 0 ? t('region.live_in', { count: live, places }) : t('region.live_none')}</span>
                </span>
            </div>
            <Link
                href={garages().url}
                className="inline-flex h-12 items-center justify-center self-start rounded-xl border border-stone-300 bg-white px-5.5 font-semibold text-stone-900 hover:bg-stone-50 lg:self-auto dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
                {t('region.view_occupancy')}
            </Link>
        </section>
    );
}

function ForMunicipalities({ area }: { area: RegionArea }) {
    const { t } = useTranslation('frontend/areas');
    const without = area.municipalities.filter((row) => !row.municipal && row.spaces > 0).length;
    if (without === 0) return null;

    return (
        <section
            aria-labelledby="for-municipalities"
            className={cn(
                card,
                'flex flex-col gap-5 px-5 py-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-10 lg:px-8 lg:py-7',
            )}
        >
            <div className="flex min-w-0 flex-col gap-2 lg:flex-[1_1_520px]">
                <span className={cn('text-[15px] font-medium', muted)}>{t('for_municipalities.kicker')}</span>
                <h2 id="for-municipalities" className="text-xl leading-[1.3] font-bold tracking-[-0.02em] lg:text-2xl">
                    {t('for_municipalities.region_title', { name: area.name })}
                </h2>
                <p className={cn('text-base', muted)}>{t('for_municipalities.region_text')}</p>
            </div>
            <Link href={municipalityContactUrl} className={cn(primaryButton, 'self-start lg:self-auto')}>
                {t('for_municipalities.action')}
            </Link>
        </section>
    );
}

function Rules({ area }: { area: RegionArea }) {
    const { t } = useTranslation('frontend/areas');
    const hasRules = area.municipal_rules.length > 0 || area.national_rule;

    return (
        <section aria-labelledby="rules" className="flex min-w-0 flex-col gap-4 lg:flex-[999_1_560px] lg:gap-5">
            <SectionTitle id="rules" size="medium">
                {t('rules.title')}
            </SectionTitle>
            {hasRules ? (
                <div className={cn(card, 'overflow-hidden')}>
                    {area.municipal_rules.length > 0 && (
                        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-6 py-4.5 last:border-b-0 dark:border-neutral-800">
                            <span className="flex flex-col gap-0.5">
                                <strong className="text-[17px]">{t('rules.own_pages')}</strong>
                                <span className={cn('text-sm', muted)}>
                                    {t('rules.own_pages_count', { count: area.municipal_rules.length, total: area.municipalities.length })}
                                </span>
                            </span>
                            <ul className="flex flex-wrap gap-x-4.5 gap-y-1">
                                {area.municipal_rules.map((rule) => (
                                    <li key={rule.url}>
                                        <a
                                            href={rule.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn('flex min-h-9 items-center', textLink)}
                                        >
                                            {rule.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {area.national_rule && (
                        <ul>
                            <RuleRow
                                rule={area.national_rule}
                                title={t('rules.official_national', { name: area.country.name })}
                                scope={t(area.municipal_rules.length > 0 ? 'rules.national_scope_others' : 'rules.national_scope', {
                                    host: area.national_rule.host,
                                })}
                            />
                        </ul>
                    )}
                </div>
            ) : (
                <p className={muted}>{t('rules.none', { name: area.name })}</p>
            )}
            <RulesDisclaimer />
        </section>
    );
}

function OtherRegions({ area }: { area: RegionArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();

    return (
        <section aria-labelledby="other-regions" className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_340px] lg:gap-5">
            {area.other_regions.length > 0 && (
                <SectionTitle id="other-regions" size="medium">
                    {t('region.others')}
                </SectionTitle>
            )}
            {area.other_regions.length > 0 && (
                <ul className="border-t border-stone-200 dark:border-neutral-800">
                    {area.other_regions.map((region) => (
                        <li key={region.href} className="border-b border-stone-200 dark:border-neutral-800">
                            <Link
                                href={region.href}
                                className="flex min-h-13 items-center justify-between gap-4 text-stone-900 hover:text-orange-700 dark:text-white"
                            >
                                <span className="font-semibold">{region.name}</span>
                                <span className={cn('text-sm tabular-nums', muted)}>
                                    {t('region.others_spaces', { count: region.spaces, value: format.number(region.spaces) })}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <Link href={area.country.href} className={actionLink}>
                {t('region.all')}
            </Link>
        </section>
    );
}
