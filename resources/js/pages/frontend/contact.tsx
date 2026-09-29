import { store } from '@/actions/App/Http/Controllers/Frontend/ContactController';
import Footer from '@/components/frontend/footer';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FrontendLayout from '@/layouts/frontend-layout';
import { cn } from '@/lib/utils';
import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const GITHUB_ISSUES_URL = 'https://github.com/NIPKaart/core/issues';

const TOPICS = ['question', 'map_error', 'data', 'other'] as const;
type Topic = (typeof TOPICS)[number];

const link = 'flex min-h-11 items-center self-start font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400';
const field = 'h-11 bg-white dark:bg-neutral-900';

export default function Contact({ email }: { email: string }) {
    const { t } = useTranslation('frontend/contact');
    const [topic, setTopic] = useState<Topic>('question');

    return (
        <FrontendLayout>
            <Head title={t('meta.title')}>
                <meta name="description" content={t('meta.description')} />
            </Head>

            <div className="bg-canvas dark:bg-neutral-950">
                <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-9 pb-14 sm:px-6 lg:gap-12 lg:px-8 lg:pt-18 lg:pb-28">
                    <header className="flex max-w-3xl flex-col gap-3 lg:gap-3.5">
                        <h1 className="text-[2.125rem] leading-tight font-bold tracking-tight lg:text-[2.75rem]">{t('title')}</h1>
                        <p className="text-[17px] leading-relaxed text-stone-600 lg:text-lg dark:text-stone-400">{t('intro')}</p>
                    </header>

                    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
                        <Form
                            {...store.form()}
                            resetOnSuccess={['name', 'email', 'location', 'message']}
                            onSuccess={() => setTopic('question')}
                            options={{ preserveScroll: true }}
                            aria-labelledby="contact-form"
                            className="flex flex-col gap-5.5 self-start rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7 lg:p-8 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <h2 id="contact-form" className="text-lg font-semibold lg:text-xl">
                                        {t('form.title')}
                                    </h2>

                                    <fieldset className="flex flex-col gap-2.5">
                                        <legend className="mb-2.5 text-[15px] font-semibold">{t('form.topic')}</legend>
                                        <div className="grid grid-cols-2 gap-1 self-stretch rounded-lg bg-stone-200/70 p-1 sm:flex sm:self-start dark:bg-neutral-800">
                                            {TOPICS.map((value) => (
                                                <label
                                                    key={value}
                                                    className={cn(
                                                        'flex min-h-10 cursor-pointer items-center justify-center rounded-md px-3.5 text-center text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                                        topic === value
                                                            ? 'bg-white font-semibold shadow-sm dark:bg-neutral-950'
                                                            : 'text-stone-700 hover:bg-white/60 dark:text-stone-300 dark:hover:bg-neutral-900/60',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="topic"
                                                        value={value}
                                                        checked={topic === value}
                                                        onChange={() => setTopic(value)}
                                                        className="sr-only"
                                                    />
                                                    {t(`form.topics.${value}`)}
                                                </label>
                                            ))}
                                        </div>
                                        <InputError message={errors.topic} />
                                    </fieldset>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="contact-name">{t('form.name')}</Label>
                                            <Input id="contact-name" name="name" required maxLength={100} autoComplete="name" className={field} />
                                            <InputError message={errors.name} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="contact-email">{t('form.email')}</Label>
                                            <Input
                                                id="contact-email"
                                                name="email"
                                                type="email"
                                                required
                                                maxLength={255}
                                                autoComplete="email"
                                                className={field}
                                            />
                                            <InputError message={errors.email} />
                                        </div>
                                    </div>

                                    {topic === 'map_error' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="contact-location">{t('form.location')}</Label>
                                            <Input
                                                id="contact-location"
                                                name="location"
                                                maxLength={500}
                                                placeholder={t('form.location_placeholder')}
                                                className={field}
                                            />
                                            <InputError message={errors.location} />
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="contact-message">
                                            {t(topic === 'map_error' ? 'form.message_map_error' : 'form.message')}
                                        </Label>
                                        <Textarea
                                            id="contact-message"
                                            name="message"
                                            required
                                            maxLength={5000}
                                            rows={6}
                                            className="min-h-36 bg-white dark:bg-neutral-900"
                                        />
                                        <InputError message={errors.message} />
                                    </div>

                                    <div className="absolute -left-[9999px]" aria-hidden>
                                        <label htmlFor="contact-website">{t('form.website')}</label>
                                        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                                    </div>

                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                        <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">{t('form.privacy')}</p>
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="h-11 shrink-0 rounded-lg bg-stone-900 px-5 font-semibold text-white hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                                        >
                                            {processing ? t('form.sending') : t('form.submit')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </Form>

                        <aside className="lg:col-span-4 lg:col-start-9">
                            <section
                                aria-labelledby="contact-email"
                                className="flex flex-col gap-1.5 border-t border-stone-200 py-5 dark:border-neutral-800"
                            >
                                <h2 id="contact-email" className="font-semibold lg:text-[17px]">
                                    {t('email.title')}
                                </h2>
                                <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{t('email.text')}</p>
                                <a href={`mailto:${email}`} className={`${link} break-all`}>
                                    {email}
                                </a>
                            </section>
                            <section
                                aria-labelledby="contact-data"
                                className="flex flex-col gap-1.5 border-t border-stone-200 py-5 dark:border-neutral-800"
                            >
                                <h2 id="contact-data" className="font-semibold lg:text-[17px]">
                                    {t('data.title')}
                                </h2>
                                <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{t('data.text')}</p>
                            </section>
                            <section
                                aria-labelledby="contact-code"
                                className="flex flex-col gap-1.5 border-y border-stone-200 py-5 dark:border-neutral-800"
                            >
                                <h2 id="contact-code" className="font-semibold lg:text-[17px]">
                                    {t('code.title')}
                                </h2>
                                <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{t('code.text')}</p>
                                <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className={`${link} text-[15px]`}>
                                    {t('code.link')}
                                </a>
                            </section>
                        </aside>
                    </div>
                </div>
            </div>

            <Footer />
        </FrontendLayout>
    );
}
