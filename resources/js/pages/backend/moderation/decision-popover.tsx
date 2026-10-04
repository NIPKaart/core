import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnumOption } from './values';

type Kind = 'submission' | 'improvement' | 'community' | 'municipal';

/**
 * A decision that needs a reason: rejecting a submission or improvement, or removing a reported parking space.
 * The reason is required; one optional note goes with it.
 */
export function DecisionPopover({
    kind,
    action,
    reasons,
    trigger,
    variant = 'outline',
}: {
    kind: Kind;
    action: string;
    reasons: EnumOption[];
    trigger: string;
    variant?: 'outline' | 'destructive';
}) {
    const { t } = useTranslation('backend/moderation');
    const id = useId();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const decide = () =>
        router.post(
            action,
            { reason, note },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: setErrors,
                onSuccess: () => setOpen(false),
            },
        );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant={variant} className="cursor-pointer">
                    {trigger}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" collisionPadding={12} className="flex w-80 flex-col gap-3">
                <div>
                    <h2 className="text-sm font-semibold">{t(`decide.${kind}.title`)}</h2>
                    <p className="text-xs text-muted-foreground">{t(`decide.${kind}.description`)}</p>
                </div>
                <fieldset className="flex flex-col gap-0.5">
                    <legend className="sr-only">{t('decide.reason')}</legend>
                    {reasons.map((option) => (
                        <label
                            key={option.value}
                            className={cn(
                                'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-muted',
                                reason === option.value && 'bg-muted font-medium',
                            )}
                        >
                            <input
                                type="radio"
                                name={`${id}-reason`}
                                value={option.value}
                                checked={reason === option.value}
                                onChange={() => setReason(option.value)}
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
                <InputError message={errors.reason} />
                <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-note`} className="text-xs text-muted-foreground">
                        {t('decide.note')}
                    </Label>
                    <Input id={`${id}-note`} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
                    <InputError message={errors.note} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="cursor-pointer" onClick={() => setOpen(false)}>
                        {t('decide.cancel')}
                    </Button>
                    <Button variant="destructive" className="cursor-pointer" disabled={!reason || processing} onClick={decide}>
                        {t(`decide.${kind}.confirm`)}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
