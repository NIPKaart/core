import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchHotkey } from '@/hooks/use-search-hotkey';
import { cn } from '@/lib/utils';
import { Search as SearchIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { JSX } from 'react/jsx-runtime';
import { openSearch } from './search-store';

type Props = Readonly<
    {
        variant?: 'icon' | 'bar' | 'responsive';
        placeholder?: string;
        tooltip?: string;
        className?: string;
    } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>;

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

export default function SearchButton({ variant = 'icon', placeholder, tooltip, className, ...rest }: Props): JSX.Element {
    const { t } = useTranslation('global/search');
    const searchLabel = tooltip ?? t('title');
    const searchPlaceholder = placeholder ?? t('placeholder');
    useSearchHotkey();

    if (variant === 'bar' || variant === 'responsive') {
        return (
            <button
                type="button"
                onClick={openSearch}
                aria-label={searchLabel}
                className={cn(
                    'group h-9 items-center gap-2 rounded-md text-left text-sm text-muted-foreground',
                    variant === 'responsive'
                        ? 'flex w-9 justify-center lg:w-64 lg:justify-start lg:border lg:px-3'
                        : 'hidden w-full max-w-md border px-3 md:flex',
                    'transition hover:bg-muted/50 focus:ring-2 focus:ring-ring focus:outline-none md:flex',
                    className,
                )}
                {...rest}
            >
                <SearchIcon className="h-4 w-4 opacity-70" aria-hidden="true" />
                <span className={cn('flex-1 truncate', variant === 'responsive' && 'hidden lg:block')}>{searchPlaceholder}</span>
                <kbd className="pointer-events-none hidden items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium lg:inline-flex">
                    <span className="font-sans">{isMac() ? '⌘' : 'Ctrl'}</span> K
                </kbd>
            </button>
        );
    }

    const IconButton = (
        <Button
            variant="ghost"
            size="icon"
            aria-label={searchLabel}
            onClick={openSearch}
            className={cn('cursor-pointer rounded-full hover:bg-muted', className)}
            {...rest}
        >
            <SearchIcon className="h-5 w-5" aria-hidden />
        </Button>
    );

    return searchLabel ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{IconButton}</TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                    {searchLabel}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : (
        IconButton
    );
}
