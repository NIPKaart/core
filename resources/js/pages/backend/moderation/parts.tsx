import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useInitials } from '@/hooks/use-initials';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { ChevronDown, Flag as FlagIcon, MapPin, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ReputationKind = 'submission' | 'improvement' | 'report';
type ReputationOutcome = 'submission.approved' | 'improvement.approved' | 'report.confirmed' | 'neutral' | 'incorrect' | 'spam';
type ReputationReason =
    'duplicate' | 'not_a_disabled_bay' | 'wrong_location' | 'insufficient_information' | 'spam' | 'other' | 'incorrect' | 'no_longer_exists';

/** Internal accumulated value and its retained reviewed outcomes. */
export type Reputation = {
    score: number;
    reviewed: number;
    first_recorded_at: string | null;
    recent: { kind: ReputationKind; outcome: ReputationOutcome; reason: ReputationReason | null; decided_at: string }[];
    outcomes: { kind: ReputationKind; outcome: ReputationOutcome; reason: ReputationReason | null; count: number }[];
};
/** What is known about a contributor; context only, never priority. */
export type Contributor = { name: string | null; approved: number; rejected: number; is_new: boolean; reputation?: Reputation | null };

export function Flag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {children}
        </span>
    );
}

/** The contributor's name, with a short note only when their track record stands out. */
export function ContributorName({ contributor }: { contributor: Contributor }) {
    const { t } = useTranslation('backend/moderation');
    const note =
        !contributor.reputation && contributor.rejected > contributor.approved && contributor.rejected > 0
            ? t('contributor.rejected', { count: contributor.rejected })
            : contributor.is_new
              ? t('contributor.new')
              : null;

    return (
        <span>
            {contributor.name ?? t('unknown_user')}
            {contributor.reputation && (
                <span className="ml-1.5 text-xs text-muted-foreground">{t('reputation.score', { score: contributor.reputation.score })}</span>
            )}
            {note && <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">{note}</span>}
        </span>
    );
}

/** Relative time in the interface language, e.g. "3 dagen geleden". */
export function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}

/** Contributor identity, accumulated community points and reviewed evidence. */
export function ReputationContext({ reputation, name }: { reputation?: Reputation | null; name?: string | null }) {
    const { t, i18n } = useTranslation('backend/moderation');
    const ago = useAgo();
    const initials = useInitials();
    const [expanded, setExpanded] = useState(false);
    if (!reputation) return null;

    const contributor = name ?? t('unknown_user');
    const locale = i18n.language.startsWith('nl') ? nl : enUS;
    const totals = reputation.outcomes.reduce(
        (counts, outcome) => {
            const key = outcome.outcome === 'neutral' ? 'neutral' : ['incorrect', 'spam'].includes(outcome.outcome) ? 'incorrect' : 'approved';
            counts[key] += outcome.count;
            return counts;
        },
        { approved: 0, neutral: 0, incorrect: 0 },
    );
    const icons = { submission: MapPin, improvement: Pencil, report: FlagIcon };

    return (
        <section className="border-t pt-5" aria-label={t('reputation.title')}>
            <p className="mb-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">{t('reputation.contributor')}</p>
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                    <Avatar className="size-16 shrink-0">
                        <AvatarFallback className="bg-amber-200 text-xl font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            {initials(contributor)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold break-words">{contributor}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t('reputation.reviewed', { count: reputation.reviewed })}</p>
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
                        {reputation.score.toLocaleString(i18n.language)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('reputation.points')}</p>
                </div>
            </div>
            {reputation.reviewed === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{t('reputation.empty')}</p>
            ) : (
                <>
                    <dl className="my-6 grid grid-cols-3 divide-x">
                        {(['approved', 'neutral', 'incorrect'] as const).map((key) => (
                            <div key={key} className="flex flex-col-reverse gap-1 px-2 text-center">
                                <dt className="text-xs text-muted-foreground">{t(`reputation.totals.${key}`)}</dt>
                                <dd className="text-2xl leading-tight font-semibold tabular-nums">{totals[key]}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="border-t pt-4">
                        <p className="mb-2 text-xs text-muted-foreground">{t('reputation.recent')}</p>
                        <ul className="divide-y">
                            {reputation.recent.slice(0, 2).map((event, index) => {
                                const Icon = icons[event.kind];
                                return (
                                    <li key={index} className="flex items-center gap-3 py-2 text-sm">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                            <Icon className="size-4" aria-hidden />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            {t(`types.${event.kind}`)} · {t(`reputation.outcomes.${event.outcome}`)}
                                        </span>
                                        <time dateTime={event.decided_at} className="shrink-0 text-xs text-muted-foreground">
                                            {format(parseISO(event.decided_at), 'd MMM', { locale })}
                                        </time>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-3">
                        <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                            {t(expanded ? 'reputation.hide_details' : 'reputation.show_details')}
                            <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <ul className="flex flex-col gap-2 text-sm">
                                {reputation.outcomes.map((outcome) => (
                                    <li key={`${outcome.kind}:${outcome.outcome}:${outcome.reason}`}>
                                        {outcome.count} × {t(`types.${outcome.kind}`)} · {t(`reputation.outcomes.${outcome.outcome}`)}
                                        {outcome.reason && <> · {t(`reputation.reasons.${outcome.reason}`)}</>}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-3 text-xs text-muted-foreground">{t('reputation.context')}</p>
                            {reputation.first_recorded_at && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {t('reputation.coverage', { ago: ago(reputation.first_recorded_at) })}
                                </p>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </>
            )}
        </section>
    );
}
