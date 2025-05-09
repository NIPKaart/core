import Navbar from '@/components/frontend/nav/nav-bar';

interface FrontendLayoutProps {
    children: React.ReactNode;
}

export default function FrontendLayout({ children }: FrontendLayoutProps) {
    return (
        <div className="bg-white text-black transition-colors dark:bg-neutral-900 dark:text-white">
            <Navbar />
            <main>{children}</main>
        </div>
    );
}
