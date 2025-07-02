import { Alert } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Eye, LucideIcon, X } from 'lucide-react';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error' | 'primary';

interface ComponentProps {
    variant: BannerVariant;
    icon?: LucideIcon;
    title: string;
    description: string;
    className?: string;
}

const variantIconMap: Record<BannerVariant, LucideIcon> = {
    info: Eye,
    success: CheckCircle,
    warning: AlertTriangle,
    error: X,
    primary: Eye,
};

const colorClassMap: Record<
    BannerVariant,
    {
        border: string;
        bg: string;
        text: string;
        icon: string;
        description: string;
    }
> = {
    info: {
        border: 'border-blue-300/60',
        bg: 'bg-blue-50 dark:bg-blue-900/80',
        text: 'text-blue-800 dark:text-blue-100',
        icon: 'text-blue-500',
        description: 'text-zinc-800 dark:text-blue-50',
    },
    success: {
        border: 'border-green-500/60',
        bg: 'bg-green-100 dark:bg-green-900/80',
        text: 'text-green-900 dark:text-green-100',
        icon: 'text-green-500',
        description: 'text-zinc-800 dark:text-green-50',
    },
    warning: {
        border: 'border-yellow-300/60',
        bg: 'bg-yellow-50 dark:bg-yellow-900/80',
        text: 'text-yellow-800 dark:text-yellow-100',
        icon: 'text-yellow-500',
        description: 'text-zinc-800 dark:text-yellow-50',
    },
    error: {
        border: 'border-red-300/60',
        bg: 'bg-red-50 dark:bg-red-900/80',
        text: 'text-red-800 dark:text-red-100',
        icon: 'text-red-500',
        description: 'text-zinc-800 dark:text-red-50',
    },
    primary: {
        border: 'border-orange-300/60',
        bg: 'bg-orange-50 dark:bg-orange-950/80',
        text: 'text-orange-800 dark:text-orange-100',
        icon: 'text-orange-500',
        description: 'text-zinc-800 dark:text-orange-50',
    },
};

export default function Banner({ variant, icon, title, description, className = '' }: ComponentProps) {
    const IconComponent = icon || variantIconMap[variant];
    const classes = colorClassMap[variant];

    return (
        <Alert className={`w-full border-2 ${classes.border} ${classes.bg} px-4 py-3 shadow-md ${className}`}>
            <div className="flex items-center gap-3 sm:items-start">
                <IconComponent className={`h-6 w-6 flex-shrink-0 pt-0.5 ${classes.icon}`} aria-hidden="true" />
                <div>
                    <h3 className={`mb-1 text-base font-semibold ${classes.text}`}>{title}</h3>
                    <p className={`text-sm leading-relaxed ${classes.description}`}>{description}</p>
                </div>
            </div>
        </Alert>
    );
}
