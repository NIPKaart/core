import { Icon } from '@/components/icon';
import { NavigationMenu, NavigationMenuItem } from '@/components/ui/navigation-menu';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { NavItem } from './nav-item';
import { ThemeToggle } from './theme-toggle';

const navigation = [
    { name: 'Home', href: route('home'), routeName: 'home' },
    { name: 'Map', href: '#', routeName: 'map' },
    { name: 'Garages', href: '#', routeName: 'garages' },
    { name: 'About', href: '#', routeName: 'about' },
    { name: 'Contact', href: route('contact'), routeName: 'contact' },
];

export default function Navbar() {
    const page = usePage<SharedData>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { auth } = page.props;

    // Prevent page scroll when menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    return (
        <>
            <header className="relative z-50 bg-white dark:bg-neutral-900">
                <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
                    {/* Logo */}
                    <div className="z-50 flex lg:flex-1">
                        <Link href={route('home')} className="-m-1.5 p-1.5">
                            <span className="sr-only">NIPKaart</span>
                            <img src="/assets/images/logo-light.svg" alt="NIPKaart" className="h-8 w-auto dark:hidden" />
                            <img src="/assets/images/logo-dark.svg" alt="NIPKaart" className="hidden h-8 w-auto dark:block" />
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <div className="relative z-50 flex lg:hidden">
                        <button
                            onClick={() => setMobileMenuOpen((prev) => !prev)}
                            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-300"
                        >
                            <span className="sr-only">Toggle menu</span>
                            <Icon iconNode={mobileMenuOpen ? X : Menu} className="size-6 transition-transform duration-200" />
                        </button>
                    </div>

                    {/* Desktop nav */}
                    <div className="ml-6 hidden h-full items-center space-x-6 lg:flex">
                        <NavigationMenu className="flex h-full items-stretch gap-x-2">
                            {navigation.map((item) => (
                                <NavigationMenuItem key={item.name} className="relative flex h-full items-center">
                                    <NavItem name={item.name} href={item.href} routeName={item.routeName} className="h-10 px-6 text-base" />
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenu>
                    </div>

                    {/* Desktop right side */}
                    <div className="hidden items-center gap-4 lg:flex lg:flex-1 lg:justify-end">
                        <ThemeToggle />
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <Link href={route('login')} className="text-sm font-semibold text-gray-900 dark:text-white">
                                Log in →
                            </Link>
                        )}
                    </div>
                </nav>

                {/* Mobile dropdown */}
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
                    <div className="absolute top-full right-0 left-0 z-40 w-full border-b border-gray-200 bg-white px-4 py-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="space-y-2">
                            {navigation.map((item) => (
                                <NavItem
                                    key={item.name}
                                    name={item.name}
                                    href={item.href}
                                    routeName={item.routeName}
                                    onClick={() => setMobileMenuOpen(false)}
                                />
                            ))}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-semibold text-gray-900 hover:underline dark:text-white"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-sm font-semibold text-gray-900 dark:text-white"
                                >
                                    Log in →
                                </Link>
                            )}
                            <ThemeToggle />
                        </div>
                    </div>
                </Transition>
            </header>

            {/* BACKGROUND OVERLAY */}
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
