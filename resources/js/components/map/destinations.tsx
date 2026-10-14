import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { destroy, index, store, update } from '@/routes/profile/destinations';
import type { SharedData } from '@/types';
import type { DestinationResult } from '@/types/destination';
import { useHttp, usePage } from '@inertiajs/react';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Destination = { id: number; label: string; destination: DestinationResult };

function DestinationForm({
    destination,
    saved,
    onSaved,
    onCancel,
}: {
    destination: DestinationResult;
    saved?: Destination;
    onSaved: () => void;
    onCancel?: () => void;
}) {
    const { t } = useTranslation('frontend/map/destinations');
    const id = useId();
    const [failed, setFailed] = useState(false);
    const form = useHttp({ label: saved?.label ?? destination.label });
    return (
        <form
            className="grid gap-2"
            onSubmit={async (event) => {
                event.preventDefault();
                setFailed(false);
                form.transform(({ label }) =>
                    saved
                        ? { label }
                        : {
                              label,
                              key: destination.key,
                              name: destination.label,
                              sub: destination.sub,
                              type: destination.type,
                              latitude: destination.latitude,
                              longitude: destination.longitude,
                              ...(destination.bounds ? { bounds: destination.bounds } : {}),
                          },
                );
                try {
                    if (saved) await form.patch(update.url(saved.id));
                    else await form.post(store.url());
                    onSaved();
                } catch {
                    setFailed(true);
                }
            }}
        >
            <Label htmlFor={id}>{t('label')}</Label>
            <Input
                id={id}
                value={form.data.label}
                maxLength={100}
                required
                aria-invalid={!!form.errors.label}
                aria-describedby={failed ? `${id}-error` : undefined}
                onChange={(event) => form.setData('label', event.target.value)}
            />
            {failed && (
                <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                    {form.errors.label ?? t('error')}
                </p>
            )}
            <div className="flex gap-2">
                <Button type="submit" disabled={form.processing}>
                    {t('save')}
                </Button>
                {onCancel && (
                    <Button type="button" variant="outline" disabled={form.processing} onClick={onCancel}>
                        {t('cancel')}
                    </Button>
                )}
            </div>
        </form>
    );
}

function DestinationRow({ item, onSelect, onChanged }: { item: Destination; onSelect: (value: DestinationResult) => void; onChanged: () => void }) {
    const { t } = useTranslation('frontend/map/destinations');
    const [editing, setEditing] = useState(false);
    const [failed, setFailed] = useState(false);
    const removal = useHttp({});
    return (
        <li className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    className="h-auto min-h-11 min-w-0 flex-1 flex-col items-start text-left whitespace-normal"
                    onClick={() => onSelect(item.destination)}
                >
                    <span className="break-words">{item.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{item.destination.label}</span>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    disabled={removal.processing}
                    aria-label={t('rename', { label: item.label })}
                    onClick={() => setEditing(!editing)}
                >
                    <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    disabled={removal.processing}
                    aria-label={t('remove', { label: item.label })}
                    onClick={async () => {
                        setFailed(false);
                        try {
                            await removal.delete(destroy.url(item.id));
                            onChanged();
                        } catch {
                            setFailed(true);
                        }
                    }}
                >
                    <Trash2 className="size-4" aria-hidden />
                </Button>
            </div>
            {failed && (
                <p role="alert" className="text-sm text-destructive">
                    {t('error')}
                </p>
            )}
            {editing && (
                <DestinationForm
                    destination={item.destination}
                    saved={item}
                    onCancel={() => setEditing(false)}
                    onSaved={() => {
                        setEditing(false);
                        onChanged();
                    }}
                />
            )}
        </li>
    );
}

export default function Destinations({
    open,
    destination,
    onSelect,
}: {
    open: boolean;
    destination: DestinationResult | null;
    onSelect: (value: DestinationResult) => void;
}) {
    const { auth } = usePage<SharedData>().props;
    const { t } = useTranslation('frontend/map/destinations');
    const [items, setItems] = useState<Destination[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [refresh, setRefresh] = useState(0);
    const [adding, setAdding] = useState(false);
    const userId = auth.user?.id;
    useEffect(() => {
        if (!open || !userId) return;
        const request = new AbortController();
        setStatus('loading');
        fetch(index.url(), { headers: { Accept: 'application/json' }, cache: 'no-store', signal: request.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Saved destinations unavailable');
                const data = await response.json();
                if (!request.signal.aborted) {
                    setItems(data.data);
                    setStatus('ready');
                }
            })
            .catch(() => {
                if (!request.signal.aborted) setStatus('error');
            });
        return () => request.abort();
    }, [open, userId, refresh]);
    useEffect(() => {
        if (!open) setAdding(false);
    }, [open]);
    if (!userId) return null;
    const reload = () => setRefresh((value) => value + 1);
    return (
        <div className="grid gap-4">
            {destination &&
                (adding ? (
                    <DestinationForm
                        key={destination.key}
                        destination={destination}
                        onCancel={() => setAdding(false)}
                        onSaved={() => {
                            setAdding(false);
                            reload();
                        }}
                    />
                ) : (
                    <Button variant="outline" onClick={() => setAdding(true)}>
                        {t('save_current')}
                    </Button>
                ))}
            {status === 'loading' && <p role="status">{t('loading')}</p>}
            {status === 'error' && (
                <div role="alert">
                    <p>{t('error')}</p>
                    <Button variant="outline" onClick={reload}>
                        {t('retry')}
                    </Button>
                </div>
            )}
            {status === 'ready' &&
                (items.length ? (
                    <ul className="grid gap-3">
                        {items.map((item) => (
                            <DestinationRow key={item.id} item={item} onChanged={reload} onSelect={onSelect} />
                        ))}
                    </ul>
                ) : (
                    <div className="mt-8 mb-10 flex flex-col items-center justify-center gap-3 px-8 text-center">
                        <MapPin className="size-10 text-primary" aria-hidden />
                        <div className="font-semibold text-muted-foreground">{t('empty.title')}</div>
                        <div className="text-sm text-muted-foreground">{t('empty.description')}</div>
                    </div>
                ))}
        </div>
    );
}
