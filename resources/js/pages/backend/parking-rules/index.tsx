import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTablePagination } from '@/components/tables/data-paginate';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthorization } from '@/hooks/use-authorization';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, ExternalLink, MoreVertical, Plus, Search } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { hostOf, RuleSheet, type SheetState } from './rule-sheet';

export type CountrySources = {
    id: number;
    name: string;
    code: string;
    municipalities: number;
    own_sources: number;
    rule: ({ id: number; url: string; updated_at: string } & LinkHealth) | null;
};
/** Whether a source's link still opened at its last check. */
export type LinkHealth = {
    link_status: 'ok' | 'redirected' | 'broken' | null;
    link_http_status: number | null;
    link_error: string | null;
    link_final_url: string | null;
    link_checked_at: string | null;
    link_failing_since: string | null;
};
export type MunicipalityOption = { id: number; name: string; country_id: number; province: string | null };
type MunicipalRule = LinkHealth & {
    id: number;
    url: string;
    updated_at: string;
    country: { id: number; name: string };
    municipality: { id: number; name: string; province: { id: number; name: string } | null };
};

type PageProps = {
    countries: CountrySources[];
    rules: PaginatedResponse<MunicipalRule>;
    filters: { search: string; country: number | null };
    brokenLinks: number;
    availableMunicipalities?: MunicipalityOption[];
};

type Removal = { id: number; name: string; nationwide: boolean } | null;

/**
 * The official pages NIPKaart links to for parking rules: one per country, and optionally one per municipality.
 * Visitors only ever see one link, the municipality's when it has one.
 */
