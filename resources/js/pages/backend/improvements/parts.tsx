import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, nl } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

export type Proposer = { name: string | null; approved: number; rejected: number; is_new: boolean };

export function Flag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {children}
        </span>
    );
}

/** The proposer's name, with a short note only when their track record stands out. */
export function ProposerName({ proposer }: { proposer: Proposer }) {
    const { t } = useTranslation('backend/improvements');
    const note =
        proposer.rejected > proposer.approved && proposer.rejected > 0
            ? t('proposer.rejected', { count: proposer.rejected })
            : proposer.is_new
              ? t('proposer.new')
              : null;

    return (
        <span>
            {proposer.name ?? t('unknown_user')}
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
