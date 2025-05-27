import { Icon } from '@/components/icon';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuTrigger } from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { FavoritesNavButton } from './favorties-nav-item';
import { NavItem } from './nav-item';
import { ThemeToggle } from './theme-toggle';

const navigation = [
    { name: 'Home', href: route('home'), routeName: 'home' },
    {
        name: 'Map',
        routeName: 'map',
        children: [
            {
                name: 'View all locations',
                href: route('map'),
                description: 'Look at the map with all the locations.',
            },
            {
                name: 'Add new location',
                href: route('map.add'),
                description: 'New location? Add it to the map.',
            },
        ],
    },
    { name: 'Garages', href: '#', routeName: 'garages' },
    { name: 'About', href: '#', routeName: 'about' },
    { name: 'Contact', href: route('contact'), routeName: 'contact' },
];

export default function Navbar() {
    const page = usePage<SharedData>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { auth } = page.props;

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    return (
        <>
            <header className="relative z-50 bg-white dark:bg-neutral-900">
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-[18px] lg:px-8 lg:py-5" aria-label="Global">
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
                                    {item.children ? (
                                        <div className="relative flex h-full items-center">
                                            <NavigationMenuTrigger
                                                className={cn(
                                                    'h-10 rounded bg-transparent px-6 text-base font-medium transition hover:bg-transparent focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent',
                                                    route().current(item.routeName + '*')
                                                        ? 'text-orange-600 dark:text-orange-400'
                                                        : 'text-gray-900 dark:text-white',
                                                )}
                                            >
                                                {item.name}
                                            </NavigationMenuTrigger>
                                            <NavigationMenuContent>
                                                <ul className="min-w-[250px] p-2">
                                                    {item.children.map((child) => (
                                                        <li key={child.name}>
                                                            <Link
                                                                href={child.href}
                                                                className={cn(
                                                                    'hover:bg-accent focus:bg-accent block rounded-md px-3 py-2 transition-colors',
                                                                    route().current(child.href)
                                                                        ? 'text-orange-600 dark:text-orange-400'
                                                                        : 'text-gray-900 dark:text-neutral-100',
                                                                )}
                                                            >
                                                                <div className="text-sm font-medium">{child.name}</div>
                                                                {child.description && (
                                                                    <p className="text-xs text-gray-500 dark:text-neutral-400">{child.description}</p>
                                                                )}
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </NavigationMenuContent>
                                        </div>
                                    ) : (
                                        <NavItem
                                            name={item.name}
                                            href={item.href}
                                            routeName={item.routeName}
                                            className={cn(
                                                'h-10 px-6 text-base',
                                                route().current(item.routeName) && 'font-semibold text-orange-600 dark:text-orange-400',
                                            )}
                                        />
                                    )}
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenu>
                    </div>

                    {/* Desktop right side */}
                    <div className="hidden items-center gap-4 lg:flex lg:flex-1 lg:justify-end">
                        <div className="flex items-center gap-2">
                            {auth.user && <FavoritesNavButton />}
                            <ThemeToggle />
                        </div>
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
                        <Accordion type="multiple" className="space-y-2">
                            {navigation.map((item) =>
                                item.children ? (
                                    <AccordionItem key={item.name} value={item.name}>
                                        <AccordionTrigger
                                            className={cn(
                                                'px-4 py-2 text-left text-base font-medium transition',
                                                route().current(item.routeName + '*')
                                                    ? 'text-orange-600 dark:text-orange-400'
                                                    : 'text-gray-800 dark:text-white',
                                            )}
                                        >
                                            {item.name}
                                        </AccordionTrigger>
                                        <AccordionContent className="pl-4">
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.name}
                                                    href={child.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={cn(
                                                        'block px-2 py-1 text-sm transition',
                                                        route().current(child.href)
                                                            ? 'font-semibold text-orange-600 dark:text-orange-400'
                                                            : 'text-gray-700 hover:underline dark:text-neutral-200',
                                                    )}
                                                >
                                                    {child.name}
                                                </Link>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ) : (
                                    <NavItem
                                        key={item.name}
                                        name={item.name}
                                        href={item.href}
                                        routeName={item.routeName}
                                        onClick={() => setMobileMenuOpen(false)}
                                    />
                                ),
                            )}
                        </Accordion>

                        <div className="mt-4 flex items-center justify-between border-t border-gray-200 px-4 pt-4 dark:border-gray-700">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="font-semibold text-gray-900 hover:underline dark:text-white"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="font-semibold text-gray-900 dark:text-white"
                                >
                                    Log in →
                                </Link>
                            )}
                            <div className="flex items-center gap-2">
                                {auth.user && <FavoritesNavButton closeMobileMenu={() => setMobileMenuOpen(false)} />}
                                <ThemeToggle />
                            </div>
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
