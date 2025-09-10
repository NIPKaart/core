import { Link } from '@inertiajs/react';
import React from 'react';

export type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;
export type FeatureCardProps = {
    icon: IconType;
    title: string;
    desc: string;
    cta: { href: string; label: string };
    className?: string;
    variant?: 'default' | 'subtle';
};

function FeatureCardBase({ icon: Icon, title, desc, cta, className = '', variant = 'default' }: FeatureCardProps) {
    const base = 'group relative overflow-hidden rounded-2xl border p-6 transition-shadow hover:shadow';
    const variants = {
        default: 'border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        subtle: 'border-transparent bg-gray-50 dark:bg-neutral-900/60',
    };

    return (
        <div className={`${base} ${variants[variant]} ${className}`}>
            <div className="mb-3 flex items-center gap-3">
                <div className="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-neutral-800/80 dark:text-orange-400">
                    <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h4>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300">{desc}</p>

            <div className="mt-4">
                <Link href={cta.href} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-500">
                    {cta.label}
                    <span aria-hidden>→</span>
                </Link>
            </div>

            <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-orange-100 opacity-60 blur-2xl dark:bg-orange-400/20" />
        </div>
    );
}

const FeatureCard = React.memo(FeatureCardBase);
export default FeatureCard;
