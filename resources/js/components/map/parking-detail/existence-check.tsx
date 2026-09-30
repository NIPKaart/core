import { Button } from '@/components/ui/button';
import { confirm } from '@/routes/map/places';
import type { RouteDefinition } from '@/wayfinder';
import { Form, Link } from '@inertiajs/react';
import { Check, Flag, MapPin, MapPinCheckInside, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortDate } from './utils';

type Props = {
    source: 'community' | 'municipal';
    id: string;
    confirmedCount: number;
    lastConfirmedAt: string | null | undefined;
    confirmedToday: boolean;
    reported: boolean;
    signedIn: boolean;
    /** Where a signed-out visitor logs in; it brings them back to this place. */
    loginHref: RouteDefinition<'get'> | string;
    onConfirmed?: () => void;
    /** Opens the step in which the visitor reports that the place is gone. */
    onReport: () => void;
};

/**
 * The one question the detail asks about a street place: is it still here? "Yes" confirms at once, "No" opens the report step.
 * Signed-out visitors see only the evidence and a quiet hint to log in.
 */
export default function ExistenceCheck({
    source,
    id,
    confirmedCount,
    lastConfirmedAt,
    confirmedToday,
    reported,
    signedIn,
    loginHref,
    onConfirmed,
    onReport,
}: Props) {
    const { t, i18n } = useTranslation('frontend/map/modals');
    // Show the outcome straight away; the refreshed detail confirms it shortly after.
    const [justConfirmed, setJustConfirmed] = useState(false);
    const date = (value: string) => <time dateTime={value}>{formatShortDate(value, i18n.language)}</time>;
    const evidence =
        confirmedCount > 0 ? (
            <>
                {t('detail.existence.count', { count: confirmedCount })}
                {lastConfirmedAt && <> · {date(lastConfirmedAt)}</>}
            </>
        ) : (
            t('detail.existence.none')
        );

    if (signedIn && reported) {
        return (
            <section
                role="status"
                aria-labelledby="parking-existence"
                className="flex items-center gap-3 rounded-xl bg-orange-50 p-3 dark:bg-orange-950/40"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/70 dark:text-orange-300">
                    <Flag className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                    <h3 id="parking-existence" className="text-sm font-semibold text-pretty">
                        {t('detail.existence.reported')}
                    </h3>
                    <p className="text-xs text-pretty text-orange-800 dark:text-orange-200">{t('detail.existence.reported_note')}</p>
                </div>
            </section>
        );
    }

    if (signedIn && (confirmedToday || justConfirmed)) {
        return (
            <section
                role="status"
                aria-labelledby="parking-existence"
                className="flex items-center gap-3 rounded-xl bg-green-50 p-3 dark:bg-green-950/40"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/70 dark:text-green-300">
                    <Check className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                    <h3 id="parking-existence" className="text-sm font-semibold text-pretty">
                        {t('detail.existence.thanks')}
                    </h3>
                    <p className="text-xs font-medium text-pretty text-green-800 dark:text-green-200">
                        {t('detail.existence.today_by_you', { count: Math.max(confirmedCount, 1) })}
                    </p>
                </div>
            </section>
        );
    }

    if (!signedIn) {
        return (
            <section aria-labelledby="parking-existence" className="flex flex-col gap-2 rounded-xl bg-zinc-100/80 p-3 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            confirmedCount > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/70 dark:text-green-300'
                                : 'bg-white text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                    >
                        {confirmedCount > 0 ? <MapPinCheckInside className="h-5 w-5" aria-hidden /> : <MapPin className="h-5 w-5" aria-hidden />}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                        <h3 id="parking-existence" className="text-sm font-semibold">
                            {confirmedCount > 0 ? t('detail.existence.count', { count: confirmedCount }) : t('detail.existence.none')}
                        </h3>
                        {lastConfirmedAt && (
                            <p className="text-xs text-muted-foreground">
                                {t('detail.existence.present_since')} {date(lastConfirmedAt)}
                            </p>
                        )}
                    </div>
                </div>
                <p className="ml-13 text-xs text-pretty text-muted-foreground">
                    <Link href={loginHref} className="font-medium text-foreground underline underline-offset-2">
                        {t('detail.existence.log_in')}
                    </Link>{' '}
                    {t('detail.existence.log_in_hint')}
                </p>
            </section>
        );
    }

    return (
        <section aria-labelledby="parking-existence" className="flex items-center gap-2.5 rounded-xl bg-zinc-100/80 p-3 dark:bg-zinc-900">
            <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <h3 id="parking-existence" className="text-sm font-semibold">
                    {t('detail.existence.question')}
                </h3>
                <p
                    className={`flex items-center gap-1 text-xs font-medium ${confirmedCount > 0 ? 'text-green-800 dark:text-green-300' : 'text-muted-foreground'}`}
                >
                    {confirmedCount > 0 && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    <span>{evidence}</span>
                </p>
            </div>
            <Form
                method="post"
                action={confirm({ source, id })}
                options={{ preserveScroll: true }}
                onSuccess={() => {
                    setJustConfirmed(true);
                    onConfirmed?.();
                }}
            >
                {({ processing }) => (
                    <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        aria-label={t('detail.existence.yes_label')}
                        disabled={processing}
                        className="min-h-10 cursor-pointer rounded-full border-green-300 bg-white px-3.5 text-green-800 hover:bg-green-50 hover:text-green-900 dark:border-green-800 dark:bg-zinc-950 dark:text-green-200 dark:hover:bg-green-950"
                    >
                        <Check className="h-4 w-4" aria-hidden />
                        {t('detail.existence.yes')}
                    </Button>
                )}
            </Form>
            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t('detail.existence.no_label')}
                onClick={onReport}
                className="min-h-10 cursor-pointer rounded-full bg-white px-3.5 dark:bg-zinc-950"
            >
                <X className="h-4 w-4" aria-hidden />
                {t('detail.existence.no')}
            </Button>
        </section>
    );
}
