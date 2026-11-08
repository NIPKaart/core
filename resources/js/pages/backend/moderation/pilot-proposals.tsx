import { Button } from '@/components/ui/button';
import { add } from '@/routes/location-map';
import { useTranslation } from 'react-i18next';

export type PilotProposal = {
    street: string;
    reported_bays: number;
    signs: { id: string; latitude: number; longitude: number; last_seen: string }[];
};

export function PilotProposals({ proposals }: { proposals: PilotProposal[] }) {
    const { t } = useTranslation('backend/moderation');

    return (
        <section aria-labelledby="delft-pilot-title" className="flex flex-col gap-2 px-4.5 py-3">
            <h3 id="delft-pilot-title" className="text-sm font-semibold">
                {t('pilot.title')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('pilot.guidance')}</p>
            <ul className="divide-y rounded-md border">
                {proposals.map((proposal) => (
                    <li key={proposal.street}>
                        <details className="px-3 py-2">
                            <summary className="cursor-pointer text-sm font-medium">
                                {proposal.street} · {t('pilot.reported', { count: proposal.reported_bays })}
                            </summary>
                            <ul className="flex flex-col gap-2 pt-2">
                                {proposal.signs.map((sign, index) => (
                                    <li key={sign.id} className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{t('pilot.seen', { date: sign.last_seen })}</span>
                                        <Button asChild variant="outline" size="sm">
                                            <a href={`${add.url()}#19/${sign.latitude}/${sign.longitude}`} target="_blank" rel="noopener">
                                                {t('pilot.add', { number: index + 1 })}
                                            </a>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </li>
                ))}
            </ul>
        </section>
    );
}
