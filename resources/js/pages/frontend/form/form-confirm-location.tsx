import { Button } from '@/components/ui/button';
import { login } from '@/routes';
import { confirm } from '@/routes/map/places';
import { Form, Link } from '@inertiajs/react';
import { Check, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
    source: 'community' | 'municipal';
    id: string;
    signedIn: boolean;
    confirmedToday: boolean;
    onConfirmed?: () => void;
};

/**
 * Compact one-tap confirmation that the parking place exists, shown beside its confirmation count.
 * It deliberately says nothing about the place's details; those are improved separately.
 */
export function ParkingConfirmForm({ source, id, signedIn, confirmedToday, onConfirmed }: Props) {
    const { t } = useTranslation('frontend/map/modals');
    // Show the outcome straight away; the refreshed detail confirms it shortly after.
    const [justConfirmed, setJustConfirmed] = useState(false);

    if (confirmedToday || justConfirmed) {
        return (
            <p
                role="status"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 dark:bg-green-950/70 dark:text-green-200"
            >
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                {t('community.confirm.confirmed_today')}
            </p>
        );
    }

    if (!signedIn) {
        return (
            <Button asChild variant="outline" size="sm" className="min-h-9 shrink-0">
                <Link href={login()} aria-label={t('community.confirm.sign_in_label')}>
                    <Check className="h-4 w-4" aria-hidden />
                    {t('community.confirm.button')}
                </Link>
            </Button>
        );
    }

    return (
        <Form
            method="post"
            action={confirm({ source, id })}
            options={{ preserveScroll: true }}
            onSuccess={() => {
                setJustConfirmed(true);
                onConfirmed?.();
            }}
            className="flex shrink-0 flex-col items-end gap-1"
        >
            {({ errors, processing }) => {
                const error = Object.values(errors ?? {})[0];

                return (
                    <>
                        <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="min-h-9 cursor-pointer border-green-300 text-green-800 hover:bg-green-50 hover:text-green-900 dark:border-green-800 dark:text-green-200 dark:hover:bg-green-950"
                            aria-label={t('community.confirm.label')}
                            disabled={processing}
                        >
                            <Check className="h-4 w-4" aria-hidden />
                            {processing ? t('community.confirm.confirming') : t('community.confirm.button')}
                        </Button>
                        {error && (
                            <p role="alert" className="max-w-48 text-right text-xs text-destructive">
                                {String(error)}
                            </p>
                        )}
                    </>
                );
            }}
        </Form>
    );
}
