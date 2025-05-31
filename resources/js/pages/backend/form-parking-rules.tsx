import { SwitchCard } from '@/components/card-switch';
import { SearchableCombobox } from '@/components/forms/searchable-combobox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { Country } from '@/types';
import { UseFormReturn } from 'react-hook-form';

export type FormValues = {
    country_id: string;
    municipality: string;
    url: string;
    nationwide: boolean;
};

type Props = {
    form: UseFormReturn<FormValues>;
    countries: Country[];
    municipalities: string[];
    onSubmit: () => void;
};

export default function ParkingRuleForm({ form, countries, municipalities, onSubmit }: Props) {
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
                                label="Country"
                                placeholder="Select a country"
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
                        name="municipality"
                        render={({ field }) => (
                            <SearchableCombobox
                                label="Municipality"
                                placeholder="Select a municipality"
                                options={municipalities.map((m) => ({
                                    label: m,
                                    value: m,
                                }))}
                                value={field.value}
                                onChange={field.onChange}
                                error={form.formState.errors.municipality?.message}
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
                                <FormLabel>Official Rule URL</FormLabel>
                                <FormControl>
                                    <Input placeholder="https://example.com" {...field} />
                                </FormControl>
                                <FormDescription>Direct link to the official parking rule source or document.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Separator />

                <div className="space-y-6">
                    <h2 className="text-foreground/80 mb-2 text-base font-semibold tracking-tight">Scope</h2>
                    <FormField
                        control={form.control}
                        name="nationwide"
                        render={() => (
                            <FormItem>
                                <SwitchCard
                                    name="nationwide"
                                    control={form.control}
                                    label="Nationwide"
                                    description="Check if this rule applies to the entire country."
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
