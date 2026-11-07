import Footer from '@/components/frontend/footer';
import ReportStep from '@/components/map/parking-detail/report-step';
import { Button } from '@/components/ui/button';
import FrontendLayout from '@/layouts/frontend-layout';
import { placeLinkPath } from '@/lib/place-link';
import { login } from '@/routes';
import { municipality } from '@/routes/areas';
import { check } from '@/routes/areas/municipality';
import { confirm } from '@/routes/map/places';
import type { SharedData } from '@/types';
import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Cursor = { source: 'community' | 'municipal'; id: string };
type Place = Cursor & { street: string | null; latitude: number; longitude: number };
type Props = {
    area: { country: string; municipality: string };
    name: string;
    cursor: Cursor | null;
    state: 'ready' | 'confirmed' | 'reported' | 'withdrawn' | 'empty';
    canContribute: boolean;
    place: Place | null;
};

export default function ParkingCheck(props: Props) {
    const { t } = useTranslation('frontend/areas');
    const title = t('check.title', { name: props.name });

    return (
        <FrontendLayout>
            <Head title={title}>
                <meta head-key="robots" name="robots" content="noindex" />
            </Head>
            <div className="bg-canvas px-5 py-8 sm:py-14 dark:bg-neutral-950">
                <div className="mx-auto flex max-w-xl flex-col gap-5">
                    <Link href={municipality(props.area)} className="w-fit text-sm font-medium underline underline-offset-4">
                        {t('check.back', { name: props.name })}
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                    <CheckCard key={JSON.stringify(props.cursor)} {...props} />
                </div>
            </div>
            <Footer />
        </FrontendLayout>
    );
}

function CheckCard({ area, name, cursor, state, canContribute, place }: Props) {
    const { t, i18n } = useTranslation('frontend/areas');
    const { auth } = usePage<SharedData>().props;
    const [reporting, setReporting] = useState(false);
    const [unsure, setUnsure] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const displayState = state === 'ready' && unsure ? 'unsure' : state;
    const reportOpen = displayState === 'ready' && reporting;

    useEffect(() => {
        heading.current?.focus();
    }, [displayState, reportOpen]);

    const coordinates = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 5, maximumFractionDigits: 5 });
    const address = place?.street?.trim() || t('check.no_street');
    const checkTitle = reportOpen ? t('check.report') : displayState === 'ready' ? t('check.question') : t(`check.status.${displayState}`);
    const returnPath = check.url(area, { query: cursor ?? {} });

    return (
        <section aria-labelledby="check-step" className="flex min-w-0 flex-col gap-5 rounded-xl border bg-card p-4 text-card-foreground sm:p-6">
            <h2 id="check-step" ref={heading} tabIndex={-1} className="text-xl font-semibold">
                {checkTitle}
            </h2>
            {place && (
                <div className="flex flex-col gap-1">
                    <p className="font-medium break-words">{t('check.address', { address, name })}</p>
                    <p className="text-sm text-muted-foreground">
                        {coordinates.format(place.latitude)} · {coordinates.format(place.longitude)}
                    </p>
                    <Link href={placeLinkPath(place)} className="flex min-h-11 w-fit items-center text-sm underline underline-offset-4">
                        {t('check.map')}
                    </Link>
                </div>
            )}
            {reportOpen && place ? (
                <ReportStep
                    source={place.source}
                    id={place.id}
                    onBack={() => setReporting(false)}
                    onReported={() => setReporting(false)}
                    onUnavailable={() => router.reload()}
                />
            ) : (
                <>
                    {displayState === 'ready' && place && (
                        <>
                            <p className="text-sm text-muted-foreground">{t('check.explanation')}</p>
                            {!auth.user ? (
                                <Button asChild className="min-h-11 self-start">
                                    <Link href={login({ query: { return: returnPath } })}>{t('check.sign_in')}</Link>
                                </Button>
                            ) : canContribute ? (
                                <Form
                                    action={confirm(place)}
                                    className="flex flex-col gap-3"
                                    onHttpException={(response) => {
                                        if (response.status === 404) {
                                            router.reload();
                                            return false;
                                        }
                                    }}
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            {errors.general && (
                                                <p role="alert" className="text-sm text-destructive">
                                                    {errors.general}
                                                </p>
                                            )}
                                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                                <Button type="submit" className="min-h-11" disabled={processing}>
                                                    {t('check.confirm')}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="min-h-11"
                                                    disabled={processing}
                                                    onClick={() => setReporting(true)}
                                                >
                                                    {t('check.report')}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="min-h-11"
                                                    disabled={processing}
                                                    onClick={() => setUnsure(true)}
                                                >
                                                    {t('check.unsure')}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('check.ineligible')}</p>
                            )}
                        </>
                    )}
                    {displayState !== 'ready' && <p className="text-sm text-muted-foreground">{t(`check.detail.${displayState}`)}</p>}
                    {state !== 'empty' && cursor && (
                        <Button variant="ghost" asChild className="min-h-11 self-start">
                            <Link href={check(area, { query: { ...cursor, next: 1 } })}>{t('check.next')}</Link>
                        </Button>
                    )}
                    {state === 'empty' && cursor && (
                        <Button variant="outline" asChild className="min-h-11 self-start">
                            <Link href={check(area)}>{t('check.restart')}</Link>
                        </Button>
                    )}
                </>
            )}
        </section>
    );
}
