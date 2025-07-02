import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ParkingSpace } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle, Eye, X } from 'lucide-react';

type Props = {
    parkingSpace: ParkingSpace;
    label: string;
    description: string;
};

const variantMap = {
    pending: {
        icon: Eye,
        color: 'orange',
    },
    approved: {
        icon: CheckCircle,
        color: 'green',
    },
    rejected: {
        icon: X,
        color: 'red',
    },
} as const;

type VariantKey = keyof typeof variantMap;

const colorClassMap = {
    orange: {
        border: 'border-orange-300/60',
        bg: 'bg-orange-50 dark:bg-orange-950/80',
        text: 'text-orange-800 dark:text-orange-100',
        icon: 'text-orange-500',
        description: 'text-zinc-800 dark:text-orange-50',
    },
    green: {
        border: 'border-green-500/60',
        bg: 'bg-green-100 dark:bg-green-900/80',
        text: 'text-green-900 dark:text-green-100',
        icon: 'text-green-500',
        description: 'text-zinc-800 dark:text-green-50',
    },
    red: {
        border: 'border-red-300/60',
        bg: 'bg-red-50 dark:bg-red-900/80',
        text: 'text-red-800 dark:text-red-100',
        icon: 'text-red-500',
        description: 'text-zinc-800 dark:text-red-50',
    },
    zinc: {
        border: 'border-zinc-300/60',
        bg: 'bg-zinc-50 dark:bg-zinc-800/80',
        text: 'text-zinc-800 dark:text-zinc-100',
        icon: 'text-zinc-500',
        description: 'text-zinc-800 dark:text-zinc-50',
    },
} as const;

export default function ParkingSpaceStatusBanner({ parkingSpace, label, description }: Props) {
    const status = parkingSpace.status as VariantKey;
    const variant = variantMap[status] ?? { icon: AlertTriangle, color: 'zinc' };
    const Icon: LucideIcon = variant.icon;
    const color = variant.color;
    const classes = colorClassMap[color as keyof typeof colorClassMap];

    return (
        <div className="w-full">
            <Alert className={`w-full border-2 ${classes.border} ${classes.bg} px-3 py-3 sm:py-4`}>
                <AlertTitle className={`flex items-center gap-2 text-base font-semibold ${classes.text}`}>
                    <Icon className={`h-5 w-5 min-w-5 ${classes.icon}`} aria-label="Status" />
                    {label}
                </AlertTitle>
                <AlertDescription className={`mt-2 w-full text-sm ${classes.description}`}>{description}</AlertDescription>
            </Alert>
        </div>
    );
}
