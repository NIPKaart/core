import CardLocationMarker from '@/components/map/card-location-marker';
import { streetViewUrl } from '@/components/map/parking-detail/navigation-handoff';
import ReportStep from '@/components/map/parking-detail/report-step';
import { formatShortDate } from '@/components/map/parking-detail/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import FrontendLayout from '@/layouts/frontend-layout';
import { cn } from '@/lib/utils';
import { login, register } from '@/routes';
import { municipality } from '@/routes/areas';
import { check } from '@/routes/areas/municipality';
import { confirm } from '@/routes/map/places';
import { Form, Head, Link, router } from '@inertiajs/react';
import { ArrowRight, Check, ChevronLeft, CircleCheck, Eye, Flag, Info, RefreshCw, TriangleAlert, UserRound, X } from 'lucide-react';
import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Cursor = { source: 'community' | 'municipal'; id: string };
type Place = Cursor & {
    street: string | null;
    latitude: number;
    longitude: number;
    orientation: string | null;
    under_sign: string | null;
    last_confirmed_at: string | null;
};
type Props = {
    area: { country: string; municipality: string };
    name: string;
    cursor: Cursor | null;
    state: 'sign_in' | 'ready' | 'confirmed' | 'reported' | 'withdrawn' | 'empty';
    skipped: boolean;
    canContribute: boolean;
    place: Place | null;
};

const floating = 'lg:rounded-2xl lg:bg-white lg:shadow-[0_8px_28px_rgba(28,25,23,0.16)] lg:dark:bg-neutral-900';

/**
 * One parking space at a time, in the map and detail layout: the resident signs in first, then confirms, reports or skips.
 */
export default function ParkingCheck(props: Props) {
    const { t } = useTranslation('frontend/areas');
    const { area, name, place } = props;
    const title = t('check.title', { name });

    return (
        <FrontendLayout>
            <Head title={title}>
                <meta head-key="robots" name="robots" content="noindex" />
            </Head>
            <div className="relative flex flex-col bg-canvas text-stone-900 lg:h-[calc(100dvh-5rem)] lg:min-h-[640px] dark:bg-neutral-950 dark:text-white">
                <section
                    aria-labelledby="check-title"
                    className={cn(
                        'order-1 flex flex-col gap-1.5 px-5 pt-5 pb-4 lg:absolute lg:top-4 lg:left-4 lg:z-10 lg:w-[340px] lg:px-4.5 lg:pt-3.5 lg:pb-4',
                        floating,
                    )}
                >
                    <Link
                        href={municipality(area)}
                        aria-label={t('check.back', { name })}
                        className="-ml-1 flex min-h-8 w-fit items-center gap-1 text-sm font-semibold text-stone-600 dark:text-neutral-300"
                    >
                        <ChevronLeft className="size-4" aria-hidden />
                        {name}
                    </Link>
                    <h1 id="check-title" className="text-xl leading-tight font-bold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-sm text-stone-600 dark:text-neutral-300">{t('check.intro')}</p>
                </section>

                <CheckPanel key={JSON.stringify(props.cursor)} {...props} />

                <div className="order-2 h-[42vh] min-h-64 lg:absolute lg:inset-0 lg:h-auto">
                    {place ? (
                        <CardLocationMarker
                            key={`${place.source}-${place.id}`}
                            latitude={place.latitude}
                            longitude={place.longitude}
                            scrollWheelZoom={false}
                            wrapperClassName="h-full"
                            className="h-full rounded-none border-0"
                        />
                    ) : (
                        <div aria-hidden className="h-full bg-stone-200 dark:bg-neutral-800" />
                    )}
                </div>
            </div>
        </FrontendLayout>
    );
}

