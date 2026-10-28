import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Kbd } from './shortcuts';
import type { EnumOption } from './values';

type DecisionKind = 'submission' | 'improvement' | 'community' | 'municipal';

/**
 * A decision that needs a reason: rejecting a submission or improvement, or removing a reported parking space. It
 * takes the place of the item in the panel, so the map stays in view. The reason is required; one optional note goes
 * with it. A suggested reason, taken from what reporters said, is selected beforehand and marked. After the decision
 * the inbox continues with the next item.
 */
export function DecisionForm({
    kind,
    action,
    reasons,
    suggested,
    onCancel,
}: {
    kind: DecisionKind;
    action: string;
    reasons: EnumOption[];
    suggested?: { value: string; hint: string } | null;
    onCancel: () => void;
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
                onSuccess: onCancel,
            },
        );

    return (
        <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
                event.preventDefault();
                if (reason && !processing) decide();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                // Handled here, so the page does not also leave the item.
                event.preventDefault();
                onCancel();
            }}
        >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">{t(`decide.${kind}.title`)}</h3>
                    <p className="text-[13px] text-muted-foreground">{t(`decide.${kind}.description`)}</p>
                </div>
                <fieldset className="-mx-2 flex flex-col gap-0.5">
                    <legend className="sr-only">{t('decide.reason')}</legend>
                    {reasons.map((option, index) => (
                        <label
                            key={option.value}
                            className={cn(
                                'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-sm hover:bg-muted',
                                reason === option.value && 'bg-muted',
                            )}
                        >
                            <input
                                type="radio"
                                name={`${id}-reason`}
                                value={option.value}
                                checked={reason === option.value}
                                // The form replaces the button that opened it, so focus starts on the chosen reason.
                                autoFocus={reason ? reason === option.value : index === 0}
                                onChange={() => setReason(option.value)}
                                className="size-4 accent-neutral-900 dark:accent-neutral-100"
                            />
                            {option.label}
                            {suggested?.value === option.value && <span className="ml-auto text-xs text-muted-foreground">{suggested.hint}</span>}
                        </label>
                    ))}
                </fieldset>
                <InputError message={errors.reason} />
                <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-note`} className="text-[13px] font-normal text-muted-foreground">
                        {t('decide.note')}
                    </Label>
                    <Textarea
                        id={`${id}-note`}
                        maxLength={1000}
                        value={note}
                        placeholder={t('decide.note_placeholder')}
                        onChange={(event) => setNote(event.target.value)}
                        className="min-h-22 resize-none text-sm"
                    />
                    <InputError message={errors.note} />
                </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t px-5 py-4">
                <Button type="button" variant="outline" size="lg" className="cursor-pointer" onClick={onCancel}>
                    {t('decide.cancel')}
                    <Kbd aria-hidden>Esc</Kbd>
                </Button>
                <Button type="submit" variant="destructive" size="lg" className="flex-1 cursor-pointer" disabled={!reason || processing}>
                    {t(`decide.${kind}.confirm`)}
                    <Kbd inverted aria-hidden>
                        ↵
                    </Kbd>
                </Button>
            </div>
        </form>
    );
}
