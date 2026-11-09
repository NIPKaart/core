import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Camera, Check, ChevronLeft, MapPinned, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExistingLine, toLocationProposal, type ProposalOverlap, type ProposalRow } from './location-proposals';

export type WalkAnswer = 'ok' | 'missing';
/** Where the moderator is in the group and what they answered so far; nothing is answered in advance. */
export type Walk = { index: number; answers: Record<number, WalkAnswer>; choices: Record<number, ProposalOverlap> };
export type ConfirmedMatch = { proposal: number; point: number; revision: number; source: ProposalOverlap['source']; parking_id: string };

export const pinKey = (pin: ProposalOverlap) => `parking:${pin.source}:${pin.id}`;

export function candidatePins(target: ReturnType<typeof walkTarget>) {
    if (!target) return [];
    return [target.overlap, ...(target.point.candidates ?? []).filter((pin) => pinKey(pin) !== pinKey(target.overlap))];
}

export function chosenPin(row: ProposalRow, walk: Walk) {
    return walk.choices[row.id] ?? walkTarget(row)?.overlap;
}

export function confirmedMatches(rows: ProposalRow[], walk: Walk): ConfirmedMatch[] {
    return rows.flatMap((row) => {
        const target = walkTarget(row);
        const pin = chosenPin(row, walk);
        return target && pin && walk.answers[row.id] === 'ok'
            ? [{ proposal: row.id, point: target.point.id, revision: row.revision, source: pin.source, parking_id: pin.id }]
            : [];
    });
}

/** The point of a proposal with parking within 3 m, and that parking. */
export function walkTarget(row: ProposalRow): { point: ProposalRow['points'][number]; overlap: ProposalOverlap } | null {
    const point = row.points.find((candidate) => candidate.overlap);

    return point?.overlap ? { point, overlap: point.overlap } : null;
}

/**
 * Going over the signs that already have parking within 3 m, one at a time on the aerial photo: does the map already
 * hold every bay at this sign? Answers are only collected; the summary closes the confirmed ones in one go.
 */
