import { useIsActive } from '@/lib/is-active';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

interface NavItemProps {
    name: string;
    href: string;
    onClick?: () => void;
    className?: string;
    /** Also active on pages below this address, such as every area page below the area overview. */
    activePrefix?: boolean;
}

export function NavItem({ name, href, onClick, className, activePrefix = false }: NavItemProps) {
    const { isActive } = useIsActive();

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                'block rounded px-4 py-2 text-base font-medium transition',
                isActive(href, { prefix: activePrefix })
                    ? 'font-semibold text-orange-600 dark:text-orange-400'
                    : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-neutral-800',
                className,
            )}
        >
            {name}
        </Link>
    );
}
