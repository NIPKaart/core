import { about, contact, garages, locationMap } from '@/routes';
import { add } from '@/routes/location-map';
import { Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

const GITHUB_URL = 'https://github.com/NIPKaart';

const link = 'flex min-h-11 items-center text-[15px] text-stone-700 hover:text-stone-950 lg:min-h-0 dark:text-stone-300 dark:hover:text-white';

export default function Footer() {
    const { t } = useTranslation('frontend/footer');

    return (
        <footer className="border-t border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-10 pb-8 sm:px-6 lg:gap-10 lg:px-8 lg:pt-14">
                <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
                    <div className="flex max-w-md flex-col gap-3.5">
                        <img src="/assets/images/logo-light.svg" alt="NIPKaart" className="h-8 w-auto self-start dark:hidden" />
                        <img src="/assets/images/logo-dark.svg" alt="NIPKaart" className="hidden h-8 w-auto self-start dark:block" />
                        <p className="text-[15px] text-stone-600 dark:text-stone-400">{t('tagline')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-24">
                        <nav aria-label={t('parking')} className="flex flex-col lg:gap-3">
                            <span className="pb-1 text-sm font-semibold lg:pb-0">{t('parking')}</span>
                            <Link href={locationMap()} className={link}>
                                {t('find')}
                            </Link>
                            <Link href={add()} className={link}>
                                {t('add')}
                            </Link>
                            <Link href={garages()} className={link}>
                                {t('garages')}
                            </Link>
                        </nav>
                        <nav aria-label={t('nipkaart')} className="flex flex-col lg:gap-3">
                            <span className="pb-1 text-sm font-semibold lg:pb-0">{t('nipkaart')}</span>
                            <Link href={about()} className={link}>
                                {t('about')}
                            </Link>
                            <Link href={contact()} className={link}>
                                {t('contact')}
                            </Link>
                            <a href={GITHUB_URL} className={link} target="_blank" rel="noopener noreferrer">
                                {t('github')}
                            </a>
                        </nav>
                    </div>
                </div>
                <p className="border-t border-stone-100 pt-5 text-[13px] text-stone-600 dark:border-neutral-800 dark:text-stone-400">
                    {t('disclaimer', { year: new Date().getFullYear() })}
                </p>
            </div>
        </footer>
    );
}
