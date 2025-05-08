import { Icon } from '@/components/icon';
import { NavigationMenu, NavigationMenuItem, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Dialog, DialogPanel } from '@headlessui/react';
import { Link, usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from './theme-toggle';

const navigation = [
    { name: 'Home', href: route('home') },
    { name: 'Features', href: '#' },
    { name: 'Marketplace', href: '#' },
    { name: 'Contact', href: route('contact') },
];

const activeItemStyles = 'text-orange-600 dark:text-orange-400 font-semibold';

export default function Navbar() {
    const page = usePage<SharedData>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { auth } = page.props;

    return (
        <header className="bg-white dark:bg-neutral-900">
            <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
                {/* Logo */}
                <div className="flex lg:flex-1">
                    <a href={route('home')} className="-m-1.5 p-1.5">
                        <span className="sr-only">NIPKaart</span>
                        <img alt="NIPKaart" src="/assets/images/logo-light.svg" className="h-8 w-auto dark:hidden" />
                        <img alt="NIPKaart" src="/assets/images/logo-dark.svg" className="hidden h-8 w-auto dark:block" />
                    </a>
                </div>

                {/* Mobile menu button */}
                <div className="flex lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-300"
                    >
                        <span className="sr-only">Open main menu</span>
                        <Icon iconNode={Menu} className="size-6" />
                    </button>
                </div>

                {/* Desktop menu */}
                <div className="ml-6 hidden h-full items-center space-x-6 lg:flex">
                    <NavigationMenu className="flex h-full items-stretch gap-x-2">
                        {navigation.map((item) => (
                            <NavigationMenuItem key={item.name} className="relative flex h-full items-center">
                                <Link
                                    href={item.href}
                                    className={cn(
                                        navigationMenuTriggerStyle(),
                                        'bg-transparent dark:bg-transparent',
                                        page.url === item.href && activeItemStyles,
                                        'h-10 rounded-md px-6 text-base transition hover:bg-gray-100 dark:hover:bg-neutral-800',
                                    )}
                                >
                                    {item.name}
                                </Link>
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
                        <a href={route('login')} className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            Log in <span aria-hidden="true">&rarr;</span>
                        </a>
                    )}
                </div>
            </nav>

            {/* Mobile menu */}
            <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
                <div className="fixed inset-0 z-10" />
                <DialogPanel className="fixed inset-y-0 right-0 z-10 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 dark:bg-neutral-900">
                    <div className="flex items-center justify-between">
                        <a href={route('home')} className="-m-1.5 p-1.5">
                            <span className="sr-only">NIPKaart</span>
                            <img alt="NIPKaart" src="/assets/images/logo-light.svg" className="h-8 w-auto dark:hidden" />
                            <img alt="NIPKaart" src="/assets/images/logo-dark.svg" className="hidden h-8 w-auto dark:block" />
                        </a>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            className="-m-2.5 rounded-md p-2.5 text-gray-700 dark:text-gray-300"
                        >
                            <span className="sr-only">Close menu</span>
                            <Icon iconNode={X} className="size-6" />
                        </button>
                    </div>
                    <div className="mt-6 flow-root">
                        <div className="-my-6 divide-y divide-gray-500/10 dark:divide-gray-700/30">
                            <div className="space-y-2 py-6">
                                {navigation.map((item) => (
                                    <a
                                        key={item.name}
                                        href={item.href}
                                        className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-neutral-800"
                                    >
                                        {item.name}
                                    </a>
                                ))}
                            </div>
                            <div className="space-y-4 py-6">
                                <ThemeToggle />
                                <div>
                                    <a
                                        href={route('login')}
                                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-neutral-800"
                                    >
                                        Log in
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogPanel>
            </Dialog>
        </header>
    );
}
