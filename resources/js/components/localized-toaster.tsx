import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

export default function LocalizedToaster() {
    const { t } = useTranslation('global/notification');
    const { t: tCommon } = useTranslation('global/common');

    return (
        <Toaster
            position="bottom-right"
            closeButton
            offset={24}
            mobileOffset={16}
            containerAriaLabel={t('header.title')}
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': '1rem',
                    fontFamily: 'var(--font-sans)',
                } as CSSProperties
            }
            toastOptions={{
                closeButtonAriaLabel: tCommon('common.close'),
                classNames: {
                    toast: 'items-center! gap-3! p-4! text-sm! shadow-xl! shadow-black/8! dark:shadow-black/30!',
                    icon: 'm-0! size-9! shrink-0 justify-center! rounded-xl [&>svg]:m-0! [&>svg]:size-[18px]!',
                    content: 'gap-1!',
                    title: 'font-semibold leading-5 tracking-tight',
                    description: 'text-[13px]! leading-5! text-muted-foreground!',
                    success:
                        '[&_[data-icon]]:bg-emerald-50 [&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:bg-emerald-400/10 dark:[&_[data-icon]]:text-emerald-400',
                    error: '[&_[data-icon]]:bg-red-50 [&_[data-icon]]:text-red-600 dark:[&_[data-icon]]:bg-red-400/10 dark:[&_[data-icon]]:text-red-400',
                    warning:
                        '[&_[data-icon]]:bg-amber-50 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:bg-amber-400/10 dark:[&_[data-icon]]:text-amber-400',
                    info: '[&_[data-icon]]:bg-blue-50 [&_[data-icon]]:text-blue-600 dark:[&_[data-icon]]:bg-blue-400/10 dark:[&_[data-icon]]:text-blue-400',
                    closeButton:
                        'static! order-last size-7! shrink-0 translate-none! rounded-lg! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [transform:none]!',
                },
            }}
        />
    );
}
