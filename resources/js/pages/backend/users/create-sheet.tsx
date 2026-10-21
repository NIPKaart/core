import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import app from '@/routes/app';
import type { Role } from '@/types';
import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

type Props = { open: boolean; roles: Role[]; onClose: () => void };

export function CreateUserSheet({ open, roles, onClose }: Props) {
    const { t } = useTranslation('backend/users');
    const form = useForm({ name: '', email: '', password: '', password_confirmation: '', role: '' });
    const close = () => {
        if (!form.processing) onClose();
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.submit(app.users.store(), { preserveScroll: true });
    };

    return (
        <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
            <SheetContent className="w-full gap-0 p-0 sm:max-w-[42rem]" showCloseButton={false}>
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <SheetHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b p-6">
                        <div className="space-y-2">
                            <SheetTitle className="text-xl">{t('head.create')}</SheetTitle>
                            <SheetDescription>{t('sheet.description')}</SheetDescription>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={close} disabled={form.processing} aria-label={t('sheet.cancel')}>
                            <X className="size-4" aria-hidden />
                        </Button>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
                        <fieldset className="space-y-5" disabled={form.processing}>
                            <legend className="mb-5 text-sm font-semibold">{t('form.account_info')}</legend>
                            <div className="space-y-2">
                                <Label htmlFor="create-user-name">{t('form.name')}</Label>
                                <Input
                                    id="create-user-name"
                                    name="name"
                                    autoComplete="name"
                                    value={form.data.name}
                                    onChange={(event) => form.setData('name', event.target.value)}
                                    required
                                    maxLength={255}
                                    aria-invalid={!!form.errors.name}
                                    aria-describedby={form.errors.name ? 'create-user-name-error' : undefined}
                                />
                                <InputError id="create-user-name-error" message={form.errors.name} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create-user-email">{t('form.email')}</Label>
                                <Input
                                    id="create-user-email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={form.data.email}
                                    onChange={(event) => form.setData('email', event.target.value)}
                                    required
                                    aria-invalid={!!form.errors.email}
                                    aria-describedby={form.errors.email ? 'create-user-email-error' : undefined}
                                />
                                <InputError id="create-user-email-error" message={form.errors.email} />
                            </div>
                        </fieldset>
                        <div role="separator" className="border-t" />
                        <fieldset className="space-y-5" disabled={form.processing}>
                            <legend className="mb-5 text-sm font-semibold">{t('sheet.access')}</legend>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="create-user-password">{t('form.password')}</Label>
                                    <Input
                                        id="create-user-password"
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        value={form.data.password}
                                        onChange={(event) => form.setData('password', event.target.value)}
                                        required
                                        aria-invalid={!!form.errors.password}
                                        aria-describedby={form.errors.password ? 'create-user-password-error' : undefined}
                                    />
                                    <InputError id="create-user-password-error" message={form.errors.password} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="create-user-password-confirmation">{t('form.confirm_password')}</Label>
                                    <Input
                                        id="create-user-password-confirmation"
                                        name="password_confirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        value={form.data.password_confirmation}
                                        onChange={(event) => form.setData('password_confirmation', event.target.value)}
                                        required
                                        aria-invalid={!!form.errors.password_confirmation}
                                        aria-describedby={form.errors.password_confirmation ? 'create-user-password-confirmation-error' : undefined}
                                    />
                                    <InputError id="create-user-password-confirmation-error" message={form.errors.password_confirmation} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create-user-role">{t('form.role')}</Label>
                                <Select value={form.data.role} onValueChange={(value) => form.setData('role', value)} disabled={form.processing}>
                                    <SelectTrigger
                                        id="create-user-role"
                                        className="w-full"
                                        aria-invalid={!!form.errors.role}
                                        aria-describedby={form.errors.role ? 'create-user-role-error' : undefined}
                                    >
                                        <SelectValue placeholder={t('form.select_role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.name}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError id="create-user-role-error" message={form.errors.role} />
                            </div>
                        </fieldset>
                    </div>
                    <SheetFooter className="shrink-0 flex-row justify-end border-t p-4 sm:px-6">
                        <Button type="button" variant="outline" onClick={close} disabled={form.processing}>
                            {t('sheet.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {t(form.processing ? 'sheet.creating' : 'sheet.create')}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
