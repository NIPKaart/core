import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import type { Claim, Row } from './show';

export default function SourceComparison({ row, onShowMap }: { row: Row; onShowMap: () => void }) {
    const { t } = useTranslation('backend/municipal-imports');
    const both = Boolean(row.before && row.after);
    const sides = (['before', 'after'] as const).filter((side) => row[side]);
    const fields = [
        { key: 'street', label: t('fields.street'), value: (claim: Claim) => claim.street ?? t('unknown') },
        { key: 'number', label: t('capacity'), value: (claim: Claim) => claim.number ?? t('unknown') },
        {
            key: 'source_attributes',
            label: t('comparison_orientation'),
            value: (claim: Claim) => String(claim.source_attributes.orientation ?? t('unknown')),
        },
        {
            key: 'geometry',
            label: t('fields.geometry'),
            value: () => (
                <Button variant="link" className="h-auto p-0 text-left text-sm whitespace-normal" onClick={onShowMap}>
                    {t('comparison_geometry')}
                </Button>
            ),
        },
    ];
    return (
        <div className="space-y-4">
            {!both && row.after && (
                <div className="rounded-lg bg-muted/50 p-4">
                    <p className="font-medium">{t('comparison_new')}</p>
                    <p className="mt-1 text-muted-foreground">{t('comparison_new_hint')}</p>
                </div>
            )}
            <div className="overflow-hidden rounded-lg border">
                <div
                    className={`grid gap-3 bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground ${both ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}
                >
                    <span className={both ? 'hidden sm:block' : ''}>{t('comparison_field')}</span>
                    {sides.map((side) => (
                        <span key={side}>{t(side)}</span>
                    ))}
                </div>
                {fields.map((field) => (
                    <div key={field.label} className={`grid gap-3 border-t px-4 py-3 ${both ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                        <span className={`text-muted-foreground ${both ? 'col-span-2 sm:col-span-1' : ''}`}>{field.label}</span>
                        {sides.map((side) => (
                            <span
                                key={side}
                                className={`min-w-0 break-words ${both && side === 'after' && (field.key === 'geometry' ? row.fields.includes('geometry') : field.value(row.before!) !== field.value(row.after!)) ? 'font-semibold' : ''}`}
                            >
                                {field.value(row[side]!)}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
            <details className="rounded-lg border p-4">
                <summary className="cursor-pointer font-medium">{t('comparison_rules')}</summary>
                <div className={`mt-3 grid gap-4 ${both ? 'sm:grid-cols-2' : ''}`}>
                    {sides.map((side) => (
                        <div key={side} className="min-w-0">
                            {both && <h4 className="mb-2 text-xs text-muted-foreground">{t(side)}</h4>}
                            {Array.isArray(row[side]!.source_attributes.regimes) ? (
                                row[side]!.source_attributes.regimes.map((regime: Record<string, unknown>, index: number) => (
                                    <dl key={index} className="space-y-2 border-b py-3 first:pt-0 last:border-0 last:pb-0">
                                        {Object.entries(regime)
                                            .filter(([, value]) => value !== null && value !== '')
                                            .map(([key, value]) => (
                                                <div key={key} className="grid grid-cols-2 gap-3">
                                                    <dt className="text-muted-foreground">{t(`rule_fields.${key}`, { defaultValue: key })}</dt>
                                                    <dd className="min-w-0 break-words">{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                                                </div>
                                            ))}
                                    </dl>
                                ))
                            ) : (
                                <p>{t('unknown')}</p>
                            )}
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}

export function MissingSourceNotice({ row }: { row: Row }) {
    const { t } = useTranslation('backend/municipal-imports');
    if (row.status !== 'missing') return null;

    const visibility = row.current?.visibility;
    return (
        <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            {t(visibility === true ? 'missing_visible' : visibility === false ? 'missing_hidden' : 'comparison_missing_hint')}
        </p>
    );
}
