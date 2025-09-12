import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useAuthorization } from '@/hooks/use-authorization';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import profile from '@/routes/profile';
import { type User } from '@/types';
import { Link, router } from '@inertiajs/react';
import { Info, LogOut, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserMenuContentProps {
    user: User;
    onOpenAbout: () => void;
}

export function UserMenuContent({ user, onOpenAbout }: UserMenuContentProps) {
    const { t } = useTranslation('backend/sidebar');
    const cleanup = useMobileNavigation();
    const { hasRole } = useAuthorization();

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full cursor-pointer"
                        href={profile.edit()}
                        as="button"
                        prefetch
                        onClick={handleLogout}
                        data-test="profile-button"
                    >
                        <Settings className="mr-2" />
                        {t('settings')}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            {hasRole('admin') && (
                <DropdownMenuItem onSelect={() => onOpenAbout()} className="cursor-pointer">
                    <Info className="mr-2" />
                    {t('about')}
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link className="block w-full cursor-pointer" href={logout()} as="button" onClick={cleanup} data-test="logout-button">
                    <LogOut className="mr-2" />
                    {t('logout')}
                </Link>
            </DropdownMenuItem>
        </>
    );
}
