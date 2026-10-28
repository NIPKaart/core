import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import app from '@/routes/app';
import { router } from '@inertiajs/react';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kbd, useShortcuts } from './shortcuts';
import type { Options, QueueItem } from './types';

/** Whether an item in a selection deserves a second look before it is rejected with the rest. */
function signal(item: QueueItem, t: (key: string, values?: Record<string, unknown>) => string): string | null {
    if (item.flags.nearby_municipal_metres != null) return t('flags.nearby_municipal', { distance: item.flags.nearby_municipal_metres });
    if (item.flags.competing) return t('flags.competing');
    if (item.flags.reported) return t('flags.reported');
    if (item.flags.other_municipality != null) return t('flags.other_municipality');
    return null;
}

/**
 * The top of the panel while items are selected: how many, what they are, and how to stop selecting. Selected
 * items can be rejected together, for example as spam; approving always happens one item at a time.
 */
export function SelectionHeader({ items, onClear }: { items: QueueItem[]; onClear: () => void }) {
    const { t } = useTranslation('backend/moderation');
    const types = [...new Set(items.map((item) => item.type))];
    const municipalities = [...new Set(items.map((item) => item.municipality).filter(Boolean))];
    useShortcuts({ Escape: onClear });

    const title =
        types.length === 1
            ? t(`bulk.title.${types[0] as 'submission' | 'improvement'}${municipalities.length === 1 ? '_in' : ''}`, {
                  municipality: municipalities[0],
                  count: items.length,
              })
            : t('bulk.title.mixed', { count: items.length });

    return (
        <div className="flex shrink-0 flex-col gap-2 px-4.5 pt-4.5 pb-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-[-0.02em]">{t('bulk.selected_count', { count: items.length })}</h2>
                <Button variant="ghost" size="sm" className="cursor-pointer text-muted-foreground" onClick={onClear}>
                    {t('bulk.clear')}
                    <Kbd aria-hidden>Esc</Kbd>
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                {title}. {t('bulk.description')}
            </p>
        </div>
    );
}

/** The bottom of the panel while items are selected: what still deserves a look, the reason, and the decision. */
export function SelectionBar({ items, options, onClear }: { items: QueueItem[]; options: Options; onClear: () => void }) {
    const { t } = useTranslation('backend/moderation');
    const [reason, setReason] = useState(options.bulkReasons.find((option) => option.value === 'spam')?.value ?? options.bulkReasons[0]?.value ?? '');
    const [processing, setProcessing] = useState(false);
    const flagged = items.map((item) => ({ item, signal: signal(item, t) })).filter((entry) => entry.signal !== null);

    const reject = () =>
        router.post(
            app.moderation.bulk.reject(),
            { items: items.map((item) => item.key), reason },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: onClear },
        );

    return (
        <div className="flex shrink-0 flex-col gap-3 border-t px-4.5 pt-3.5 pb-4.5">
            {flagged.length > 0 && (
                <ul className="flex flex-col gap-1.5 rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                    {flagged.map(({ item, signal: text }) => (
                        <li key={item.key} className="flex gap-2">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <span>
                                <span className="font-medium">{item.street ?? t('no_address')}</span> · {text}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex items-center gap-3">
                <span className="text-[13px] text-muted-foreground">{t('bulk.reason')}</span>
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="h-10 flex-1" aria-label={t('bulk.reason')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.bulkReasons.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button variant="destructive" size="lg" className="w-full cursor-pointer" disabled={processing || !reason} onClick={reject}>
                {t('bulk.reject', { count: items.length })}
            </Button>
            <p className="text-xs text-muted-foreground">{t('bulk.hint')}</p>
        </div>
    );
}
