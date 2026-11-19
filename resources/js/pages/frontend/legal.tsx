import Footer from '@/components/frontend/footer';
import TextLink from '@/components/text-link';
import FrontendLayout from '@/layouts/frontend-layout';
import { contact } from '@/routes';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

const REVISION_DATE = '2026-11-08';
const sections = {
    terms: ['terms.sections.map', 'terms.sections.account', 'terms.sections.contributions', 'terms.sections.licences'],
    privacy: [
        'privacy.sections.controller',
        'privacy.sections.account',
        'privacy.sections.contributions',
        'privacy.sections.contact',
        'privacy.sections.map',
        'privacy.sections.storage',
        'privacy.sections.retention',
        'privacy.sections.rights',
    ],
} as const;

export default function Legal({ document }: { document: keyof typeof sections }) {
    const { t, i18n } = useTranslation('frontend/legal');
    const title = t(`${document}.title`);
    const revision = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(REVISION_DATE));

    return (
        <FrontendLayout>
            <Head title={title}>
                <meta name="robots" content="noindex" />
            </Head>
            <article className="mx-auto max-w-3xl px-5 py-10 sm:px-6 lg:py-16">
                <header className="flex flex-col gap-3 border-b border-border pb-7">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('revision')} <time dateTime={REVISION_DATE}>{revision}</time>
                    </p>
                    <p className="leading-relaxed text-muted-foreground">{t(`${document}.intro`)}</p>
                    <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed">{t('draft')}</p>
                </header>

                <div className="mt-8 space-y-8">
                    {sections[document].map((section) => (
                        <section key={section}>
                            <h2 className="text-xl font-semibold">{t(`${section}.title`)}</h2>
                            <p className="mt-2 leading-relaxed">{t(`${section}.body`)}</p>
                        </section>
                    ))}
                    <TextLink href={contact()} className="inline-flex min-h-11 items-center">
                        {t('contactLink')}
                    </TextLink>
                </div>
            </article>
            <Footer />
        </FrontendLayout>
    );
}
