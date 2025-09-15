import { cn } from '@/lib/utils';
import { Search as SearchIcon } from 'lucide-react';
import { useEffect, useRef, type FormEvent } from 'react';
import { JSX } from 'react/jsx-runtime';
import { setSearchQuery, useSearchQuery } from './search-store';

export type AdminSearchBarProps = Readonly<{
    className?: string;
    placeholder?: string;
}>;

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

export default function SearchBar({ className, placeholder = 'Search…' }: AdminSearchBarProps): JSX.Element {
    const q = useSearchQuery();
    const inputRef = useRef<HTMLInputElement>(null);

    // ⌘K / Ctrl+K -> focus search input
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key.toLowerCase() !== 'k') return;
            if ((isMac() && e.metaKey) || (!isMac() && e.ctrlKey)) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const onSubmit = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const value = inputRef.current?.value?.trim() ?? '';
        if (!value) return;
        window.location.href = `/search?q=${encodeURIComponent(value)}`;
    };

    return (
        <form role="search" aria-label="Site search" onSubmit={onSubmit} className={cn('relative hidden md:block', className)}>
            {/* Icon left */}
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-70" aria-hidden="true" />

            <input
                ref={inputRef}
                type="search"
                inputMode="search"
                name="q"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                placeholder={placeholder}
                className={cn(
                    'h-9 w-full rounded-md border bg-background pr-16 pl-9 text-sm',
                    'ring-offset-background transition outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring',
                    '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
                )}
                value={q}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* ⌘K / Ctrl+K hint */}
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline-flex">
                <span className="font-sans">{isMac() ? '⌘' : 'Ctrl'}</span> K
            </kbd>
        </form>
    );
}
