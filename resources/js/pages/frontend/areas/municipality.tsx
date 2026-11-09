import {
    actionLink,
    AreaHero,
    AreaKicker,
    AreaMapPreview,
    AreaPin,
    AreaTitle,
    card,
    MapButton,
    municipalityContactUrl,
    muted,
    PillLink,
    primaryButton,
    RuleRow,
    RulesDisclaimer,
    SectionTitle,
    useAreaFormat,
    VerificationStatus,
} from '@/components/frontend/areas/area-parts';
import Footer from '@/components/frontend/footer';
import FrontendLayout from '@/layouts/frontend-layout';
import { cn } from '@/lib/utils';
import { garages } from '@/routes';
import { check } from '@/routes/areas/municipality';
import { add } from '@/routes/location-map';
import type { MunicipalityArea } from '@/types/area';
import { Head, Link } from '@inertiajs/react';
import { ChevronRight, MapPinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Municipality(area: MunicipalityArea) {
    const { t } = useTranslation('frontend/areas');
    const parent = area.region ?? area.country;

    return (
        <FrontendLayout>
            <Head title={t('meta.title', { name: area.name })}>
                <meta head-key="description" name="description" content={t('meta.description.municipality', { name: area.name })} />
                <link head-key="canonical" rel="canonical" href={area.canonical} />
                {!area.indexable && <meta head-key="robots" name="robots" content="noindex" />}
            </Head>

            <div className="bg-canvas text-stone-900 dark:bg-neutral-950 dark:text-white">
                {area.indexable ? (
                    <MunicipalityWithParking area={area} parent={parent.name} />
                ) : (
                    <MunicipalityWithoutParking area={area} parent={parent.name} />
                )}
            </div>
            <Footer />
        </FrontendLayout>
    );
}

function MunicipalityWithParking({ area, parent }: { area: MunicipalityArea; parent: string }) {
    const { t } = useTranslation('frontend/areas');

    return (
        <>
            <AreaHero breadcrumbs={area.breadcrumbs}>
                <section className="grid gap-4 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-7">
                    <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-5.5">
                        <AreaKicker>{t('kicker.municipality', { parent })}</AreaKicker>
                        <AreaTitle name={area.name} />
                        <p className={cn('max-w-[540px] text-[17px] leading-[1.6] lg:text-lg', muted)}>
                            {t('intro.municipality', { name: area.name })}
                        </p>
                        {area.totals.spaces > 0 ? (
                            <VerificationStatus totals={area.totals} className={cn(card, 'max-w-[540px] px-4.5 py-4 lg:px-5.5 lg:py-5')} />
                        ) : (
                            <p className={cn('wrap-anywhere hyphens-auto', muted)}>{t('municipality.empty_title')}.</p>
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
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:col-start-1 lg:row-start-2">
                            <MapButton href={area.map_url} name={area.name} className="h-13 w-full lg:h-12 lg:w-auto" />
                        </div>
                    )}
                </section>
            </AreaHero>

            <div className="mx-auto flex max-w-7xl flex-col gap-12 px-5 pt-10 pb-14 sm:px-6 lg:gap-18 lg:px-8 lg:pt-18 lg:pb-26">
                <Counts area={area} />

                {totals.spaces > 0 && <CheckInvite area={area} />}

                <div className="flex flex-col gap-12 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-18 lg:gap-y-12">
                    <Rules area={area} className="lg:flex-[999_1_560px]" />
                    <Sources area={area} />
                </div>

                {area.neighbours.length > 0 && <Neighbours area={area} />}
            </div>
        </>
    );
}

/** Invites residents into the guided check of this municipality's street parking spaces. */
function CheckInvite({ area }: { area: MunicipalityArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const unverified = Math.max(0, area.totals.spaces - area.totals.verified);

    return (
        <section
            aria-labelledby="check-invite"
            className="flex flex-col items-start gap-4 rounded-xl bg-canvas-strong px-5 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-8 lg:py-7 dark:bg-neutral-900"
        >
            <div className="flex flex-col gap-1.5">
                <SectionTitle id="check-invite" size="medium">
                    {unverified > 0
                        ? t('check.invite.title', { count: unverified, formatted: format.number(unverified), name: area.name })
                        : t('check.invite.all', { name: area.name })}
                </SectionTitle>
                <p className={cn('text-[17px]', muted)}>{t('check.invite.text')}</p>
            </div>
            <Link href={check(area.check_area)} className={cn(primaryButton, 'w-full shrink-0 lg:w-auto')}>
                {t('check.start', { name: area.name })}
            </Link>
        </section>
    );
}

function Counts({ area }: { area: MunicipalityArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const { totals } = area;
    const items = [
        { key: 'spaces' as const, count: totals.spaces, live: null, garage: false },
        { key: 'garages' as const, count: totals.garages, live: totals.live_garages, garage: true },
        { key: 'park_and_ride' as const, count: totals.park_and_ride, live: totals.live_park_and_ride, garage: true },
    ].filter((item) => item.count > 0);

    return (
        <section aria-labelledby="counts" className="flex flex-col gap-1 lg:gap-7">
            <div className="mb-3 lg:mb-0">
                <SectionTitle id="counts">{t('counts.title', { name: area.name })}</SectionTitle>
            </div>
            <ul className="grid border-t border-stone-200 max-lg:border-b lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] dark:border-neutral-800">
                {items.map((item) => {
                    const href = item.garage ? garages().url : (area.map_url ?? '');
                    const body = (
                        <>
                            <AreaPin garage={item.garage} />
                            <span className="flex flex-1 flex-col lg:flex-none lg:gap-0.5">
                                <span className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] tabular-nums lg:text-5xl lg:leading-[1.05] lg:tracking-[-0.035em]">
                                    {format.number(item.count)}
                                </span>
                                <h3 className="text-base font-semibold lg:text-lg">{t(`counts.${item.key}`)}</h3>
                                {item.live !== null && item.live > 0 && (
                                    <span className={cn('text-sm lg:hidden', muted)}>{t('counts.live', { count: item.live })}</span>
                                )}
                            </span>
                            {item.live !== null && item.live > 0 && (
                                <p className={cn('text-[15px] max-lg:hidden', muted)}>{t('counts.live', { count: item.live })}</p>
                            )}
                        </>
                    );

                    return (
                        <li
                            key={item.key}
                            className="border-stone-200 not-first:border-t lg:flex lg:flex-col lg:gap-3.5 lg:px-8 lg:pt-8 lg:pb-2 lg:not-first:border-t-0 lg:not-first:border-l lg:first:pl-0 lg:last:pr-0 dark:border-neutral-800"
                        >
                            <Link href={href} className="flex items-center gap-3.5 py-4 text-stone-900 lg:hidden dark:text-white">
                                {body}
                                <ChevronRight className="size-5 text-stone-500" aria-hidden />
                            </Link>
                            <div className="contents max-lg:hidden">{body}</div>
                            <Link href={href} className={cn(actionLink, 'max-lg:hidden')}>
                                {t(item.garage ? 'counts.show_occupancy' : 'counts.show_on_map')}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function Rules({ area, className }: { area: MunicipalityArea; className: string }) {
    const { t } = useTranslation('frontend/areas');

    const hasLocalRules = area.rules.some((rule) => rule.scope === 'municipality');
    const hasLinks = area.rules.length > 0 || Boolean(area.gpkwijs_url);

    return (
        <section aria-labelledby="rules" className={cn('flex min-w-0 flex-col gap-4 lg:gap-5', className)}>
            <SectionTitle id="rules" size="medium">
                <span className="block wrap-anywhere hyphens-auto">{t('rules.permit_title')}</span>
            </SectionTitle>
            {!hasLocalRules && <p className={muted}>{t('rules.local_unknown')}</p>}
            {hasLinks && (
                <ul className={cn(card, 'overflow-hidden')}>
                    {area.rules.map((rule) => (
                        <RuleRow
                            key={rule.scope}
                            rule={rule}
                            title={t(rule.scope === 'municipality' ? 'rules.official_local' : 'rules.official_national', { name: rule.name })}
                            scope={t(rule.scope === 'municipality' ? 'rules.municipality_scope' : 'rules.national_scope', { host: rule.host })}
                        />
                    ))}
                    {area.gpkwijs_url && (
                        <RuleRow rule={{ url: area.gpkwijs_url }} title={t('rules.gpkwijs')} scope={t('rules.gpkwijs_scope', { name: area.name })} />
                    )}
                </ul>
            )}
            <RulesDisclaimer />
        </section>
    );
}

function Sources({ area }: { area: MunicipalityArea }) {
    const { t } = useTranslation('frontend/areas');
    const format = useAreaFormat();
    const { sources } = area;
    const rows = [
        ...sources.municipal.map((source) => ({
            key: `municipal:${source.publisher}`,
            term: t('sources.municipal'),
            text: source.updated_at
                ? t('sources.municipal_updated', { publisher: source.publisher, date: format.date(source.updated_at) })
                : t('sources.municipal_from', { publisher: source.publisher }),
        })),
        ...(sources.community ? [{ key: 'community', term: t('sources.community'), text: t('sources.community_text') }] : []),
        ...(sources.facilities
            ? [
                  {
                      key: 'facilities',
                      term: t('sources.facilities'),
                      text: sources.observed_at
                          ? t('sources.facilities_observed', { time: format.relative(sources.observed_at) })
                          : t('sources.facilities_none'),
                  },
              ]
            : []),
    ];

    return (
        <section aria-labelledby="sources" className="flex min-w-0 flex-col gap-3 lg:flex-[1_1_340px] lg:gap-5">
            <SectionTitle id="sources" size="medium">
                {t('sources.title')}
            </SectionTitle>
            <dl className="flex flex-col border-t border-stone-200 dark:border-neutral-800">
                {rows.map((row) => (
                    <div key={row.key} className="flex flex-col gap-0.5 border-b border-stone-200 py-3 lg:py-3.5 dark:border-neutral-800">
                        <dt className="font-semibold">{row.term}</dt>
                        <dd className={cn('text-sm', muted)}>{row.text}</dd>
                    </div>
                ))}
            </dl>
            <div className={cn(card, 'flex flex-col gap-1 px-4.5 py-4 lg:px-5 lg:py-4.5')}>
                <strong>{t('municipality_contact.title')}</strong>
                <span className={cn('text-[15px]', muted)}>
                    {t(sources.municipal.length > 0 ? 'municipality_contact.update' : 'municipality_contact.share')}
                </span>
                <Link href={municipalityContactUrl} className={actionLink}>
                    {t('municipality_contact.action')}
                </Link>
            </div>
        </section>
    );
}

function Neighbours({ area }: { area: MunicipalityArea }) {
    const { t } = useTranslation('frontend/areas');
    const parent = area.region ?? area.country;

    return (
        <section aria-labelledby="nearby" className="flex flex-col gap-3 lg:gap-4.5">
            <SectionTitle id="nearby" size="small">
                {t('municipality.more_in', { name: parent.name })}
            </SectionTitle>
            <ul className="flex flex-wrap items-center gap-2 lg:gap-2.5">
                {area.neighbours.map((neighbour) => (
                    <li key={neighbour.href}>
                        <PillLink href={neighbour.href}>{neighbour.name}</PillLink>
                    </li>
                ))}
                <li className="max-lg:w-full">
                    <Link href={parent.href} className={cn(actionLink, 'text-[15px] lg:px-2')}>
                        {t('municipality.all_in', { name: parent.name })}
                    </Link>
                </li>
            </ul>
        </section>
    );
}

/** A municipality without public parking: reachable, not indexed, and honest about it (#1307). */
function MunicipalityWithoutParking({ area, parent }: { area: MunicipalityArea; parent: string }) {
    const { t } = useTranslation('frontend/areas');
    const parentLink = area.region ?? area.country;

    return (
        <>
            <AreaHero breadcrumbs={area.breadcrumbs}>
                <div className="flex max-w-[720px] flex-col gap-4 lg:gap-5.5">
                    <AreaKicker>{t('kicker.municipality', { parent })}</AreaKicker>
                    <AreaTitle name={area.name} />
                    <div className={cn(card, 'flex items-start gap-3.5 px-4.5 py-4 lg:px-5.5 lg:py-5')}>
                        <MapPinOff className="mt-0.5 size-5.5 shrink-0 text-stone-600 dark:text-stone-400" aria-hidden />
                        <span className="flex min-w-0 flex-col gap-1 wrap-anywhere hyphens-auto">
                            <strong className="text-lg">{t('municipality.empty_title')}</strong>
                            <span className={cn('text-base', muted)}>{t('municipality.empty_text', { name: area.name })}</span>
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <Link href={add().url} className={primaryButton}>
                            {t('municipality.add')}
                        </Link>
                        {area.map_url && (
                            <a href={area.map_url} className={actionLink}>
                                {t('municipality.view_map')}
                            </a>
                        )}
                    </div>
                </div>
            </AreaHero>

            <div className="mx-auto flex max-w-7xl flex-col gap-4.5 px-5 pt-10 pb-14 sm:px-6 lg:px-8 lg:pt-16 lg:pb-26">
                <Rules area={area} className="mb-6 max-w-[720px]" />
                {area.neighbours.length > 0 && (
                    <>
                        <SectionTitle id="nearby" size="small">
                            {t('municipality.nearby', { name: parentLink.name })}
                        </SectionTitle>
                        <ul aria-labelledby="nearby" className="flex flex-wrap items-center gap-2.5">
                            {area.neighbours.map((neighbour) => (
                                <li key={neighbour.href}>
                                    <PillLink href={neighbour.href}>{neighbour.name}</PillLink>
                                </li>
                            ))}
                            <li>
                                <Link href={parentLink.href} className={cn(actionLink, 'px-2 text-[15px]')}>
                                    {t('municipality.all_in', { name: parentLink.name })}
                                </Link>
                            </li>
                        </ul>
                    </>
                )}
                <section
                    aria-labelledby="for-municipality"
                    className={cn(card, 'flex max-w-[720px] flex-col gap-2 px-5 py-5 lg:px-7 lg:py-6', area.neighbours.length > 0 && 'mt-10')}
                >
                    <span className={cn('text-[15px] font-medium', muted)}>{t('municipality_contact.kicker')}</span>
                    <h2 id="for-municipality" className="text-[22px] leading-[1.3] font-bold">
                        {t('municipality_contact.title')}
                    </h2>
                    <p className={muted}>{t('municipality_contact.share_empty', { name: area.name })}</p>
                    <Link href={municipalityContactUrl} className={actionLink}>
                        {t('municipality_contact.action')}
                    </Link>
                </section>
            </div>
        </>
    );
}
