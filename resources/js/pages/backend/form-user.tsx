import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Role } from '@/types';
import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    name: string;
    email: string;
    password?: string;
    password_confirmation?: string;
    role: string;
};

type UserFormProps = {
    roles: Role[];
    action: string;
    method?: 'post' | 'put' | 'patch';
    initial?: Partial<FormValues>;
    isEdit?: boolean;
    onSuccess?: (args: any) => void;
};

export default function UserForm({ roles, action, method = 'post', initial, isEdit = false, onSuccess }: UserFormProps) {
    const { t } = useTranslation('backend/users');
    const [roleValue, setRoleValue] = useState<string>(initial?.role ?? roles[0]?.name ?? '');

    return (
        <Form method={method} action={action} options={{ preserveScroll: true }} onSuccess={onSuccess} className="space-y-10">
            {({ errors, processing }) => (
                <>
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold tracking-tight">{t('form.account_info')}</h2>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium">{t('form.name')}</label>
                                <Input name="name" placeholder="John Doe" defaultValue={initial?.name ?? ''} disabled={processing} />
                                <InputError className="mt-2" message={errors.name} />
                            </div>

                            <div>
                                <label className="text-sm font-medium">{t('form.email')}</label>
                                <Input
                                    name="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    defaultValue={initial?.email ?? ''}
                                    disabled={processing}
                                />
                                <InputError className="mt-2" message={errors.email} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold tracking-tight">{isEdit ? t('form.password_optional') : t('form.password')}</h2>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium">{t('form.password')}</label>
                                <Input name="password" type="password" placeholder="••••••••" autoComplete="new-password" disabled={processing} />
                                <InputError className="mt-2" message={errors.password} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">{t('form.confirm_password')}</label>
                                <Input
                                    name="password_confirmation"
                                    type="password"
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    disabled={processing}
                                />
                                <InputError className="mt-2" message={errors.password_confirmation} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold tracking-tight">{t('form.role')}</h2>
                        <div className="sm:w-[300px]">
                            <label className="text-sm font-medium">{t('form.assign_role')}</label>
                            <Select value={roleValue} onValueChange={setRoleValue} disabled={processing}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('form.select_role')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.name} value={role.name}>
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <input type="hidden" name="role" value={roleValue} />
                            <InputError className="mt-2" message={errors.role} />
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button className="cursor-pointer" type="submit" disabled={processing}>
                            {isEdit ? t('form.actions.update') : t('form.actions.create')}
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
