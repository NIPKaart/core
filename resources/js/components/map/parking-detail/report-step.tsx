import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { report } from '@/routes/map/places';
import { Form } from '@inertiajs/react';
import { ChevronLeft, Flag, Info } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
    source: 'community' | 'municipal';
    id: string;
    onBack: () => void;
    onReported: () => void;
};

const REASONS = ['sign_removed', 'now_regular_bay', 'other'] as const;
const NOTE_MAX_LENGTH = 500;

/**
 * A step inside the detail sheet for reporting that the place is gone; a moderator decides, the place stays on the map meanwhile.
 */
export default function ReportStep({ source, id, onBack, onReported }: Props) {
    const { t } = useTranslation('frontend/map/modals');
    const noteId = useId();

    return (
        <section aria-labelledby="parking-report-step" className="flex flex-col gap-4 py-1">
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 cursor-pointer rounded-full bg-muted"
                    aria-label={t('detail.report.back')}
                    onClick={onBack}
                >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                </Button>
                <h3 id="parking-report-step" className="text-base font-semibold">
                    {t('detail.report.title')}
                </h3>
            </div>

            <p className="flex gap-2.5 rounded-xl bg-muted/70 p-3 text-sm text-pretty text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t('detail.report.explanation')}
            </p>

            <Form
                method="post"
                action={report({ source, id })}
                options={{ preserveScroll: true }}
                onSuccess={onReported}
                className="flex flex-col gap-4"
            >
                {({ errors, processing }) => (
                    <>
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-sm font-semibold">
                                {t('detail.report.seen')} <span className="font-normal text-muted-foreground">{t('detail.report.optional')}</span>
                            </legend>
                            {REASONS.map((reason) => (
                                <label
                                    key={reason}
                                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm has-checked:border-foreground has-checked:ring-1 has-checked:ring-foreground"
                                >
                                    <input type="radio" name="reason" value={reason} className="accent-foreground" />
                                    {t(`detail.report.reasons.${reason}`)}
                                </label>
                            ))}
                        </fieldset>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={noteId} className="text-sm font-semibold">
                                {t('detail.report.note')} <span className="font-normal text-muted-foreground">{t('detail.report.optional')}</span>
                            </label>
                            <Textarea
                                id={noteId}
                                name="note"
                                rows={2}
                                maxLength={NOTE_MAX_LENGTH}
                                placeholder={t('detail.report.placeholder')}
                                className="resize-none text-sm"
                                aria-invalid={!!errors.note}
                            />
                        </div>

                        {(errors.note || errors.reason || errors.general) && (
                            <p role="alert" className="text-sm text-destructive">
                                {errors.note ?? errors.reason ?? errors.general}
                            </p>
                        )}

                        <Button type="submit" size="lg" className="min-h-12 cursor-pointer" disabled={processing}>
                            <Flag className="h-4 w-4" aria-hidden />
                            {processing ? t('detail.report.sending') : t('detail.report.submit')}
                        </Button>
                    </>
                )}
            </Form>
        </section>
    );
}
