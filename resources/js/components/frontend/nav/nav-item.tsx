import { useIsActive } from '@/lib/is-active';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

interface NavItemProps {
    name: string;
    href: string;
    onClick?: () => void;
    className?: string;
}

export function NavItem({ name, href, onClick, className }: NavItemProps) {
    const { isActive } = useIsActive();

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                'block rounded px-4 py-2 text-base font-medium transition',
                isActive(href)
                    ? 'font-semibold text-orange-600 dark:text-orange-400'
                    : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-neutral-800',
                className,
            )}
        >
            {name}
        </Link>
    );
}
