import { SwitchCard } from '@/components/card-switch';
import { SearchableCombobox } from '@/components/forms/searchable-combobox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { Country, Municipality } from '@/types';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    country_id: string;
    municipality_id: string;
    url: string;
    nationwide: boolean;
};

type Props = {
    form: UseFormReturn<FormValues>;
    countries: Country[];
    municipalities: Municipality[];
    onSubmit: () => void;
};

export default function ParkingRuleForm({ form, countries, municipalities, onSubmit }: Props) {
    const { t } = useTranslation('backend/parking-rules');

    return (
        <Form {...form}>
            <form id="parking-rule-form" onSubmit={onSubmit} className="flex flex-col gap-0 space-y-6" autoComplete="on">
                <div className="space-y-6">
                    {/* Country */}
                    <FormField
                        control={form.control}
                        name="country_id"
                        render={({ field }) => (
                            <SearchableCombobox
                                label={t('form.country.label')}
                                placeholder={t('form.country.placeholder')}
                                options={countries.map((c) => ({
                                    label: `${c.name} (${c.code})`,
                                    value: String(c.id),
                                }))}
                                value={field.value}
                                onChange={field.onChange}
                                error={form.formState.errors.country_id?.message}
                            />
                        )}
                    />

                    {/* Municipality */}
                    <FormField
                        control={form.control}
                        name="municipality_id"
                        render={({ field }) => (
                            <SearchableCombobox
                                label={t('form.municipality.label')}
                                placeholder={t('form.municipality.placeholder')}
                                options={municipalities.map((m) =>
                                    typeof m === 'string' ? { label: m, value: m } : { label: m.name, value: String(m.id) },
                                )}
                                value={field.value}
                                onChange={field.onChange}
                                error={form.formState.errors.municipality_id?.message}
                            />
                        )}
                    />
                </div>

                <Separator />

                <div className="space-y-6">
                    <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('form.url.label')}</FormLabel>
                                <FormControl>
                                    <Input placeholder="https://example.com" {...field} />
                                </FormControl>
                                <FormDescription>{t('form.url.description')}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Separator />

                <div className="space-y-6">
                    <h2 className="mb-2 text-base font-semibold tracking-tight text-foreground/80">{t('form.scope.title')}</h2>
                    <FormField
                        control={form.control}
                        name="nationwide"
                        render={() => (
                            <FormItem>
                                <SwitchCard
                                    name="nationwide"
                                    control={form.control}
                                    label={t('form.scope.label')}
                                    description={t('form.scope.description')}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </form>
        </Form>
    );
}
