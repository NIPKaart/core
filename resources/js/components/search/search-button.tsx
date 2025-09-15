import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchHotkey } from '@/hooks/use-search-hotkey';
import { cn } from '@/lib/utils';
import { Search as SearchIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { JSX } from 'react/jsx-runtime';
import { openSearch } from './search-store';

type Props = Readonly<
    {
        variant?: 'icon' | 'bar';
        placeholder?: string;
        tooltip?: string;
        className?: string;
    } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>
>;

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

export default function SearchButton({ variant = 'icon', placeholder = 'Search…', tooltip = 'Search', className, ...rest }: Props): JSX.Element {
    useSearchHotkey();

    if (variant === 'bar') {
        return (
            <button
                type="button"
                onClick={openSearch}
                aria-label="Open search"
                className={cn(
                    'group hidden h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-left text-sm text-muted-foreground',
                    'transition hover:bg-muted/50 focus:ring-2 focus:ring-ring focus:outline-none md:flex',
                    className,
                )}
                {...rest}
            >
                <SearchIcon className="h-4 w-4 opacity-70" aria-hidden="true" />
                <span className="flex-1 truncate">{placeholder}</span>
                <kbd className="pointer-events-none hidden items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline-flex">
                    <span className="font-sans">{isMac() ? '⌘' : 'Ctrl'}</span> K
                </kbd>
            </button>
        );
    }

    const IconButton = (
        <Button
            variant="ghost"
            size="icon"
            aria-label={tooltip}
            onClick={openSearch}
            className={cn('cursor-pointer rounded-full hover:bg-muted', className)}
            {...rest}
        >
            <SearchIcon className="h-5 w-5" aria-hidden />
        </Button>
    );

    return tooltip ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{IconButton}</TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : (
        IconButton
    );
}
