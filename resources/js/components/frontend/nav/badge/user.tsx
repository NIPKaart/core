import LanguageSwitcher from '@/components/language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useAuthorization } from '@/hooks/use-authorization';
import { useInitials } from '@/hooks/use-initials';
import { useMediaQuery } from '@/hooks/use-media-query';
import { dashboard, logout } from '@/routes';
import { SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Home, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../theme-toggle';

export function UserNavMenu() {
    const { auth } = usePage<SharedData>().props;
    const { user } = useAuthorization();
    const isMobile = useMediaQuery();
    const getInitials = useInitials();
    const { t } = useTranslation('frontend/navbar');

    if (!user) return null;

    const handleLogout = () => {
        router.post(logout());
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 cursor-pointer rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={auth.user.avatar} alt={user.name} />
                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                            {getInitials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side={isMobile ? 'bottom' : 'bottom'} className="min-w-56 rounded-lg">
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <UserInfo user={auth.user} showEmail={true} />
                    </div>
                    <div className="px-1 py-1.5">
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <LanguageSwitcher />
                        </div>
                    </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href={dashboard()} className="cursor-pointer" prefetch>
                            <Home className="mr-2 h-4 w-4" />
                            {t('dashboard')}
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('logout')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