export default function Index({ countries, rules, filters, brokenLinks, availableMunicipalities }: PageProps) {
    const { t, i18n } = useTranslation('backend/parking-rules');
    const { can } = useAuthorization();
    const [sheet, setSheet] = useState<SheetState>(null);
    const [removal, setRemoval] = useState<Removal>(null);
    const [search, setSearch] = useState(filters.search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const date = (value: string) =>
        new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
    const day = (value: string) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(value));
    const country = countries.find((option) => option.id === filters.country) ?? (countries.length === 1 ? countries[0] : undefined);

    const visit = (changes: Partial<{ search: string; country: number | null }>) => {
        const query = Object.fromEntries(Object.entries({ ...filters, ...changes }).filter(([, value]) => value !== null && value !== ''));
        router.get(app.parkingRules.index(), query, { preserveScroll: true, preserveState: true, replace: true, only: ['rules', 'filters'] });
    };

    const onSearch = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => visit({ search: value.trim() }), 300);
    };

    const check = (id: number) => router.post(app.parkingRules.check({ parking_rule: id }), {}, { preserveScroll: true });

    const actions = (id: number, url: string, name: string, nationwide: boolean, health: LinkHealth) =>
        (can('parking-rule.update') || can('parking-rule.delete')) && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={t('actions.for', { name })}>
                        <MoreVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {can('parking-rule.update') && (
                        <>
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => setSheet({ mode: 'edit', id, url, nationwide, name })}>
                                {t('actions.edit')}
                            </DropdownMenuItem>
                            {health.link_status === 'redirected' && health.link_final_url && (
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={() =>
                                        setSheet({ mode: 'edit', id, url, nationwide, name, suggestedUrl: health.link_final_url ?? undefined })
                                    }
                                >
                                    {t('actions.adopt_redirect')}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => check(id)}>
                                {t('actions.check')}
                            </DropdownMenuItem>
                        </>
                    )}
                    {can('parking-rule.delete') && (
                        <DropdownMenuItem className="cursor-pointer text-destructive" onSelect={() => setRemoval({ id, name, nationwide })}>
                            {t('actions.delete')}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('head.title'), href: app.parkingRules.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="flex flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-3xl space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{t('head.title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('head.description')}</p>
                    </div>
                    {can('parking-rule.create') && (
                        <Button onClick={() => setSheet({ mode: 'create', nationwide: false, countryId: country?.id ?? null })}>
                            <Plus />
                            {t('actions.add')}
                        </Button>
                    )}
                </header>

                {brokenLinks > 0 && (
                    <p
                        role="status"
                        className="-mt-2 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                    >
                        <AlertCircle className="size-4 shrink-0" aria-hidden />
                        {t('health.summary', { count: brokenLinks })}
                    </p>
                )}

                <section aria-labelledby="national-title">
                    <SectionHeading id="national-title" title={t('national.title')} description={t('national.description')} />
                    {countries.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">{t('national.empty')}</p>
                    ) : (
                        <ul className="divide-y overflow-hidden rounded-lg border">
                            {countries.map((option) => (
                                <li
                                    key={option.id}
                                    className={
                                        option.rule
                                            ? 'grid items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_14rem_2rem]'
                                            : 'flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/40'
                                    }
                                >
                                    <span>
                                        <span className="block font-medium">{option.name}</span>
                                        <span className="text-[13px] text-muted-foreground">
                                            {t('national.applies_to', { count: Math.max(option.municipalities - option.own_sources, 0) })}
                                        </span>
                                    </span>
                                    {option.rule ? (
                                        <>
                                            <SourceLink url={option.rule.url} />
                                            <HealthStatus health={option.rule} changed={option.rule.updated_at} date={date} day={day} />
                                            {actions(option.rule.id, option.rule.url, option.name, true, option.rule)}
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex flex-1 items-center gap-2 text-amber-900 dark:text-amber-200">
                                                <AlertCircle className="size-4 shrink-0" aria-hidden />
                                                {t('national.missing', { country: option.name })}
                                            </span>
                                            {can('parking-rule.create') && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSheet({ mode: 'create', nationwide: true, countryId: option.id })}
                                                >
                                                    {t('actions.add_short')}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="municipal-title">
                    <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
                        <SectionHeading
                            id="municipal-title"
                            title={t('municipal.title')}
                            description={
                                country
                                    ? t('municipal.coverage', { count: country.own_sources, total: country.municipalities, country: country.name })
                                    : t('municipal.description')
                            }
                            flush
                        />
                        <div className="flex flex-wrap gap-2">
                            <label className="relative w-full sm:w-72">
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden
                                />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) => onSearch(event.target.value)}
                                    placeholder={t('municipal.search')}
                                    aria-label={t('municipal.search')}
                                    className="pl-9"
                                />
                            </label>
                            {countries.length > 1 && (
                                <Select
                                    value={filters.country ? String(filters.country) : 'all'}
                                    onValueChange={(value) => visit({ country: value === 'all' ? null : Number(value) })}
                                >
                                    <SelectTrigger className="w-44" aria-label={t('municipal.country')}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="all">{t('municipal.all_countries')}</SelectItem>
                                        {countries.map((option) => (
                                            <SelectItem key={option.id} value={String(option.id)}>
                                                {option.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {rules.data.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                            {filters.search ? t('municipal.no_results') : t('municipal.empty')}
                        </p>
                    ) : (
                        <ul className="divide-y overflow-hidden rounded-lg border">
                            {rules.data.map((rule) => (
                                <li
                                    key={rule.id}
                                    className="grid items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[13rem_minmax(0,1fr)_14rem_2rem]"
                                >
                                    <span>
                                        <span className="block font-medium">{rule.municipality.name}</span>
                                        <span className="text-[13px] text-muted-foreground">
                                            {[rule.municipality.province?.name, countries.length > 1 && rule.country.name]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                    <SourceLink url={rule.url} />
                                    <HealthStatus health={rule} changed={rule.updated_at} date={date} day={day} />
                                    {actions(rule.id, rule.url, rule.municipality.name, false, rule)}
                                </li>
                            ))}
                        </ul>
                    )}
                    {rules.total > rules.per_page && (
                        <div className="pt-3">
                            <DataTablePagination pagination={rules} />
                        </div>
                    )}
                </section>
            </div>

            <RuleSheet state={sheet} countries={countries} municipalities={availableMunicipalities} onClose={() => setSheet(null)} />
            {removal && (
                <ConfirmDialog
                    title={t('confirm.title')}
                    description={t(removal.nationwide ? 'confirm.country' : 'confirm.municipality', { name: removal.name })}
                    confirmText={t('confirm.confirm')}
                    variant="destructive"
                    onConfirm={() =>
                        router.delete(app.parkingRules.destroy({ parking_rule: removal.id }), {
                            preserveScroll: true,
                            onFinish: () => setRemoval(null),
                        })
                    }
                    onClose={() => setRemoval(null)}
                />
            )}
        </AppLayout>
    );
}

function SectionHeading({ id, title, description, flush = false }: { id: string; title: string; description: ReactNode; flush?: boolean }) {
    return (
        <div className={flush ? undefined : 'pb-3'}>
            <h2 id={id} className="text-sm font-semibold">
                {title}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        </div>
    );
}

/** The site a source lives on, in bold, with the rest of the address beside it. */
function SourceLink({ url }: { url: string }) {
    const host = hostOf(url);
    const rest = host ? url.replace(/^https?:\/\/(www\.)?[^/]+/, '') : url;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 hover:underline hover:underline-offset-4"
        >
            {host && <span className="shrink-0 font-medium">{host}</span>}
            <span className="truncate text-muted-foreground">{rest}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </a>
    );
}

const HEALTH_DOTS = { ok: 'bg-green-600', redirected: 'bg-amber-500', broken: 'bg-red-600' } as const;

/** How the last check of a source's link went, with when the source itself last changed below it. */
function HealthStatus({
    health,
    changed,
    date,
    day,
}: {
    health: LinkHealth;
    changed: string;
    date: (value: string) => string;
    day: (value: string) => string;
}) {
    const { t } = useTranslation('backend/parking-rules');
    const reason = health.link_http_status ? String(health.link_http_status) : health.link_error ? t(`health.errors.${health.link_error}`) : null;

    return (
        <span className="flex min-w-0 flex-col text-[13px]">
            {health.link_status === null ? (
                <span className="text-muted-foreground">{t('health.unchecked')}</span>
            ) : (
                <span
                    className={cn(
                        'inline-flex min-w-0 items-center gap-1.5',
                        health.link_status === 'broken' && 'font-medium text-red-700 dark:text-red-400',
                        health.link_status === 'redirected' && 'text-amber-800 dark:text-amber-300',
                    )}
                    title={health.link_final_url ?? undefined}
                >
                    <span className={cn('size-1.75 shrink-0 rounded-full', HEALTH_DOTS[health.link_status])} aria-hidden />
                    <span className="truncate">
                        {health.link_status === 'ok' && t('health.ok', { date: day(health.link_checked_at!) })}
                        {health.link_status === 'redirected' && t('health.redirected', { host: hostOf(health.link_final_url ?? '') ?? '' })}
                        {health.link_status === 'broken' &&
                            [t('health.broken'), reason, health.link_failing_since && t('health.since', { date: day(health.link_failing_since) })]
                                .filter(Boolean)
                                .join(' · ')}
                    </span>
                </span>
            )}
            <span className="text-muted-foreground">{t('changed', { date: date(changed) })}</span>
        </span>
    );
}
