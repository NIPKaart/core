import { useTranslation } from 'react-i18next';

export default function MunicipalDateTime({ value }: { value: string }) {
    const { t, i18n } = useTranslation('backend/municipal-imports');
    const language = i18n.resolvedLanguage ?? i18n.language;
    const locale = language.startsWith('en') ? 'en-GB' : language;
    const date = new Date(value);

    return (
        <time dateTime={value}>
            {t('date_time', {
                date: date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
                time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
            })}
        </time>
    );
}
