import { HeaderSlot } from '@/components/header-slot';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import app from '@/routes/app';
import { router } from '@inertiajs/react';
import { AlertCircle, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapLegend, MapTag, ModerationMap } from './moderation-map';
import { useItemPreview, useShortAge } from './queue-list';
import { useShortcuts } from './shortcuts';
import { TypeBadge } from './type-badge';
import type { Options, QueueItem } from './types';

/**
 * Several selected items together. They can be rejected at once, for example as spam; approving always happens one
 * item at a time. The map and the list number the items in the same order.
 */
export function BulkPane({ items, options, onClear }: { items: QueueItem[]; options: Options; onClear: () => void }) {
    const { t } = useTranslation('backend/moderation');
    const age = useShortAge();
    const preview = useItemPreview();
    const [reason, setReason] = useState(options.bulkReasons.find((option) => option.value === 'spam')?.value ?? options.bulkReasons[0]?.value ?? '');
    const [processing, setProcessing] = useState(false);
    const types = [...new Set(items.map((item) => item.type))];
    const municipalities = [...new Set(items.map((item) => item.municipality).filter(Boolean))];
    const center = items[0] ? { latitude: items[0].latitude, longitude: items[0].longitude } : null;

    const reject = () =>
        router.post(
            app.moderation.bulk.reject(),
            { items: items.map((item) => item.key), reason },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: onClear },
        );

    const title =
        types.length === 1
            ? t(`bulk.title.${types[0] as 'submission' | 'improvement'}${municipalities.length === 1 ? '_in' : ''}`, {
                  municipality: municipalities[0],
                  count: items.length,
              })
            : t('bulk.title.mixed', { count: items.length });

    useShortcuts({ Escape: onClear });

    return (
        <section aria-label={t('bulk.label')} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <HeaderSlot side="start">
                <div className="flex min-w-0 items-center gap-3 lg:absolute lg:inset-y-0 lg:left-[359px] lg:border-l lg:pl-5">
                    <span className="text-sm font-semibold">{t('bulk.selected_count', { count: items.length })}</span>
                    <button
                        type="button"
                        onClick={onClear}
                        className="cursor-pointer text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        {t('bulk.clear')}
                    </button>
                </div>
            </HeaderSlot>
            <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-7 py-5">
                <header className="flex flex-col gap-1.5">
                    {types.length === 1 && (
                        <div className="flex gap-1.5">
                            <TypeBadge type={types[0]} />
                        </div>
                    )}
                    <h2 className="mt-1.5 text-2xl leading-8 font-semibold tracking-[-0.6px]">{title}</h2>
                    <p className="text-sm text-muted-foreground">{t('bulk.description')}</p>
                </header>
                {center && (
                    <ModerationMap
                        key={items.map((item) => item.key).join()}
                        center={center}
                        layer="streets"
                        numbered={items.map((item) => ({ latitude: item.latitude, longitude: item.longitude }))}
                        className="h-[236px] shrink-0"
                    >
                        <MapTag>{t('bulk.map', { count: items.length })}</MapTag>
                        <MapLegend items={[{ label: t('bulk.legend'), color: '#1d4ed8' }]} />
                    </ModerationMap>
                )}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="w-9 pb-2 font-medium">
                                <span className="sr-only">#</span>
                            </th>
                            <th className="pb-2 font-medium">{t('bulk.columns.place')}</th>
                            <th className="hidden pb-2 font-medium md:table-cell">{t('bulk.columns.details')}</th>
                            <th className="pb-2 font-medium">{t('bulk.columns.check')}</th>
                            <th className="pb-2 text-right font-medium">{t('bulk.columns.age')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const warning =
                                item.flags.nearby_municipal_metres != null ||
                                item.flags.competing ||
                                item.flags.other_municipality != null ||
                                item.flags.reported;
                            return (
                                <tr key={item.key} className={warning ? 'border-b bg-amber-50/70 dark:bg-amber-950/40' : 'border-b'}>
                                    <td className="py-2.5">
                                        <span className="flex size-5 items-center justify-center rounded-full bg-blue-700 text-[11px] font-semibold text-white">
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="py-2.5 font-medium">{item.street ?? t('no_address')}</td>
                                    <td className="hidden py-2.5 text-muted-foreground md:table-cell">{preview(item)}</td>
                                    <td className="py-2.5">
                                        {warning ? (
                                            <span className="flex items-center gap-1.5 text-[13px] text-orange-700 dark:text-orange-400">
                                                <AlertCircle className="size-3.5" aria-hidden />
                                                {item.flags.nearby_municipal_metres != null
                                                    ? t('flags.nearby_municipal', { distance: item.flags.nearby_municipal_metres })
                                                    : item.flags.competing
                                                      ? t('flags.competing')
                                                      : item.flags.reported
                                                        ? t('flags.reported')
                                                        : t('flags.other_municipality')}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[13px] text-green-700 dark:text-green-400">
                                                <Check className="size-3.5" aria-hidden />
                                                {t('bulk.no_signals')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2.5 text-right text-xs text-muted-foreground">{age(item.waiting_since)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p className="text-[13px] text-muted-foreground">{t('bulk.hint')}</p>
            </div>
            <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t bg-background px-7">
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="w-[220px]" aria-label={t('bulk.reason')}>
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
                <Button variant="destructive" className="cursor-pointer" disabled={processing || !reason} onClick={reject}>
                    {t('bulk.reject', { count: items.length })}
                </Button>
            </footer>
        </section>
    );
}

/** Nothing open yet: where to start. */
export function EmptyPane({ total }: { total: number }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <section className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center lg:flex">
            <p className="text-base font-semibold">{total > 0 ? t('empty.pane_title', { count: total }) : t('empty.pane_done')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{total > 0 ? t('empty.pane_hint') : t('empty.open')}</p>
        </section>
    );
}
