import { SearchableSelect } from '@/components/form/searchable-select';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Country } from '@/types';
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
    isEdit?: boolean;
    onSubmit: () => void;
    submitting: boolean;
};

export default function ParkingRuleForm({ form, countries, municipalities, isEdit = false, onSubmit, submitting }: Props) {
    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="w-full max-w-2xl space-y-10">
                {/* === Country + Municipality === */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Country */}
                    <FormField
                        control={form.control}
                        name="country_id"
                        render={({ field }) => (
                            <SearchableSelect
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
                            <SearchableSelect
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

                {/* === URL === */}
                <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                                <Input placeholder="https://example.com" {...field} />
                            </FormControl>
                            <FormDescription>A direct link to the official parking rule source or document.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* === Nationwide === */}
                <FormField
                    control={form.control}
                    name="nationwide"
                    render={({ field }) => (
                        <FormItem className="flex items-center gap-4">
                            <FormLabel className="m-0">Nationwide?</FormLabel>
                            <FormControl>
                                <Switch className="cursor-pointer" checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormDescription>Enable if the rule applies across the entire country.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* === Submit === */}
                <div className="pt-4">
                    <Button className="cursor-pointer" type="submit" disabled={submitting}>
                        {isEdit ? 'Update Parking Rule' : 'Add Parking Rule'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
