import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

/** What is known about the person behind a submission or improvement; context only, never priority. */
export type Contributor = { name: string | null; approved: number; rejected: number; is_new: boolean };

export function Flag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {children}
        </span>
    );
}

/** The contributor's name, with a short note only when their track record stands out. */
export function ContributorName({ contributor }: { contributor: Contributor }) {
    const { t } = useTranslation('backend/moderation');
    const note =
        contributor.rejected > contributor.approved && contributor.rejected > 0
            ? t('contributor.rejected', { count: contributor.rejected })
            : contributor.is_new
              ? t('contributor.new')
              : null;

    return (
        <span>
            {contributor.name ?? t('unknown_user')}
            {note && <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">{note}</span>}
        </span>
    );
}

/** Relative time in the interface language, e.g. "3 dagen geleden". */
export function useAgo() {
    const { i18n } = useTranslation();
    const locale = i18n.language.startsWith('nl') ? nl : enUS;

    return (value: string) => formatDistanceToNow(parseISO(value), { addSuffix: true, locale });
}
