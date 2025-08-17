import InputError from '@/components/input-error';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Permission, Role } from '@/types';
import { Form } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type FormValues = {
    name: string;
    permissions: number[];
};

type RoleFormProps = {
    role?: Role;
    allPermissions: Permission[];
    action: string;
    method?: 'post' | 'put' | 'patch';
    initial?: Partial<FormValues>;
    onSuccess?: (args: any) => void;
};

export default function RoleForm({ role, allPermissions, action, method = 'post', initial, onSuccess }: RoleFormProps) {
    const { t } = useTranslation('backend/roles');

    const groupedPermissions = useMemo(
        () =>
            allPermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
                const [resource] = perm.name.includes('.') ? perm.name.split('.') : perm.name.split('_');
                if (!acc[resource]) acc[resource] = [];
                acc[resource].push(perm);
                return acc;
            }, {}),
        [allPermissions],
    );

    const [name, setName] = useState<string>(initial?.name ?? role?.name ?? '');
    const [selected, setSelected] = useState<number[]>(initial?.permissions ?? []);

    function togglePermission(id: number, checked: boolean | 'indeterminate') {
        const c = checked === true;
        setSelected((prev) => (c ? [...prev, id] : prev.filter((x) => x !== id)));
    }

    return (
        <Form method={method} action={action} options={{ preserveScroll: true }} onSuccess={onSuccess} className="space-y-10">
            {({ errors, processing }) => (
                <>
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold">{t('form.name.label')}</h2>
                        <div className="w-full sm:w-[400px]">
                            <Label htmlFor="name">{t('form.name.label')}</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder={t('form.name.placeholder')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={processing}
                            />
                            <InputError className="mt-2" message={errors.name} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">{t('form.permissions.label')}</h2>

                        <div className="w-full sm:w-[500px]">
                            <Accordion type="multiple" className="w-full divide-y rounded-md border">
                                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                                    <AccordionItem key={resource} value={resource}>
                                        <AccordionTrigger className="cursor-pointer px-4 py-2 text-sm font-medium capitalize">
                                            {resource.replace(/[_-]/g, ' ')}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                                                {perms.map((perm) => {
                                                    const isChecked = selected.includes(perm.id);
                                                    const inputId = `perm-${perm.id}`;
                                                    return (
                                                        <div key={perm.id} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={inputId}
                                                                checked={isChecked}
                                                                onCheckedChange={(c) => togglePermission(perm.id, c)}
                                                                disabled={processing}
                                                            />
                                                            <Label htmlFor={inputId} className="cursor-pointer text-sm font-normal capitalize">
                                                                {perm.name.split('.').pop()?.replace(/[_-]/g, ' ') ?? perm.name}
                                                            </Label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                            <InputError className="mt-2" message={errors.permissions} />
                        </div>

                        {selected.map((id) => (
                            <input key={id} type="hidden" name="permissions[]" value={id} />
                        ))}
                    </div>

                    <div className="pt-4">
                        <Button className="cursor-pointer" type="submit" disabled={processing}>
                            {role ? t('form.submit.update') : t('form.submit.create')}
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
