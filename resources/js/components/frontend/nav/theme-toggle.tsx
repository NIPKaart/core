import { useAppearance } from '@/hooks/use-appearance';
import { Contrast, MoonStar, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
    const { t } = useTranslation('frontend/navbar');
    const { appearance, updateAppearance } = useAppearance();

    const next = (mode: typeof appearance): typeof appearance => {
        switch (mode) {
            case 'light':
                return 'dark';
            case 'dark':
                return 'system';
            case 'system':
                return 'light';
        }
    };

    const toggle = () => {
        updateAppearance(next(appearance));
    };

    const icon = {
        light: <Sun className="h-5 w-5" />,
        dark: <MoonStar className="h-5 w-5" />,
        system: <Contrast className="h-5 w-5" />,
    };

    const label = t(`theme.${appearance}`);

    return (
        <button
            onClick={toggle}
            title={label}
            aria-label={t('theme.toggle', { mode: label })}
            className="cursor-pointer rounded-full p-2 transition hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
            {icon[appearance]}
        </button>
    );
}
