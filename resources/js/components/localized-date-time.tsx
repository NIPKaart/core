import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export default function LocalizedDateTime({ value, dateOnly = false, children }: { value: string; dateOnly?: boolean; children?: ReactNode }) {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    const locale = language.startsWith('en') ? 'en-GB' : language;
    const date = new Date(value);
    const text = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(!dateOnly && { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }),
    }).format(date);

    return (
        <time dateTime={value} title={children ? text : undefined}>
            {children ?? text}
        </time>
    );
}
