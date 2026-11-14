import { Button } from '@/components/ui/button';
import { show, start } from '@/routes/app/moderation/proposals/validation';
import { useHttp } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Validation =
    | { status: 'idle' | 'queued' | 'running' | 'failed' | 'unavailable' }
    | {
          status: 'completed';
          board: 'supported' | 'not_observed' | 'inconclusive';
          linkedViews: number;
          bayCount: number | null;
          mappedBays: number;
          subsign: 'plate' | 'time' | 'present' | 'conflict' | 'unknown';
          coverage: { analyzed: number; selected: number; partial: boolean };
      };

export default function ProposalValidation({ proposal, point }: { proposal: number; point: number }) {
    const { t } = useTranslation('backend/moderation', { keyPrefix: 'proposals.validation' });
    const [validation, setValidation] = useState<Validation | null>(null);
    const submission = useHttp<Record<string, never>, Validation>({});
    const pending = validation === null || validation.status === 'queued' || validation.status === 'running';
    const state = validation?.status ?? 'loading';

    useEffect(() => {
        if (!pending) return;

        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        let failures = 0;

        async function poll() {
            try {
                const response = await fetch(show.url({ proposal, point }), {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Validation status unavailable');

                const next: Validation = await response.json();
                failures = 0;
                setValidation(next);
                if (next.status === 'queued' || next.status === 'running') timer = setTimeout(poll, 4000);
            } catch {
                if (controller.signal.aborted) return;
                failures += 1;
                if (failures < 3) timer = setTimeout(poll, 4000);
                else setValidation({ status: 'unavailable' });
            }
        }

        void poll();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [pending, point, proposal]);

    return (
        <section aria-label={t('title')} className="flex flex-col gap-2 rounded-xl border p-3">
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <div aria-live="polite" className="text-sm">
                {validation?.status === 'completed' ? (
                    <>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <dt className="text-muted-foreground">{t('board.label')}</dt>
                            <dd>{t(`board.${validation.board}`, { count: validation.linkedViews })}</dd>
                            <dt className="text-muted-foreground">{t('count.label')}</dt>
                            <dd>{validation.bayCount === null ? t('unknown') : t('count.designated', { count: validation.bayCount })}</dd>
                            <dt className="text-muted-foreground">{t('geometry.label')}</dt>
                            <dd>{validation.mappedBays === 0 ? t('unknown') : t('geometry.indicative', { count: validation.mappedBays })}</dd>
                            <dt className="text-muted-foreground">{t('subsign.label')}</dt>
                            <dd>{t(`subsign.${validation.subsign}`)}</dd>
                        </dl>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t('coverage', validation.coverage)} {validation.coverage.partial && t('partial')}
                        </p>
                    </>
                ) : (
                    <p className="text-muted-foreground">{t(`state.${state === 'completed' ? 'loading' : state}`)}</p>
                )}
            </div>
            {!pending && state !== 'completed' && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={submission.processing}
                    onClick={async () => {
                        try {
                            setValidation(await submission.post(start.url({ proposal, point })));
                        } catch {
                            setValidation({ status: 'unavailable' });
                        }
                    }}
                >
                    {t(validation?.status === 'idle' ? 'start' : 'retry')}
                </Button>
            )}
        </section>
    );
}
