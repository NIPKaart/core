import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { translateSourceValue } from '@/utils/translation';
import { useTranslation } from 'react-i18next';
import type { Options } from './types';
import type { ChangeGroup, ImprovementValues } from './values';

/** Inline editing of one change group, with the controls the add flow uses. */
export function GroupEditor({
    group,
    draft,
    update,
    options,
}: {
    group: ChangeGroup;
    draft: ImprovementValues;
    update: (values: Partial<ImprovementValues>) => void;
    options: Pick<Options, 'orientations' | 'underSign' | 'restrictionDays'>;
}) {
    const { t } = useTranslation('backend/moderation');
    const { t: tContribute } = useTranslation('frontend/map/contribute');

    if (group === 'location') {
        return (
            <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                    {(['latitude', 'longitude'] as const).map((field) => (
                        <div key={field} className="grid gap-1">
                            <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                                {translateSourceValue('backend/moderation', `review.${field}`)}
                            </Label>
                            <Input
                                id={`edit-${field}`}
                                type="number"
                                step="0.0000001"
                                value={draft[field]}
                                onChange={(event) => update({ [field]: Number(event.target.value) })}
                            />
                        </div>
                    ))}
                </div>
                <span className="text-xs text-muted-foreground">{t('review.drag_hint')}</span>
            </div>
        );
    }

    if (group === 'orientation') {
        return (
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draft.orientation ?? ''}
                onValueChange={(value) => value && update({ orientation: value })}
                className="justify-start"
            >
                {options.orientations.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        );
    }

    if (group === 'description') {
        return (
            <Textarea
                rows={3}
                maxLength={500}
                value={draft.description ?? ''}
                onChange={(event) => update({ description: event.target.value || null })}
            />
        );
    }

    const minutes = draft.parking_time ?? 0;

    return (
        <div className="grid gap-3">
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={draft.under_sign ?? ''}
                onValueChange={(value) => value && update({ under_sign: value as 'yes' | 'no' })}
                className="justify-start"
            >
                {options.underSign.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {draft.under_sign === 'yes' && (
                <>
                    <Input
                        aria-label={tContribute('details.under_sign.text_label')}
                        placeholder={tContribute('details.under_sign.text_placeholder')}
                        maxLength={255}
                        value={draft.under_sign_text ?? ''}
                        onChange={(event) => update({ under_sign_text: event.target.value || null })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        {(['hours', 'minutes'] as const).map((unit) => (
                            <div key={unit} className="grid gap-1">
                                <Label htmlFor={`edit-${unit}`} className="text-xs text-muted-foreground">
                                    {translateSourceValue('frontend/map/contribute', `details.under_sign.${unit}`)}
                                </Label>
                                <Input
                                    id={`edit-${unit}`}
                                    type="number"
                                    min={0}
                                    max={unit === 'hours' ? 24 : 59}
                                    value={unit === 'hours' ? Math.floor(minutes / 60) || '' : minutes % 60 || ''}
                                    onChange={(event) => {
                                        const value = Number(event.target.value || 0);
                                        const total = unit === 'hours' ? value * 60 + (minutes % 60) : Math.floor(minutes / 60) * 60 + value;
                                        update({ parking_time: total || null });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <ToggleGroup
                        type="multiple"
                        variant="outline"
                        size="sm"
                        value={draft.restriction_days ?? []}
                        onValueChange={(days) => update({ restriction_days: days.length ? days : null })}
                        aria-label={tContribute('details.under_sign.applies')}
                        className="justify-start"
                    >
                        {options.restrictionDays.map((day) => (
                            <ToggleGroupItem key={day} value={day}>
                                {translateSourceValue('frontend/map/contribute', `days.${day}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <div className="grid grid-cols-2 gap-2">
                        {(['restriction_starts_at', 'restriction_ends_at'] as const).map((field) => (
                            <div key={field} className="grid gap-1">
                                <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                                    {translateSourceValue(
                                        'frontend/map/contribute',
                                        `details.under_sign.${field === 'restriction_starts_at' ? 'from' : 'until'}`,
                                    )}
                                </Label>
                                <Input
                                    id={`edit-${field}`}
                                    type="time"
                                    value={draft[field] ?? ''}
                                    onChange={(event) => update({ [field]: event.target.value || null })}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
