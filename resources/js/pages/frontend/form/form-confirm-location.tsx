import { Button } from '@/components/ui/button';
import { confirm } from '@/routes/map/places';
import type { RouteDefinition } from '@/wayfinder';
import { Form, Link } from '@inertiajs/react';
import { Check, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
    source: 'community' | 'municipal';
    id: string;
    signedIn: boolean;
    /** Where a signed-out visitor logs in; it should bring them back to this place. */
    loginHref: RouteDefinition<'get'> | string;
    confirmedToday: boolean;
    onConfirmed?: () => void;
};

/**
 * Compact one-tap confirmation that the parking place exists, shown beside its confirmation count.
 * It deliberately says nothing about the place's details; those are improved separately.
 */
export function ParkingConfirmForm({ source, id, signedIn, loginHref, confirmedToday, onConfirmed }: Props) {
    const { t } = useTranslation('frontend/map/modals');
    // Show the outcome straight away; the refreshed detail confirms it shortly after.
    const [justConfirmed, setJustConfirmed] = useState(false);

    if (confirmedToday || justConfirmed) {
        return (
            <p
                role="status"
                title={t('community.confirm.confirmed_today')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-green-700 shadow-xs dark:bg-zinc-950 dark:text-green-300"
            >
                <CircleCheck className="h-5 w-5" aria-hidden />
                <span className="sr-only">{t('community.confirm.confirmed_today')}</span>
            </p>
        );
    }

    if (!signedIn) {
        return (
            <Button asChild variant="outline" size="sm" className="min-h-10 shrink-0 bg-white shadow-xs dark:bg-zinc-950">
                <Link href={loginHref} aria-label={t('community.confirm.sign_in_label')}>
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
                            className="min-h-10 cursor-pointer border-green-300 bg-white text-green-800 shadow-xs hover:bg-green-50 hover:text-green-900 dark:border-green-800 dark:bg-zinc-950 dark:text-green-200 dark:hover:bg-green-950"
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
