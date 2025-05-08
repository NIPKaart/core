import { useAppearance } from '@/hooks/use-appearance';
import { Laptop, Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
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
        dark: <Moon className="h-5 w-5" />,
        system: <Laptop className="h-5 w-5" />,
    };

    const label = {
        light: 'Light mode',
        dark: 'Dark mode',
        system: 'System mode',
    };

    return (
        <button
            onClick={toggle}
            title={label[appearance]}
            aria-label={`Schakel thema (${label[appearance]})`}
            className="cursor-pointer rounded-full p-2 transition hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
            {icon[appearance]}
        </button>
    );
}
