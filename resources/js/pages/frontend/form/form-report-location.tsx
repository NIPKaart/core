import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { report } from '@/routes/map/places';
import type { RouteDefinition } from '@/wayfinder';
import { Form, Link } from '@inertiajs/react';
import { Flag } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
    source: 'community' | 'municipal';
    id: string;
    signedIn: boolean;
    /** Where a signed-out visitor logs in; it should bring them back to this place. */
    loginHref: RouteDefinition<'get'> | string;
    reported: boolean;
    onReported?: () => void;
};

const NOTE_MAX_LENGTH = 500;

/**
 * Lets a visitor report that the parking place is gone. The report goes to a moderator; the place stays on the map.
 */
export function ParkingReportForm({ source, id, signedIn, loginHref, reported, onReported }: Props) {
    const { t } = useTranslation('frontend/map/modals');
    const noteId = useId();
    const [open, setOpen] = useState(false);
    const [justReported, setJustReported] = useState(false);

    if (reported || justReported) {
        return (
            <p role="status" className="flex items-start gap-2 border-t px-1 pt-3 text-sm text-muted-foreground">
                <Flag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t('community.report.reported')}
            </p>
        );
    }

    if (!open) {
        return (
            <div className="flex items-center justify-between gap-3 border-t px-1 pt-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Flag className="h-4 w-4 shrink-0" aria-hidden />
                    {t('community.report.question')}
                </p>
                {signedIn ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 shrink-0 cursor-pointer underline underline-offset-2"
                        onClick={() => setOpen(true)}
                    >
                        {t('community.report.open')}
                    </Button>
                ) : (
                    <Button asChild variant="ghost" size="sm" className="min-h-9 shrink-0 underline underline-offset-2">
                        <Link href={loginHref}>{t('community.report.sign_in')}</Link>
                    </Button>
                )}
            </div>
        );
    }

    return (
        <Form
            method="post"
            action={report({ source, id })}
            options={{ preserveScroll: true }}
            onSuccess={() => {
                setJustReported(true);
                onReported?.();
            }}
            className="flex flex-col gap-2 border-t px-1 pt-3"
        >
            {({ errors, processing }) => (
                <>
                    <p className="text-sm font-medium">{t('community.report.title')}</p>
                    <p className="text-xs text-muted-foreground">{t('community.report.explanation')}</p>
                    <label htmlFor={noteId} className="text-xs font-medium">
                        {t('community.report.note')} <span className="font-normal text-muted-foreground">{t('community.report.optional')}</span>
                    </label>
                    <Textarea
                        id={noteId}
                        name="note"
                        rows={2}
                        maxLength={NOTE_MAX_LENGTH}
                        placeholder={t('community.report.placeholder')}
                        className="resize-none text-sm"
                        aria-invalid={!!errors.note}
                    />
                    {(errors.note || errors.general) && (
                        <p role="alert" className="text-xs text-destructive">
                            {errors.note ?? errors.general}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => setOpen(false)}>
                            {t('community.report.cancel')}
                        </Button>
                        <Button type="submit" variant="outline" size="sm" className="min-h-9 cursor-pointer" disabled={processing}>
                            <Flag className="h-4 w-4" aria-hidden />
                            {processing ? t('community.report.sending') : t('community.report.submit')}
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
