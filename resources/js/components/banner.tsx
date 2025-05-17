import { AlertTriangle, CheckCircle, Eye, LucideIcon, X } from 'lucide-react';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error' | 'primary';

interface ComponentProps {
    variant: BannerVariant;
    icon?: LucideIcon;
    title: string;
    description: string;
    className?: string;
}

// Base variant classes including primary
const variantClasses: Record<BannerVariant, string> = {
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    primary: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function Banner({ variant, icon, title, description, className = '' }: ComponentProps) {
    // Default icons per variant
    const defaultIcons: Record<BannerVariant, LucideIcon> = {
        info: Eye,
        success: CheckCircle,
        warning: AlertTriangle,
        error: X,
        primary: Eye,
    };

    const IconComponent = icon || defaultIcons[variant];
    const colorStyles = variantClasses[variant];

    return (
        <div className={`flex w-full items-start rounded-lg p-4 shadow-md ${colorStyles} ${className}`}>
            <IconComponent className="mr-3 h-6 w-6 flex-shrink-0" />
            <div>
                <h3 className="mb-1 text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed">{description}</p>
            </div>
        </div>
    );
}
