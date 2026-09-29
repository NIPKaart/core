import { openSearch, setSearchQuery, useSearchQuery } from '@/components/search/search-store';
import { cn } from '@/lib/utils';
import { locationMap } from '@/routes';
import { Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The home page's destination search. Typing hands off to the shared search dialog, which suggests destinations
 * and opens the map around the chosen one, so both entry points behave the same.
 */
export default function HomeSearch({ hideLabel = false, inverted = false }: { hideLabel?: boolean; inverted?: boolean }) {
    const { t } = useTranslation('frontend/home');
    const query = useSearchQuery();
    const search = (value: string) => {
        setSearchQuery(value);
        openSearch();
    };

    return (
        <form
            role="search"
            className="flex flex-col gap-2.5"
            onSubmit={(event) => {
                event.preventDefault();
                search(query);
            }}
        >
            <label htmlFor="home-destination" className={hideLabel ? 'sr-only' : 'text-[15px] font-semibold'}>
                {t('hero.label')}
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-stone-500" aria-hidden />
                    <input
                        id="home-destination"
                        type="search"
                        autoComplete="off"
                        value={query}
                        onChange={(event) => search(event.target.value)}
                        placeholder={t('hero.placeholder')}
                        className="h-13 w-full rounded-xl border border-stone-300 bg-white pr-4 pl-11 text-[17px] placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-14 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                </div>
                <button
                    type="submit"
                    className={cn(
                        'h-13 rounded-xl px-6 font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:h-14',
                        inverted
                            ? 'bg-white text-stone-900 hover:bg-stone-200 focus-visible:ring-offset-stone-900'
                            : 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200',
                    )}
                >
                    {t('hero.submit')}
                </button>
            </div>
            <div
                className={cn(
                    'flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[15px] sm:justify-start',
                    inverted ? 'text-stone-300' : 'text-stone-600 dark:text-stone-400',
                )}
            >
                <span className="hidden sm:inline">{t('hero.no_account')}</span>
                <Link
                    href={locationMap()}
                    className={cn(
                        'flex min-h-11 items-center font-semibold',
                        inverted ? 'text-orange-300 hover:text-orange-200' : 'text-orange-700 hover:text-orange-800 dark:text-orange-400',
                    )}
                >
                    {t('hero.map')}
                </Link>
            </div>
        </form>
    );
}
