import { Icon } from '@/components/icon';
import LanguageSwitcher from '@/components/language-switcher';
import BellBadge from '@/components/notifications/badge-bell';
import SearchButton from '@/components/search/search-button';
import { closeSearch, openSearch, useSearchOpen } from '@/components/search/search-store';
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuItem } from '@/components/ui/navigation-menu';
import { useIsActive } from '@/lib/is-active';
import { cn } from '@/lib/utils';
import { about, dashboard, garages, home, locationMap, login, logout } from '@/routes';
import { add } from '@/routes/location-map';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, LogOut, Menu, Search, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FavoritesButton } from './badge/favorites';
import { UserNavMenu } from './badge/user';
import { NavItem } from './nav-item';
import { ThemeToggle } from './theme-toggle';

export default function Navbar({ showSearch = true, mapSearch = false }: { showSearch?: boolean; mapSearch?: boolean }) {
    const searchOpen = useSearchOpen();
    const { t } = useTranslation('frontend/navbar');
    const { t: tSearch } = useTranslation('global/search');
    const page = usePage<SharedData>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { auth } = page.props;
    const { isActive } = useIsActive();

    const navigation = [
        { name: t('find'), href: locationMap() },
        { name: t('add'), href: add() },
        { name: t('garages'), href: garages() },
        { name: t('about'), href: about() },
    ];

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    return (
        <>
            <header className="relative z-50 bg-white dark:bg-neutral-900">
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-[18px] lg:px-8 lg:py-5" aria-label={t('navigation')}>
                    {/* Logo */}
                    <div className="z-50 flex shrink-0 lg:flex-1">
                        <Link href={home()} className="-m-1.5 p-1.5">
                            <span className="sr-only">NIPKaart</span>
                            <img src="/assets/images/logo-light.svg" alt="NIPKaart" className="h-8 w-auto dark:hidden" />
                            <img src="/assets/images/logo-dark.svg" alt="NIPKaart" className="hidden h-8 w-auto dark:block" />
                        </Link>
                    </div>

                    {/* Mobile actions (favorites, notifications, hamburger) */}
                    <div className="relative z-50 flex items-center gap-2 lg:hidden">
                        {showSearch && <SearchButton variant="icon" tooltip={tSearch('title')} />}
                        {auth.user && (
                            <div className="me-1 flex items-center gap-1">
                                <div className="relative flex min-w-8 justify-center">
                                    <FavoritesButton />
                                </div>
                                <div className="relative flex min-w-8 justify-center">
                                    <BellBadge />
                                </div>
                            </div>
                        )}

                        {mapSearch && (
                            <Button
                                id="map-search-toggle"
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                aria-label={tSearch('title')}
                                aria-expanded={searchOpen}
                                aria-controls="map-destination-search"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    if (searchOpen) closeSearch();
                                    else {
                                        flushSync(() => openSearch());
                                        const input = document.querySelector<HTMLInputElement>('#map-destination-search input');
                                        input?.focus();
                                        input?.select();
                                    }
                                }}
                            >
                                <Search className="size-5" aria-hidden />
                            </Button>
                        )}

                        <button
                            onClick={() => {
                                if (mapSearch) closeSearch();
                                setMobileMenuOpen((prev) => !prev);
                            }}
                            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-300"
                            aria-expanded={mobileMenuOpen}
                            aria-controls="mobile-nav"
                        >
                            <span className="sr-only">{t('toggle_menu')}</span>
                            <Icon iconNode={mobileMenuOpen ? X : Menu} className="size-6 transition-transform duration-200" />
                        </button>
                    </div>

                    {/* Desktop nav */}
                    <div className="ml-6 hidden h-full items-center space-x-6 lg:flex">
                        <NavigationMenu className="flex h-full items-stretch gap-x-2">
                            {navigation.map((item) => (
                                <NavigationMenuItem key={item.name} className="relative flex h-full items-center">
                                    <NavItem
                                        name={item.name}
                                        href={item.href.url}
                                        className={cn(
                                            'h-10 px-3 text-base whitespace-nowrap xl:px-6',
                                            isActive(item.href) && 'font-semibold text-orange-600 dark:text-orange-400',
                                        )}
                                    />
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenu>
                    </div>

                    {/* Desktop right side */}
                    <div className="hidden items-center gap-4 lg:flex lg:flex-1 lg:justify-end">
                        <div className="flex items-center gap-2">
                            {showSearch && <SearchButton variant="icon" tooltip={tSearch('title')} />}
                            {auth.user && <FavoritesButton />}
                            {auth.user && <BellBadge />}
                            {!auth.user && <LanguageSwitcher />}
                            {!auth.user && <ThemeToggle />}
                        </div>
                        {auth.user ? (
                            <UserNavMenu />
                        ) : (
                            <Link href={login()} className="text-sm font-semibold whitespace-nowrap text-gray-900 dark:text-white">
                                {t('login')} →
                            </Link>
                        )}
                    </div>
                </nav>

                {/* Mobile accordion menu */}
                <Transition
                    show={mobileMenuOpen}
                    as={Fragment}
                    enter="transition duration-150 ease-out"
                    enterFrom="-translate-y-3 opacity-0"
                    enterTo="translate-y-0 opacity-100"
                    leave="transition duration-100 ease-in"
                    leaveFrom="translate-y-0 opacity-100"
                    leaveTo="-translate-y-2 opacity-0"
                >
                    <div className="absolute top-full right-0 left-0 z-40 w-full border-b border-gray-200 bg-white px-4 py-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="space-y-2">
                            {navigation.map((item) => (
                                <NavItem key={item.name} name={item.name} href={item.href.url} onClick={() => setMobileMenuOpen(false)} />
                            ))}
                        </div>

                        {/* Compact utilities under the menu */}
                        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                            {auth.user ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <Link
                                            href={dashboard()}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center gap-2 text-base font-medium text-gray-800 hover:underline dark:text-white"
                                        >
                                            <LayoutDashboard className="h-5 w-5" />
                                            {t('dashboard')}
                                        </Link>

                                        <Link
                                            href={logout()}
                                            method="post"
                                            as="button"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="flex items-center gap-2 text-base font-medium text-gray-800 hover:underline dark:text-white"
                                        >
                                            <LogOut className="h-5 w-5" />
                                            {t('logout')}
                                        </Link>
                                    </div>

                                    <div className="mt-4 flex justify-center gap-4">
                                        <LanguageSwitcher />
                                        <ThemeToggle />
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <Link
                                        href={login()}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="font-semibold text-gray-900 dark:text-white"
                                    >
                                        {t('login')} →
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <LanguageSwitcher />
                                        <ThemeToggle />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Transition>
            </header>

            {/* Overlay when mobile nav is open */}
            <Transition
                show={mobileMenuOpen}
                as={Fragment}
                enter="transition-opacity duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <div className="fixed inset-0 z-30 bg-transparent backdrop-blur-sm" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} />
            </Transition>
        </>
    );
}
