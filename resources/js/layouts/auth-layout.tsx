import { useSyncLocale } from '@/hooks/use-sync-locale';
import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    description: string;
}

export default function AuthLayout({ children, title, description, ...props }: AuthLayoutProps) {
    useSyncLocale();

    return (
        <AuthLayoutTemplate title={title} description={description} {...props}>
            {children}
        </AuthLayoutTemplate>
    );
}
