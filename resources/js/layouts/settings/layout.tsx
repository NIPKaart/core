import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { appearance } from '@/routes';
import password from '@/routes/password';
import profile from '@/routes/profile';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { t } = useTranslation('backend/settings');
    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    const currentPath = window.location.pathname;

    const sidebarNavItems: NavItem[] = [
        {
            title: t('sidebar.profile'),
            href: profile.edit(),
            icon: null,
        },
        {
            title: t('sidebar.password'),
            href: password.edit(),
            icon: null,
        },
        {
            title: t('sidebar.appearance'),
            href: appearance(),
            icon: null,
        },
    ];

    return (
        <div className="px-4 py-6">
            <Heading title={t('meta.title')} description={t('meta.description')} />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav className="flex flex-col space-y-1 space-x-0">
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted': currentPath === (typeof item.href === 'string' ? item.href : item.href.url),
                                })}
                            >
                                <Link href={item.href} prefetch>
                                    {item.icon && <item.icon className="h-4 w-4" />}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">{children}</section>
                </div>
            </div>
        </div>
    );
}
