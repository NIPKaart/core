import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Copy, FileText, HelpCircle, Landmark, MapPinned, ParkingSquare, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export type ParkingSource = 'community' | 'municipal' | 'offstreet';

/** Orange source icon shown in the header and hero block, matching the pre-unification visual language. */
export function SourceIcon({ source, className = 'h-6 w-6' }: { source: ParkingSource; className?: string }) {
    const shared = `${className} shrink-0 text-orange-400`;
    if (source === 'municipal') return <Landmark className={shared} aria-hidden />;
    if (source === 'offstreet') return <ParkingSquare className={shared} aria-hidden />;
    return <MapPinned className={shared} aria-hidden />;
}

/** Green "confirmed by the community" pill. Renders nothing when there is nothing to celebrate yet. */
export function ConfirmedBadge({ count, label }: { count: number; label: string }) {
    if (!count || count <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 shadow-sm dark:border-green-900 dark:bg-green-950/80 dark:text-green-300">
            <Users className="h-4 w-4 text-green-600 dark:text-green-300" aria-hidden />
            {label}
        </span>
    );
}

/** Small colored chip used for facility type / API status labels. */
export function Chip({ tone = 'zinc', children }: { tone?: 'zinc' | 'blue' | 'green' | 'red'; children: ReactNode }) {
    const tones: Record<string, string> = {
        zinc: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
        blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Orange-accented contributor description card, restored from the old community modal's description tab. */
export function CommunityDescriptionCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="relative rounded-xl border border-orange-100 bg-orange-50/70 px-6 py-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/60">
            <div className="absolute top-0 left-0 h-full w-1 rounded-l-xl bg-orange-400" aria-hidden />
            <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" aria-hidden />
                <div>
                    <div className="mb-1 text-base font-semibold text-orange-800 dark:text-orange-200">{title}</div>
                    <div className="text-sm text-orange-900 dark:text-orange-100">{description}</div>
                </div>
            </div>
        </div>
    );
}

/** Popover with supplementary explanation, used for the parking-disc hint and the orientation description. */
export function HelpPopover({ content, label }: { content: ReactNode; label: string }) {
    if (!content) return null;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="cursor-help rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={label}
                >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="max-w-[240px] text-sm text-muted-foreground">
                {content}
            </PopoverContent>
        </Popover>
    );
}

/** Copies a value and confirms it in text for screen readers, like the old location-ID copy button. */
export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() =>
                    navigator.clipboard?.writeText(value).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                    })
                }
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                {copied ? <Check className="h-4 w-4 text-green-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            </button>
            <span role="status" className="sr-only">
                {copied ? copiedLabel : ''}
            </span>
        </>
    );
}
