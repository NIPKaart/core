import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kbd } from './shortcuts';
import type { EnumOption } from './values';

type Kind = 'submission' | 'improvement' | 'community' | 'municipal';

/**
 * A decision that needs a reason: rejecting a submission or improvement, or removing a reported parking space.
 * The reason is required; one optional note goes with it. A suggested reason, taken from what reporters said, is
 * selected beforehand and marked. After the decision the inbox continues with the next item.
 */
export function DecisionPopover({
    kind,
    action,
    reasons,
    trigger,
    shortcut,
    variant = 'outline',
    open,
    onOpenChange,
    suggested,
    className,
}: {
    kind: Kind;
    action: string;
    reasons: EnumOption[];
    trigger: string;
    shortcut?: string;
    variant?: 'outline' | 'default';
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suggested?: { value: string; hint: string } | null;
    className?: string;
}) {
    const { t } = useTranslation('backend/moderation');
    const id = useId();
    const [reason, setReason] = useState(suggested?.value ?? '');
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
                onSuccess: () => onOpenChange(false),
            },
        );

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button variant={variant} className={cn('cursor-pointer', className)}>
                    {trigger}
                    {shortcut && (
                        <Kbd inverted={variant === 'default'} aria-hidden>
                            {shortcut}
                        </Kbd>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" collisionPadding={12} className="flex w-[340px] flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-sm font-semibold">{t(`decide.${kind}.title`)}</h2>
                    <p className="text-[13px] text-muted-foreground">{t(`decide.${kind}.description`)}</p>
                </div>
                <fieldset className="-mx-2 flex flex-col">
                    <legend className="sr-only">{t('decide.reason')}</legend>
                    {reasons.map((option) => (
                        <label
                            key={option.value}
                            className={cn(
                                'flex h-[34px] cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-muted',
                                reason === option.value && 'bg-muted',
                            )}
                        >
                            <input
                                type="radio"
                                name={`${id}-reason`}
                                value={option.value}
                                checked={reason === option.value}
                                onChange={() => setReason(option.value)}
                                className="size-4 accent-neutral-900"
                            />
                            {option.label}
                            {suggested?.value === option.value && <span className="ml-auto text-xs text-muted-foreground">{suggested.hint}</span>}
                        </label>
                    ))}
                </fieldset>
                <InputError message={errors.reason} />
                <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-note`} className="sr-only">
                        {t('decide.note')}
                    </Label>
                    <Textarea
                        id={`${id}-note`}
                        maxLength={1000}
                        value={note}
                        placeholder={t('decide.note_placeholder')}
                        onChange={(event) => setNote(event.target.value)}
                        className="min-h-[60px] resize-none text-sm"
                    />
                    <InputError message={errors.note} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                        {t('decide.cancel')}
                    </Button>
                    <Button variant="destructive" size="sm" className="cursor-pointer" disabled={!reason || processing} onClick={decide}>
                        {t(`decide.${kind}.confirm`)}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