function CheckPanel({ area, name, cursor, state, skipped, canContribute, place }: Props) {
    const { t, i18n } = useTranslation('frontend/areas');
    const [reporting, setReporting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failedVisit, setFailedVisit] = useState<string | null>(null);
    const focusTarget = useRef<HTMLElement>(null);
    const ineligible = state === 'ready' && !canContribute;
    const reportOpen = state === 'ready' && canContribute && reporting;
    const step = failedVisit ? 'error' : loading ? 'loading' : reportOpen ? 'report' : ineligible ? 'ineligible' : state;

    useEffect(() => {
        if (step === 'report') {
            document.getElementById('parking-report-step')?.focus();
        } else {
            focusTarget.current?.focus();
        }
    }, [step]);

    const announcement = {
        sign_in: t('check.sign_in.title'),
        ineligible: t('check.ineligible.title'),
        ready: skipped ? `${t('check.skipped')} ${place?.street ?? ''}` : (place?.street ?? ''),
        report: '',
        confirmed: t('check.confirmed'),
        reported: t('check.reported.title'),
        withdrawn: t('check.withdrawn'),
        empty: t('check.empty.title'),
        loading: t('check.loading'),
        error: t('check.error.title'),
    }[step];

    const visit = (url: string) => {
        router.visit(url, {
            onStart: () => {
                setFailedVisit(null);
                setLoading(true);
            },
            onFinish: () => setLoading(false),
            onNetworkError: () => {
                setFailedVisit(url);
                return false;
            },
        });
    };
    const next = (skip = false) => cursor && visit(check.url(area, { query: { ...cursor, next: 1, ...(skip ? { skipped: 1 } : {}) } }));
    const returnPath = check.url(area, { query: cursor ?? {} });
    const backHref = municipality(area);
    const streetView = place ? streetViewUrl(place.latitude, place.longitude) : null;

    return (
        <section
            aria-labelledby="check-step"
            aria-busy={step === 'loading'}
            className={cn(
                'relative z-10 order-3 -mt-4 flex flex-col rounded-t-2xl bg-white shadow-[0_-6px_22px_rgba(28,25,23,0.16)] lg:absolute lg:top-4 lg:right-4 lg:bottom-4 lg:mt-0 lg:w-[416px] lg:overflow-hidden dark:bg-neutral-900',
                floating,
            )}
        >
            <p role="status" className="sr-only">
                {announcement}
            </p>

            {step === 'loading' && (
                <div className="flex flex-col gap-3 px-5 py-6">
                    <h2 id="check-step" className="sr-only">
                        {t('check.loading')}
                    </h2>
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-7 w-60" />
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="mt-3 h-52 rounded-xl" />
                    <p className="text-sm text-stone-600 dark:text-neutral-300">{t('check.loading')}</p>
                </div>
            )}

            {step === 'error' && failedVisit && (
                <Message icon={<TriangleAlert className="size-5" />} tone="error" title={t('check.error.title')} text={t('check.error.text')}>
                    <Button ref={focusRef(focusTarget)} size="lg" className="min-h-12 self-start" onClick={() => visit(failedVisit)}>
                        <RefreshCw className="size-4" aria-hidden />
                        {t('check.error.retry')}
                    </Button>
                    <BackLink href={backHref} label={t('check.back', { name })} />
                </Message>
            )}

            {step === 'sign_in' && (
                <Message icon={<UserRound className="size-5" />} title={t('check.sign_in.title')} text={t('check.sign_in.text')}>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild size="lg" className="min-h-12 flex-[1_1_150px]">
                            <Link ref={focusRef(focusTarget)} href={login({ query: { return: returnPath } })}>
                                {t('check.sign_in.login')}
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="min-h-12 flex-[1_1_150px]">
                            <Link href={register()}>{t('check.sign_in.register')}</Link>
                        </Button>
                    </div>
                    <BackLink href={backHref} label={t('check.back', { name })} />
                </Message>
            )}

            {step === 'empty' && (
                <Message icon={<CircleCheck className="size-5" />} title={t('check.empty.title')} text={t('check.empty.text')} focus={focusTarget}>
                    <Button asChild size="lg" className="min-h-12 self-start">
                        <Link href={backHref}>{t('check.back', { name })}</Link>
                    </Button>
                </Message>
            )}

            {step === 'withdrawn' && (
                <Message icon={<Info className="size-5" />} title={t('check.withdrawn')} focus={focusTarget}>
                    <NextButton onClick={() => next()} label={t('check.next')} />
                </Message>
            )}

            {place && ['ready', 'ineligible', 'report', 'confirmed', 'reported'].includes(step) && (
                <>
                    <div className="flex items-start gap-3 px-5 pt-4 pb-3.5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span
                                className={cn(
                                    'text-[13px] font-semibold',
                                    place.source === 'community' ? 'text-blue-700 dark:text-blue-300' : 'text-stone-600 dark:text-neutral-300',
                                )}
                            >
                                {t(`check.kind.${place.source}`)}
                            </span>
                            <h2
                                id="check-step"
                                ref={step === 'ready' || step === 'ineligible' ? focusRef(focusTarget) : undefined}
                                tabIndex={-1}
                                className="text-2xl leading-tight font-bold tracking-tight wrap-break-word"
                            >
                                {place.street?.trim() || t('check.no_street')}
                            </h2>
                            <span className="text-sm text-stone-600 dark:text-neutral-300">{name}</span>
                        </div>
                        <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
                            <Link href={backHref} aria-label={t('check.stop')}>
                                <X className="size-4.5" aria-hidden />
                            </Link>
                        </Button>
                    </div>
                    {streetView && step !== 'report' && (
                        <div className="px-5 pb-3.5">
                            <Button asChild variant="outline" className="min-h-11">
                                <a href={streetView} target="_blank" rel="noopener noreferrer">
                                    <Eye className="size-4" aria-hidden />
                                    {t('check.streetview')}
                                </a>
                            </Button>
                        </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pt-1 pb-4 lg:overflow-y-auto">
                        {step === 'ineligible' && (
                            <div className="flex flex-col gap-1 border-t pt-4">
                                <h3 className="text-lg font-bold">{t('check.ineligible.title')}</h3>
                                <p className="text-sm text-stone-600 dark:text-neutral-300">{t('check.ineligible.text')}</p>
                            </div>
                        )}

                        {step === 'ready' && (
                            <Form
                                action={confirm(place)}
                                options={{ preserveScroll: true }}
                                className="flex flex-col gap-3 border-t pt-4"
                                onHttpException={(response) => {
                                    if (response.status === 404) {
                                        router.reload();
                                        return false;
                                    }
                                }}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        {skipped && <p className="text-sm text-stone-600 dark:text-neutral-300">{t('check.skipped')}</p>}
                                        <h3 id="check-question" className="text-lg font-bold">
                                            {t('check.question')}
                                        </h3>
                                        {errors.general && (
                                            <p role="alert" className="text-sm text-destructive">
                                                {errors.general}
                                            </p>
                                        )}
                                        <div role="group" aria-labelledby="check-question" className="flex flex-col gap-2">
                                            <Button type="submit" variant="outline" disabled={processing} className={answer}>
                                                <Check className="size-4.5 shrink-0 text-blue-700 dark:text-blue-300" strokeWidth={2.5} aria-hidden />
                                                {t('check.confirm')}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={processing}
                                                className={answer}
                                                onClick={() => setReporting(true)}
                                            >
                                                <Flag className="size-4.5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden />
                                                {t('check.report')}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="link"
                                                disabled={processing}
                                                className="min-h-11 justify-start px-3.5 text-[15px] font-semibold text-stone-700 underline underline-offset-3 dark:text-neutral-200"
                                                onClick={() => next(true)}
                                            >
                                                {t('check.unsure')}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        )}

                        {step === 'report' && (
                            <ReportStep
                                source={place.source}
                                id={place.id}
                                onBack={() => setReporting(false)}
                                onReported={() => setReporting(false)}
                                onUnavailable={() => router.reload()}
                            />
                        )}

                        {step === 'confirmed' && (
                            <Outcome icon={<Check className="size-4.5" strokeWidth={2.5} />} tone="confirmed" title={t('check.confirmed')}>
                                <NextButton ref={focusRef(focusTarget)} onClick={() => next()} label={t('check.next')} />
                            </Outcome>
                        )}

                        {step === 'reported' && (
                            <Outcome
                                icon={<Flag className="size-4.5" />}
                                tone="reported"
                                title={t('check.reported.title')}
                                text={t('check.reported.text')}
                            >
                                <NextButton ref={focusRef(focusTarget)} onClick={() => next()} label={t('check.next')} />
                            </Outcome>
                        )}

                        {step !== 'report' && (
                            <dl className="flex flex-col text-sm">
                                <Detail label={t('check.details.orientation')}>{place.orientation ?? t('check.details.unknown')}</Detail>
                                {place.source === 'community' && (
                                    <Detail label={t('check.details.under_sign')}>{place.under_sign ?? t('check.details.unknown')}</Detail>
                                )}
                                <Detail label={t('check.details.source')}>
                                    {place.source === 'community' ? t('check.details.community') : t('check.details.municipal', { name })}
                                </Detail>
                                <Detail label={t('check.details.confirmed')}>
                                    {place.last_confirmed_at ? (
                                        <time dateTime={place.last_confirmed_at}>{formatShortDate(place.last_confirmed_at, i18n.language)}</time>
                                    ) : (
                                        t('check.details.never')
                                    )}
                                </Detail>
                            </dl>
                        )}
                    </div>
                    <p className="border-t px-5 pt-3 pb-4 text-xs text-stone-600 dark:text-neutral-400">{t('check.disclaimer')}</p>
                </>
            )}
        </section>
    );
}

const answer = 'min-h-12 h-auto justify-start gap-3 px-3.5 py-2.5 text-left text-[15px] font-semibold whitespace-normal';

/** Hands the element that should receive focus for the current step to the panel. */
function focusRef(target: RefObject<HTMLElement | null>) {
    return (element: HTMLElement | null) => {
        target.current = element;
    };
}

function Message({
    icon,
    tone = 'neutral',
    title,
    text,
    focus,
    children,
}: {
    icon: ReactNode;
    tone?: 'neutral' | 'error';
    title: string;
    text?: string;
    focus?: RefObject<HTMLElement | null>;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3.5 px-6 py-7">
            <span
                aria-hidden
                className={cn(
                    'flex size-11 items-center justify-center rounded-full',
                    tone === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-stone-100 text-stone-900 dark:bg-neutral-800 dark:text-white',
                )}
            >
                {icon}
            </span>
            <h2 id="check-step" ref={focus ? focusRef(focus) : undefined} tabIndex={-1} className="text-xl leading-snug font-bold">
                {title}
            </h2>
            {text && <p className="text-[15px] text-stone-600 dark:text-neutral-300">{text}</p>}
            {children}
        </div>
    );
}

function Outcome({
    icon,
    tone,
    title,
    text,
    children,
}: {
    icon: ReactNode;
    tone: 'confirmed' | 'reported';
    title: string;
    text?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3.5 border-t pt-4">
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        tone === 'confirmed' ? 'bg-blue-700 text-white' : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
                    )}
                >
                    {icon}
                </span>
                <span className={cn('flex flex-col gap-0.5', !text && 'self-center')}>
                    <strong className="text-[17px] leading-snug">{title}</strong>
                    {text && <span className="text-sm text-stone-600 dark:text-neutral-300">{text}</span>}
                </span>
            </div>
            {children}
        </div>
    );
}

function NextButton({ ref, onClick, label }: { ref?: Ref<HTMLButtonElement>; onClick: () => void; label: string }) {
    return (
        <Button ref={ref} size="lg" className="min-h-12" onClick={onClick}>
            {label}
            <ArrowRight className="size-4" aria-hidden />
        </Button>
    );
}

function BackLink({ href, label }: { href: ReturnType<typeof municipality>; label: string }) {
    return (
        <Link
            href={href}
            className="flex min-h-11 w-fit items-center text-[15px] font-semibold text-orange-700 underline-offset-4 hover:underline dark:text-orange-300"
        >
            {label}
        </Link>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-3 border-b border-stone-100 py-2.5 last:border-0 dark:border-neutral-800">
            <dt className="text-stone-600 dark:text-neutral-300">{label}</dt>
            <dd className="text-right">{children}</dd>
        </div>
    );
}
