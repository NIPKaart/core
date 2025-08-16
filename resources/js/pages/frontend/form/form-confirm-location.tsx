import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form } from '@inertiajs/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
    spaceId: string;
    confirmationStatusOptions: Record<string, string>;
    confirmedToday: boolean;
    onConfirmed?: () => void;
};

export function ParkingConfirmForm({ spaceId, confirmationStatusOptions, confirmedToday, onConfirmed }: Props) {
    const { t } = useTranslation('frontend/map/modals');

    const [status, setStatus] = React.useState<string>('confirmed');
    const [comment, setComment] = React.useState<string>('');

    React.useEffect(() => {
        setStatus('confirmed');
        setComment('');
    }, [spaceId]);

    return (
        <Form
            method="post"
            action={route('app.parking-spaces.confirm', spaceId)}
            options={{ preserveScroll: true }}
            onSuccess={() => {
                setStatus('confirmed');
                setComment('');
                onConfirmed?.();
            }}
            className="mx-auto max-w-md space-y-5"
        >
            {({ errors, processing }) => {
                const otherErrors = Object.entries(errors ?? {}).filter(([key]) => key !== 'status' && key !== 'comment');
                const generalError = otherErrors.length ? String(otherErrors[0][1] ?? '') : null;

                return (
                    <>
                        <h2 className="mb-2 text-center text-lg font-semibold">{t('community.confirm.form.title')}</h2>
                        <div className="mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                            {t('community.confirm.form.description')}
                            <br />
                            <span className="text-sm text-zinc-400">{t('community.confirm.form.description_note')}</span>
                        </div>

                        {generalError && (
                            <div className="mb-2 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20">
                                {generalError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('community.confirm.form.field.status')}</label>
                                <Select value={status} onValueChange={setStatus} disabled={confirmedToday || processing}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(confirmationStatusOptions).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <input type="hidden" name="status" value={status} />
                                <InputError message={errors.status} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t('community.confirm.form.field.comment.label')}{' '}
                                    <span className="ml-1 text-xs text-muted-foreground">{t('community.confirm.form.field.comment.optional')}</span>
                                </label>
                                <Textarea
                                    name="comment"
                                    rows={2}
                                    className="resize-none text-xs"
                                    placeholder={t('community.confirm.form.field.comment.placeholder')}
                                    maxLength={500}
                                    disabled={confirmedToday || processing}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                                <InputError message={errors.comment} />
                            </div>
                        </div>

                        <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={confirmedToday || processing}>
                            {confirmedToday
                                ? t('community.confirm.buttons.alreadyConfirmed')
                                : processing
                                  ? t('community.confirm.buttons.confirming')
                                  : t('community.confirm.buttons.confirm')}
                        </Button>
                    </>
                );
            }}
        </Form>
    );
}
