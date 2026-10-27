import { useTranslation } from 'react-i18next';
import type { Import } from './index';

type Props = { delivery: Pick<Import, 'state' | 'superseded' | 'publication_checks'> };

export default function AutomaticPublicationNotice({ delivery }: Props) {
    const { t } = useTranslation('backend/imports');
    if (delivery.state !== 'pending' || delivery.superseded || !delivery.publication_checks?.reasons.length) return null;

    return (
        <section role="status" className="rounded-xl border bg-muted/30 p-5">
            <h2 className="font-semibold">{t('automatic.review_required')}</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {delivery.publication_checks.reasons.map((reason) => (
                    <li key={reason}>
                        {t(`automatic.reasons.${reason}` as 'automatic.reasons.first_publication', {
                            defaultValue: t('automatic.review_required'),
                        })}
                    </li>
                ))}
            </ul>
        </section>
    );
}
