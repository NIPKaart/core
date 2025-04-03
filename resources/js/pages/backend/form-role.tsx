import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Permission, Role } from '@/types';

import { UseFormReturn } from 'react-hook-form';

export type FormValues = {
    name: string;
    permissions: number[];
};

type RoleFormProps = {
    form: UseFormReturn<FormValues>;
    role?: Role;
    allPermissions: Permission[];
    onSubmit: () => void;
    submitting: boolean;
};

export default function RoleForm({ form, role, allPermissions, onSubmit, submitting }: RoleFormProps) {
    const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
        const [resource] = perm.name.includes('.') ? perm.name.split('.') : perm.name.split('_');
        if (!acc[resource]) acc[resource] = [];
        acc[resource].push(perm);
        return acc;
    }, {});

    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-10">
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Name</h2>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="w-full sm:w-[400px]">
                                {/* <FormLabel>Name</FormLabel> */}
                                <FormControl>
                                    <Input placeholder="admin, moderator..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Permissions</h2>
                    <FormField
                        control={form.control}
                        name="permissions"
                        render={({ field }) => (
                            <FormItem>
                                <Accordion type="multiple" className="w-full divide-y rounded-md border sm:w-[500px]">
                                    {Object.entries(groupedPermissions).map(([resource, perms]) => (
                                        <AccordionItem key={resource} value={resource}>
                                            <AccordionTrigger className="px-4 py-2 text-sm font-medium capitalize">
                                                {resource.replace(/[_-]/g, ' ')}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                                                    {perms.map((perm) => {
                                                        const isChecked = field.value.includes(perm.id);
                                                        return (
                                                            <FormItem key={perm.id} className="flex items-center space-x-2">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={(checked) => {
                                                                            const updated = checked
                                                                                ? [...field.value, perm.id]
                                                                                : field.value.filter((id) => id !== perm.id);
                                                                            field.onChange(updated);
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="text-sm font-normal capitalize">
                                                                    {perm.name.split('.').pop()?.replace(/[_-]/g, ' ') ?? perm.name}
                                                                </FormLabel>
                                                            </FormItem>
                                                        );
                                                    })}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="pt-4">
                    <Button className="cursor-pointer" type="submit" disabled={submitting}>
                        {role ? 'Update Role' : 'Save Role'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