export function DuplicateWalk({
    rows,
    walk,
    reasonLabel,
    closing,
    onAnswer,
    onToggle,
    onToggleAll,
    onChoose,
    onPrevious,
    onJump,
    onRestart,
    onStop,
    onClose,
}: {
    rows: ProposalRow[];
    walk: Walk;
    reasonLabel?: string;
    closing: boolean;
    onAnswer: (row: ProposalRow, answer: WalkAnswer) => void;
    onToggle: (row: ProposalRow, checked: boolean) => void;
    onToggleAll: (checked: boolean) => void;
    onChoose: (row: ProposalRow, pin: ProposalOverlap) => void;
    onPrevious: () => void;
    /** Go to another sign, from the list or the map; all signs of the group stay visible on the map. */
    onJump: (index: number) => void;
    onRestart: () => void;
    onStop: () => void;
    onClose: (matches: ConfirmedMatch[]) => void;
}) {
    const { t } = useTranslation('backend/moderation');
    const current = rows[walk.index] ?? null;
    const target = current ? walkTarget(current) : null;
    const confirmed = confirmedMatches(rows, walk);
    const pin = current ? chosenPin(current, walk) : undefined;
    const choices = candidatePins(target);
    const yesKey = t('proposals.walk_ok_key');
    const noKey = t('proposals.walk_missing_key');

    useEffect(() => {
        if (!current || closing) return;
        const listener = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                target?.closest('input, textarea, select, [role=checkbox], [contenteditable]')
            )
                return;
            const key = event.key.toLowerCase();
            if (key === yesKey) onAnswer(current, 'ok');
            if (key === noKey) onAnswer(current, 'missing');
        };
        window.addEventListener('keydown', listener);

        return () => window.removeEventListener('keydown', listener);
    }, [current, closing, yesKey, noKey, onAnswer]);

    const street = target ? streetViewUrl(target.point.latitude, target.point.longitude) : null;

    return (
        <>
            <nav aria-label={t('proposals.walk_label')} className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b pr-4 pl-2">
                <Button variant="ghost" className="h-9 cursor-pointer gap-1 px-2 text-sm font-medium" disabled={closing} onClick={onStop}>
                    <ChevronLeft className="size-[18px]" aria-hidden />
                    {t('proposals.walk_stop')}
                </Button>
                <span className="truncate text-[13px] text-muted-foreground">{t('proposals.group_on_map')}</span>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {current && target ? (
                    <section aria-labelledby="walk-current" className="flex flex-col gap-2.5 border-b px-4.5 py-4">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] text-muted-foreground">
                                {t('proposals.walk_position', { index: walk.index + 1, total: rows.length })}
                            </span>
                            <h2 id="walk-current" className="text-xl font-bold tracking-tight">
                                {toLocationProposal(current).street}
                            </h2>
                            <label className="mt-2 flex flex-col gap-1 text-sm">
                                {t('proposals.pick_duplicate')}
                                <select
                                    className="w-full rounded-md border bg-background px-2 py-2"
                                    value={pin ? pinKey(pin) : ''}
                                    disabled={closing}
                                    onChange={(event) => {
                                        const chosen = choices.find((candidate) => pinKey(candidate) === event.target.value);
                                        if (chosen) onChoose(current, chosen);
                                    }}
                                >
                                    {choices.map((candidate) => (
                                        <option key={pinKey(candidate)} value={pinKey(candidate)}>
                                            {t('proposals.duplicate_option', {
                                                place: t(`proposals.${candidate.source}`),
                                                street: candidate.street ?? t('proposals.unknown_street'),
                                                distance: candidate.distance_metres,
                                            })}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <p className="text-sm font-medium">{t('proposals.walk_question')}</p>
                        <div className="grid gap-2">
                            {(['ok', 'missing'] as const).map((answer) => (
                                <Button
                                    key={answer}
                                    type="button"
                                    variant="outline"
                                    className="h-12 justify-start px-4 text-[15px] font-semibold max-lg:h-14 max-lg:rounded-xl"
                                    aria-keyshortcuts={answer === 'ok' ? yesKey : noKey}
                                    disabled={closing}
                                    onClick={() => onAnswer(current, answer)}
                                >
                                    {t(`proposals.walk_${answer}`)}
                                    <kbd className="ml-auto rounded border bg-muted px-1.5 text-xs font-semibold text-muted-foreground uppercase pointer-coarse:hidden">
                                        {answer === 'ok' ? yesKey : noKey}
                                    </kbd>
                                </Button>
                            ))}
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                            {/* The first sign has nothing before it, so the way back only appears from the second on. */}
                            {walk.index > 0 && (
                                <Button variant="ghost" size="sm" className="h-9 px-2" onClick={onPrevious}>
                                    <ChevronLeft aria-hidden />
                                    {t('proposals.walk_previous')}
                                </Button>
                            )}
                            {street && (
                                <Button variant="ghost" size="sm" className="ml-auto h-9 px-2" asChild>
                                    <a href={street} target="_blank" rel="noreferrer">
                                        <Camera aria-hidden />
                                        {t('review.views.street_view')}
                                    </a>
                                </Button>
                            )}
                        </div>
                    </section>
                ) : (
                    <section aria-labelledby="walk-done" className="flex flex-col gap-1 border-b px-4.5 py-4">
                        <h2 id="walk-done" className="text-xl font-bold tracking-tight">
                            {t('proposals.walk_done')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t('proposals.walk_summary', { closing: confirmed.length, total: rows.length })}
                        </p>
                    </section>
                )}
                <label className="flex items-center gap-2 border-b px-4.5 py-3 text-sm">
                    <Checkbox
                        checked={confirmed.length === rows.length ? true : confirmed.length > 0 ? 'indeterminate' : false}
                        disabled={closing}
                        onCheckedChange={(checked) => onToggleAll(checked === true)}
                    />
                    {t('proposals.bulk_select_all')}
                </label>
                <p className="px-4.5 pt-2 text-sm text-muted-foreground">{t('proposals.bulk_hint')}</p>
                <div className="flex justify-between px-4.5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">
                    <span>{t('proposals.walk_progress')}</span>
                    <span className="tabular-nums">
                        {t('proposals.walk_answered', { count: Object.keys(walk.answers).length, total: rows.length })}
                    </span>
                </div>
                <ol aria-label={t('proposals.walk_progress')} className="flex flex-col">
                    {rows.map((row, index) => {
                        const answer = walk.answers[row.id];
                        const isCurrent = index === walk.index && !!current;
                        const overlap = chosenPin(row, walk);

                        return (
                            <li key={row.id} className="flex items-center border-t border-muted pl-4.5">
                                <Checkbox
                                    aria-label={t('proposals.bulk_select_row', { sign: toLocationProposal(row).street })}
                                    checked={answer === 'ok'}
                                    disabled={closing}
                                    onCheckedChange={(checked) => onToggle(row, checked === true)}
                                />
                                <button
                                    type="button"
                                    aria-current={isCurrent ? 'step' : undefined}
                                    onClick={() => onJump(index)}
                                    className={cn(
                                        'flex w-full cursor-pointer items-center gap-3 border-l-[3px] border-transparent py-2.5 pr-4 pl-[15px] text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                        isCurrent && 'border-blue-700 bg-blue-50 hover:bg-blue-50 dark:bg-blue-950/50 dark:hover:bg-blue-950/50',
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                                            answer === 'ok' && 'bg-muted text-foreground',
                                            answer === 'missing' && 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
                                            !answer && 'bg-[#1e3a8a]/12 text-[#1e3a8a] dark:text-blue-300',
                                        )}
                                    >
                                        {answer === 'ok' ? (
                                            <Check className="size-[18px]" />
                                        ) : answer === 'missing' ? (
                                            <TriangleAlert className="size-[18px]" />
                                        ) : (
                                            <MapPinned className="size-[18px]" />
                                        )}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                                        <span className="truncate text-[15px] font-medium">{toLocationProposal(row).street}</span>
                                        <span className="truncate text-[13px] text-muted-foreground">
                                            {overlap && (
                                                <>
                                                    {overlap.street ?? t('proposals.unknown_street')}
                                                    <ExistingLine source={overlap.source} distance={overlap.distance_metres} />
                                                </>
                                            )}
                                            {answer === 'missing' && t('proposals.walk_status_missing')}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{index + 1}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 border-t px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-muted-foreground">{t('proposals.reason')}</span>
                    <span className="font-semibold">{reasonLabel}</span>
                </div>
                <div className="flex gap-2">
                    <Button className="h-11 flex-[2]" disabled={confirmed.length === 0 || closing} onClick={() => onClose(confirmed)}>
                        {t('proposals.bulk_confirm', { count: confirmed.length })}
                    </Button>
                    <Button variant="outline" className="h-11 flex-1" disabled={closing} onClick={onRestart}>
                        {t('proposals.walk_again')}
                    </Button>
                </div>
            </div>
        </>
    );
}
