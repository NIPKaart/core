import { Button } from '@/components/ui/button';
import app from '@/routes/app';
import type { PaginatedResponse } from '@/types';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgo } from './parts';
import { PageLink, TypeTile, useShortAge } from './queue-list';
import { TypeBadge } from './type-badge';
import type { HistoryRow, Options } from './types';
import { useValueFormatter } from './values';
import { PanelNav } from './workspace';

/** Applied decisions in green, rejections in grey: the same in the list, its legend and on the map. */
export const DECISION_COLORS = { applied: '#15803d', rejected: '#525252' };

export function decisionColor(row: HistoryRow): string {
    return row.decision === 'rejected' ? DECISION_COLORS.rejected : DECISION_COLORS.applied;
}

/** The calendar day of a decision in the moderator's own time zone, to group the list by. */
function dayOf(value: string): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Decided items in the panel beside the map, most recent first and grouped by day. Pointing at a decision
 * highlights it on the map.
 */
export function DecidedList({
    history,
    header,
    onOpen,
    onHover,
}: {
    history: PaginatedResponse<HistoryRow> | null;
    header: React.ReactNode;
    onOpen: (row: HistoryRow) => void;
    onHover?: (key: string | null) => void;
}) {
    const { t, i18n } = useTranslation('backend/moderation');
    const age = useShortAge();
    const decisionText = useDecisionText();
    const rows = history?.data ?? [];
    const now = new Date();
    const today = dayOf(now.toISOString());
    const yesterday = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString());
    const dayLabel = (row: HistoryRow) => {
        const day = dayOf(row.decided_at);
        if (day === today) return t('history.today');
        if (day === yesterday) return t('history.yesterday');
        return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(row.decided_at));
    };
    const time = (row: HistoryRow) =>
        dayOf(row.decided_at) === today
            ? age(row.decided_at)
            : new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(new Date(row.decided_at));
    const groups = rows.reduce<{ key: string; label: string; rows: HistoryRow[] }[]>((days, row) => {
        const key = dayOf(row.decided_at);
        const last = days.at(-1);
        if (last?.key === key) last.rows.push(row);
        else days.push({ key, label: dayLabel(row), rows: [row] });
        return days;
    }, []);

    return (
        <>
            {header}
            <div
                className="flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-col overflow-y-auto pb-2 hover:scrollbar-thumb-muted-foreground/50"
                onMouseLeave={() => onHover?.(null)}
            >
                {rows.length === 0 && <p className="px-6 py-12 text-center text-base font-semibold">{t('empty.decided')}</p>}
                {groups.map((group) => (
                    <Fragment key={group.key}>
                        <h3 className="px-4.5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">{group.label}</h3>
                        <ul className="flex flex-col">
                            {group.rows.map((row) => (
                                <li key={row.key} className="border-t border-muted" onMouseEnter={() => onHover?.(row.key)}>
                                    <button
                                        type="button"
                                        onClick={() => onOpen(row)}
                                        onFocus={() => onHover?.(row.key)}
                                        className="flex w-full cursor-pointer items-center gap-3 border-l-[3px] border-transparent py-2.5 pr-4 pl-[15px] text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <TypeTile type={row.type} />
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="flex min-w-0 items-baseline gap-1.5">
                                                <span className="truncate text-[15px] font-medium">{row.street || t('no_address')}</span>
                                                {row.municipality && (
                                                    <span className="shrink-0 text-[13px] text-muted-foreground">{row.municipality}</span>
                                                )}
                                            </span>
                                            <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
                                                <span className="sr-only">{t(`types.${row.type}`)}</span>
                                                <span
                                                    className="size-[7px] shrink-0 rounded-full"
                                                    style={{ background: decisionColor(row) }}
                                                    aria-hidden
                                                />
                                                <span className="truncate">
                                                    {row.reason
                                                        ? t('history.with_reason', { decision: decisionText(row), reason: row.reason })
                                                        : decisionText(row)}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground">
                                            <time dateTime={row.decided_at} className="tabular-nums">
                                                {time(row)}
                                            </time>
                                            <span>{row.reviewer ?? t('unknown_user')}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Fragment>
                ))}
                {history && history.last_page > 1 && (
                    <div className="mt-2 flex items-center justify-between px-4.5 text-xs text-muted-foreground">
                        <span>{t('queue.page', { from: history.from, to: history.to, total: history.total })}</span>
                        <span className="flex gap-1">
                            <PageLink href={history.prev_page_url} label={t('queue.previous_page')} icon={ChevronLeft} />
                            <PageLink href={history.next_page_url} label={t('queue.next_page')} icon={ChevronRight} />
                        </span>
                    </div>
                )}
            </div>
        </>
    );
}

/** What was decided, in words: for a location proposal how many bays were added. */
function useDecisionText() {
    const { t } = useTranslation('backend/moderation');

    return (row: HistoryRow): string => {
        const proposal = row.proposal;
        if (proposal && row.decision === 'completed') {
            return proposal.reported_bays !== null && proposal.total_bays < proposal.reported_bays
                ? t('history.proposal_partial', { count: proposal.total_bays, reported: proposal.reported_bays })
                : t('history.proposal_added', { count: proposal.total_bays });
        }

        return row.decision === 'approved' && row.corrected ? t('decisions.approved_corrected') : t(`decisions.${row.decision}`);
    };
}

export function DecisionLabel({ row }: { row: HistoryRow }) {
    const decisionText = useDecisionText();

    return (
        <span className="flex items-baseline gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: decisionColor(row) }} aria-hidden />
            <span>
                <span className="block font-semibold">{decisionText(row)}</span>
                {row.reason && <span className="block text-muted-foreground">{row.reason}</span>}
            </span>
        </span>
    );
}

/** A decided item in the panel: the decision, its reason and note, and for an improvement what was submitted and applied. */
export function DecisionPane({ row, options, onBack }: { row: HistoryRow; options: Options; onBack: () => void }) {
    const { t, i18n } = useTranslation('backend/moderation');
    const format = useValueFormatter(options);
    const [reopening, setReopening] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    useEffect(() => setFailure(null), [row.key]);
    const ago = useAgo();

    return (
        <>
            <PanelNav back={t('tabs.decided')} onBack={onBack} />
            <header className="flex shrink-0 flex-col gap-1.5 px-5 py-3">
                <div className="flex">
                    <TypeBadge type={row.type} />
                </div>
                <h2 className="text-xl leading-6 font-bold tracking-[-0.02em]">{row.street || t('no_address')}</h2>
                <p className="text-sm text-muted-foreground">
                    {[
                        row.municipality,
                        row.proposal?.source
                            ? row.proposal.reported_bays === null
                                ? t('history.proposal_source', { source: row.proposal.source })
                                : t('history.proposal_source_reported', { source: row.proposal.source, count: row.proposal.reported_bays })
                            : (row.contributor ?? (row.reports ? t('history.reports', { count: row.reports }) : null)),
                    ]
                        .filter(Boolean)
                        .map((part, index) => (
                            <span key={index} className="block">
                                {part}
                            </span>
                        ))}
                </p>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto border-t px-5 py-4 text-sm">
                <DecisionLabel row={row} />
                {row.note && <p className="rounded-md bg-muted px-3 py-2">“{row.note}”</p>}
                {row.proposal && (
                    <>
                        {row.proposal.bays.length > 0 && (
                            <section className="space-y-2">
                                <h3 className="text-xs text-muted-foreground">{t('history.proposal_bays')}</h3>
                                <ul className="divide-y rounded-lg border">
                                    {row.proposal.bays.map((bay) => (
                                        <li key={bay.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                            <span>{t('proposals.bay', { number: bay.number })}</span>
                                            {bay.url && (
                                                <a className="underline" href={bay.url}>
                                                    {t('review.on_map')}
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {row.proposal.existing_url && (
                            <a className="underline" href={row.proposal.existing_url}>
                                {t('history.proposal_duplicate')}
                            </a>
                        )}
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                            {row.proposal.orientation && (
                                <>
                                    <dt className="text-muted-foreground">{t('proposals.summary.orientation')}</dt>
                                    <dd>{row.proposal.orientation}</dd>
                                </>
                            )}
                            {row.proposal.under_sign && (
                                <>
                                    <dt className="text-muted-foreground">{t('proposals.summary.under_sign')}</dt>
                                    <dd>
                                        {row.proposal.restriction || row.proposal.under_sign}
                                        {row.proposal.parking_time !== null && (
                                            <span className="block">{t('history.proposal_minutes', { count: row.proposal.parking_time })}</span>
                                        )}
                                        {row.proposal.restriction_starts_at && row.proposal.restriction_ends_at && (
                                            <span className="block">
                                                {row.proposal.restriction_days?.join(', ')} {row.proposal.restriction_starts_at.slice(0, 5)}–
                                                {row.proposal.restriction_ends_at.slice(0, 5)}
                                            </span>
                                        )}
                                    </dd>
                                </>
                            )}
                            {row.proposal.last_seen_on && (
                                <>
                                    <dt className="text-muted-foreground">{t('map.source_point')}</dt>
                                    <dd>
                                        {t('proposals.seen', {
                                            date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(
                                                new Date(row.proposal.last_seen_on),
                                            ),
                                        })}
                                    </dd>
                                </>
                            )}
                        </dl>
                    </>
                )}
                {row.type === 'improvement' && row.changes && (
                    <dl className="flex flex-col gap-4">
                        {row.changes.map((group) => {
                            const submitted = format(group, { ...row.previous, ...row.submitted });
                            const applied = row.decision === 'approved' ? format(group, { ...row.previous, ...row.applied }) : null;
                            return (
                                <div key={group} className="flex flex-col gap-1">
                                    <dt className="text-xs text-muted-foreground">{t(`groups.${group}`)}</dt>
                                    {row.decision === 'approved' && (
                                        <dd className="text-muted-foreground line-through decoration-muted-foreground/40">
                                            {format(group, row.previous ?? {})}
                                        </dd>
                                    )}
                                    <dd className="font-medium">{applied ?? submitted}</dd>
                                    {applied !== null && applied !== submitted && (
                                        <dd className="text-xs text-orange-700 dark:text-orange-400">
                                            {t('history.submitted_was', { value: submitted })}
                                        </dd>
                                    )}
                                </div>
                            );
                        })}
                    </dl>
                )}
                {row.latitude === null && <p className="text-muted-foreground">{t('history.not_on_map')}</p>}
                <p className="text-xs text-muted-foreground">
                    {t('history.decided', { reviewer: row.reviewer ?? t('unknown_user'), ago: ago(row.decided_at) })}
                </p>
                {row.proposal?.reopen_revision != null && (
                    <Button
                        variant="outline"
                        className="self-start"
                        disabled={reopening}
                        onClick={() => {
                            if (!row.proposal) return;
                            setReopening(true);
                            setFailure(null);
                            router.post(
                                app.moderation.proposals.reopen.url(row.proposal.id),
                                { revision: row.proposal.reopen_revision },
                                {
                                    onError: (errors) => setFailure(Object.values(errors)[0] ?? null),
                                    onFinish: () => setReopening(false),
                                },
                            );
                        }}
                    >
                        {t('history.proposal_reopen')}
                    </Button>
                )}
                {failure && (
                    <p role="alert" className="text-destructive">
                        {failure}
                    </p>
                )}
            </div>
        </>
    );
}
