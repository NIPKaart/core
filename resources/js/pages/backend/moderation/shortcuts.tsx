import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** A key as it appears on a button or in the shortcut bar. */
export function Kbd({ children, inverted = false, className, ...props }: React.ComponentProps<'kbd'> & { inverted?: boolean }) {
    return (
        <kbd
            {...props}
            className={cn(
                'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border px-[5px] font-sans text-[11px] font-medium',
                inverted ? 'border-white/20 bg-white/[0.14] text-neutral-300' : 'border-border bg-muted text-muted-foreground',
                className,
            )}
        >
            {children}
        </kbd>
    );
}

/**
 * Single-key shortcuts for working through the queue. Ignored while typing, with a modifier held, or while a dialog
 * or popover holds focus, so they never interfere with forms.
 */
export function useShortcuts(handlers: Record<string, (() => void) | null | undefined | false>) {
    const current = useRef(handlers);
    current.current = handlers;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [data-radix-popper-content-wrapper]')) return;
            // Enter and Space belong to the focused control, never to a page shortcut.
            if ((event.key === 'Enter' || event.key === ' ') && target?.closest('button, a, [role="button"], [role="checkbox"], [role="tab"]'))
                return;
            const handler = current.current[event.key.length === 1 ? event.key.toLowerCase() : event.key];
            if (!handler) return;
            event.preventDefault();
            handler();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
}

/** Every shortcut on one card, opened with "?". */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { t } = useTranslation('backend/moderation');
    const rows: [string[], string][] = [
        [['J'], t('shortcuts.next')],
        [['K'], t('shortcuts.previous')],
        [['↵'], t('shortcuts.open')],
        [['X'], t('shortcuts.select')],
        [['A'], t('shortcuts.approve')],
        [['R'], t('shortcuts.reject')],
        [['L'], t('shortcuts.keep')],
        [['V'], t('shortcuts.remove')],
        [['Esc'], t('shortcuts.close')],
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{t('shortcuts.title')}</DialogTitle>
                    <DialogDescription>{t('shortcuts.description')}</DialogDescription>
                </DialogHeader>
                <dl className="divide-y text-sm">
                    {rows.map(([keys, label]) => (
                        <div key={label} className="flex items-center justify-between py-2">
                            <dt>{label}</dt>
                            <dd className="flex gap-1">
                                {keys.map((key) => (
                                    <Kbd key={key}>{key}</Kbd>
                                ))}
                            </dd>
                        </div>
                    ))}
                </dl>
            </DialogContent>
        </Dialog>
    );
}
