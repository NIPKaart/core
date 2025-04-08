import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Role } from '@/types';
import { UseFormReturn } from 'react-hook-form';

export type FormValues = {
    name: string;
    email: string;
    password?: string;
    password_confirmation?: string;
    role: string;
};

type UserFormProps = {
    form: UseFormReturn<FormValues>;
    roles: Role[];
    isEdit?: boolean;
    onSubmit: () => void;
    submitting: boolean;
};

export default function UserForm({ form, roles, isEdit = false, onSubmit, submitting }: UserFormProps) {
    return (
        <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-10">
                {/* === Account Info === */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Account Info</h2>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Name */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="john@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* === Password Fields === */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">{isEdit ? 'Change Password (optional)' : 'Password'}</h2>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password_confirmation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* === Role Selection === */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Role</h2>
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem className="sm:w-[300px]">
                                <FormLabel>Assign Role</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.name} value={role.name}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* === Submit Button === */}
                <div className="pt-4">
                    <Button className="cursor-pointer" type="submit" disabled={submitting}>
                        {isEdit ? 'Update User' : 'Create User'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
