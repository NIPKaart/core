import { SearchableCombobox } from '@/components/forms/searchable-combobox';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { Country, Municipality } from '@/types';
import { Form } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    country_id: string;
    municipality_id: string;
    url: string;
    nationwide: boolean;
};

type Props = {
    action: string;
    method?: 'post' | 'patch' | 'put';
    countries: Country[];
    municipalities: Municipality[];
    initial?: Partial<FormValues>;
    onSuccess?: Parameters<typeof Form>[0]['onSuccess'];
};

export default function ParkingRuleForm({ action, method = 'post', countries, municipalities, initial, onSuccess }: Props) {
    const { t } = useTranslation('backend/parking-rules');

    const [countryId, setCountryId] = useState<string>(initial?.country_id ?? '');
    const [municipalityId, setMunicipalityId] = useState<string>(initial?.municipality_id ?? '');
    const [nationwide, setNationwide] = useState<boolean>(Boolean(initial?.nationwide));

    useEffect(() => {
        if (nationwide) setMunicipalityId('');
    }, [nationwide]);

    const countryOptions = useMemo(
        () =>
            countries.map((c) => ({
                label: `${c.name} (${c.code})`,
                value: String(c.id),
            })),
        [countries],
    );

    const municipalityOptions = useMemo(
        () => municipalities.map((m) => (typeof m === 'string' ? { label: m, value: m } : { label: m.name, value: String(m.id) })),
        [municipalities],
    );

    return (
        <Form
            id="parking-rule-form"
            method={method}
            action={action}
            options={{ preserveScroll: true }}
            onSuccess={onSuccess}
            className="flex flex-col gap-0 space-y-6"
            autoComplete="on"
        >
            {({ errors }) => (
                <>
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <SearchableCombobox
                                label={t('form.country.label')}
                                placeholder={t('form.country.placeholder')}
                                options={countryOptions}
                                value={countryId}
                                onChange={setCountryId}
                                error={errors.country_id}
                            />
                            <input type="hidden" name="country_id" value={countryId} />
                        </div>

                        <div className="grid gap-2">
                            <SearchableCombobox
                                label={t('form.municipality.label')}
                                placeholder={t('form.municipality.placeholder')}
                                options={municipalityOptions}
                                value={municipalityId}
                                onChange={setMunicipalityId}
                                error={errors.municipality_id}
                                disabled={nationwide}
                            />
                            <input type="hidden" name="municipality_id" value={municipalityId} />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="url">{t('form.url.label')}</Label>
                            <Input id="url" name="url" placeholder="https://example.com" defaultValue={initial?.url ?? ''} autoComplete="url" />
                            <p className="text-sm text-muted-foreground">{t('form.url.description')}</p>
                            <InputError className="mt-2" message={errors.url} />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h2 className="text-base font-semibold tracking-tight text-foreground/80">{t('form.scope.title')}</h2>

                        <div className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="font-medium">{t('form.scope.label')}</div>
                                    <p className="text-sm text-muted-foreground">{t('form.scope.description')}</p>
                                </div>
                                <Switch checked={nationwide} onCheckedChange={setNationwide} aria-label={t('form.scope.label')} />
                            </div>
                        </div>

                        <input type="hidden" name="nationwide" value={nationwide ? '1' : '0'} />
                        <InputError message={errors.nationwide} />
                    </div>
                </>
            )}
        </Form>
    );
}
