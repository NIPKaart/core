import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import app from '@/routes/app';
import { useForm } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CountrySources, MunicipalityOption } from './index';

export type SheetState =
    | { mode: 'create'; nationwide: boolean; countryId: number | null }
    | { mode: 'edit'; id: number; url: string; nationwide: boolean; name: string }
    | null;

type Props = {
    state: SheetState;
    countries: CountrySources[];
    municipalities?: MunicipalityOption[];
    onClose: () => void;
};

/** Adding or editing one source, with a preview of the single link visitors will see. */
export function RuleSheet({ state, countries, municipalities, onClose }: Props) {
    return (
        <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[30rem]">
                {state?.mode === 'create' && (
                    <CreateForm key="create" initial={state} countries={countries} municipalities={municipalities} onClose={onClose} />
                )}
                {state?.mode === 'edit' && <EditForm key={state.id} rule={state} onClose={onClose} />}
            </SheetContent>
        </Sheet>
    );
}

function CreateForm({
    initial,
    countries,
    municipalities = [],
    onClose,
}: {
    initial: Extract<SheetState, { mode: 'create' }>;
    countries: CountrySources[];
    municipalities?: MunicipalityOption[];
    onClose: () => void;
}) {
    const { t } = useTranslation('backend/parking-rules');
    const form = useForm<{ nationwide: boolean; country_id: number | null; municipality_id: number | null; url: string }>({
        nationwide: initial.nationwide,
        country_id: initial.countryId ?? (countries.length === 1 ? countries[0].id : null),
        municipality_id: null,
        url: '',
    });
    const country = countries.find((option) => option.id === form.data.country_id);
    const municipality = municipalities.find((option) => option.id === form.data.municipality_id);
    const options = municipalities.filter((option) => option.country_id === form.data.country_id);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(app.parkingRules.store(), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b p-6">
                <SheetTitle>{t('sheet.create.title')}</SheetTitle>
                <SheetDescription>{t('sheet.description')}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">{t('sheet.scope.label')}</legend>
                    <div role="radiogroup" className="grid grid-cols-2 gap-2">
                        {[true, false].map((nationwide) => (
                            <label
                                key={String(nationwide)}
                                className={cn(
                                    'flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                    form.data.nationwide === nationwide ? 'border-foreground ring-1 ring-foreground' : 'hover:bg-muted/50',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="scope"
                                    className="sr-only"
                                    checked={form.data.nationwide === nationwide}
                                    onChange={() => form.setData({ ...form.data, nationwide, municipality_id: null })}
                                />
                                <span className="text-sm font-medium">{t(nationwide ? 'sheet.scope.country' : 'sheet.scope.municipality')}</span>
                                <span className="text-xs text-muted-foreground">
                                    {t(nationwide ? 'sheet.scope.country_hint' : 'sheet.scope.municipality_hint')}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="grid gap-2">
                    <Label htmlFor="rule-country">{t('sheet.country')}</Label>
                    <Select
                        value={form.data.country_id ? String(form.data.country_id) : ''}
                        onValueChange={(value) => form.setData({ ...form.data, country_id: Number(value), municipality_id: null })}
                    >
                        <SelectTrigger id="rule-country" className="w-full">
                            <SelectValue placeholder={t('sheet.country_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            {countries.map((option) => (
                                <SelectItem key={option.id} value={String(option.id)} disabled={form.data.nationwide && option.rule !== null}>
                                    {option.name}
                                    {form.data.nationwide && option.rule !== null && (
                                        <span className="text-muted-foreground"> · {t('sheet.has_source')}</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {form.errors.country_id && <p className="text-sm text-destructive">{form.errors.country_id}</p>}
                </div>

                {!form.data.nationwide && (
                    <div className="grid gap-2">
                        <Label>{t('sheet.municipality')}</Label>
                        <Combobox
                            value={form.data.municipality_id ? String(form.data.municipality_id) : ''}
                            onChange={(value) => form.setData('municipality_id', Number(value))}
                            options={options.map((option) => ({
                                value: String(option.id),
                                label: option.province ? `${option.name} · ${option.province}` : option.name,
                            }))}
                            placeholder={t('sheet.municipality_placeholder')}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">{t('sheet.municipality_hint')}</p>
                        {form.errors.municipality_id && <p className="text-sm text-destructive">{form.errors.municipality_id}</p>}
                    </div>
                )}

                <UrlField value={form.data.url} error={form.errors.url} onChange={(url) => form.setData('url', url)} />
                <Preview name={form.data.nationwide ? country?.name : municipality?.name} nationwide={form.data.nationwide} url={form.data.url} />
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t p-4 sm:px-6">
                <Button type="button" variant="ghost" onClick={onClose}>
                    {t('sheet.cancel')}
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {t('sheet.save')}
                </Button>
            </SheetFooter>
        </form>
    );
}

function EditForm({ rule, onClose }: { rule: Extract<SheetState, { mode: 'edit' }>; onClose: () => void }) {
    const { t } = useTranslation('backend/parking-rules');
    const form = useForm({ url: rule.url });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(app.parkingRules.update({ parking_rule: rule.id }), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b p-6">
                <SheetTitle>{t('sheet.edit.title')}</SheetTitle>
                <SheetDescription>{t(rule.nationwide ? 'sheet.edit.country' : 'sheet.edit.municipality', { name: rule.name })}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                <UrlField value={form.data.url} error={form.errors.url} onChange={(url) => form.setData('url', url)} />
                <Preview name={rule.name} nationwide={rule.nationwide} url={form.data.url} />
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t p-4 sm:px-6">
                <Button type="button" variant="ghost" onClick={onClose}>
                    {t('sheet.cancel')}
                </Button>
                <Button type="submit" disabled={form.processing || !form.isDirty}>
                    {t('sheet.save')}
                </Button>
            </SheetFooter>
        </form>
    );
}

function UrlField({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
    const { t } = useTranslation('backend/parking-rules');

    return (
        <div className="grid gap-2">
            <Label htmlFor="rule-url">{t('sheet.url')}</Label>
            <Input id="rule-url" type="url" inputMode="url" placeholder="https://" value={value} onChange={(event) => onChange(event.target.value)} />
            <p className="text-xs text-muted-foreground">{t('sheet.url_hint')}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

/** The one row a visitor sees on a parking space, so the admin knows what they are publishing. */
function Preview({ name, nationwide, url }: { name?: string; nationwide: boolean; url: string }) {
    const { t } = useTranslation('backend/parking-rules');
    const host = hostOf(url);

    return (
        <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('sheet.preview')}</span>
            <div className="flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-sm">
                <span className="text-muted-foreground">{t('sheet.preview_label')}</span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                    {nationwide || name ? (
                        <span className="inline-flex items-center gap-1 font-medium text-orange-700 underline underline-offset-3 dark:text-orange-400">
                            {nationwide ? t('sheet.preview_country') : t('sheet.preview_municipality', { name })}
                            <ExternalLink className="size-3" aria-hidden />
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{t('sheet.preview_pending')}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{[t('sheet.preview_official'), host].filter(Boolean).join(' · ')}</span>
                </span>
            </div>
        </div>
    );
}

export function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}
