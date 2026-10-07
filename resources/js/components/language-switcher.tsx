import locale from '@/routes/locale';
import type { SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Globe } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

export default function LanguageSwitcher() {
    const { t } = useTranslation('global/common');
    const { locale: selected, localization } = usePage<SharedData>().props;
    const pending = useRef(false);
    const [processing, setProcessing] = useState(false);

    const handleChange = (code: string) => {
        if (pending.current || code === selected) return;
        pending.current = true;
        setProcessing(true);
        router.patch(
            locale.update(),
            { locale: code },
            {
                onFinish: () => {
                    pending.current = false;
                    setProcessing(false);
                },
            },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    disabled={processing}
                    aria-busy={processing}
                    className="flex cursor-pointer items-center gap-2"
                    aria-label={t('common.language')}
                >
                    <Globe className="h-4 w-4" />
                    <span>{selected.toUpperCase()}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {localization.available.map((language) => (
                    <DropdownMenuItem
                        key={language.code}
                        disabled={processing}
                        onSelect={() => handleChange(language.code)}
                        className={language.code === selected ? 'cursor-pointer font-bold' : 'cursor-pointer'}
                    >
                        {language.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
