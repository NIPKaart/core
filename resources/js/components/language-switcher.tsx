import { useSyncLocale } from '@/hooks/use-sync-locale';
import type { SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'nl', label: 'NL' },
];

export default function LanguageSwitcher() {
    const { auth, locale: backendLocale } = usePage<SharedData>().props;
    const [selected, setSelected] = useState<string>(backendLocale);

    useSyncLocale();

    useEffect(() => {
        setSelected(backendLocale);
    }, [backendLocale]);

    const handleChange = async (newLocale: string) => {
        setSelected(newLocale);

        if (auth?.user) {
            // 👤 Logged in user → update in database
            router.patch(
                route('locale.update'),
                { locale: newLocale },
                {
                    onSuccess: () => router.reload(),
                },
            );
        } else {
            // 🙍 Guest user → set cookie and reload
            document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
            router.reload();
        }
    };

    const currentLang = LANGUAGES.find((lang) => lang.code === selected);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex cursor-pointer items-center gap-2" aria-label="Language switcher">
                    <Globe className="h-4 w-4" />
                    <span className="sm:inline">{currentLang?.label}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onSelect={() => handleChange(lang.code)}
                        className={clsx('cursor-pointer', {
                            'font-bold': selected === lang.code,
                        })}
                    >
                        {lang.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
