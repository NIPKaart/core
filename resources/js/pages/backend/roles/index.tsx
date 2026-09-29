import Heading from '@/components/heading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthorization } from '@/hooks/use-authorization';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Check, CircleCheckBig, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react';

type RoleRecord = {
    name: string;
    label: string;
    description: string;
    userCount: number;
    permissions: string[];
    isStored: boolean;
    isSynchronized: boolean;
};

type PermissionRecord = {
    value: string;
    label: string;
    description: string;
    isStored: boolean;
};

type PermissionGroup = {
    key: string;
    label: string;
    permissions: PermissionRecord[];
};

type Synchronization = {
    isSynchronized: boolean;
    missingRoles: string[];
    missingPermissions: string[];
    unexpectedRoles: string[];
    unexpectedPermissions: string[];
};

type PageProps = {
    roles: RoleRecord[];
    permissionGroups: PermissionGroup[];
    synchronization: Synchronization;
};

export default function Index({ roles, permissionGroups, synchronization }: PageProps) {
    const { t } = useResourceTranslation('backend/roles');
    const { can } = useAuthorization();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('breadcrumbs.index'),
            href: app.roles.index(),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('head.title')} />
            <div className="px-4 py-6 sm:px-8 sm:py-8">
                <div className="space-y-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <Heading level={1} title={t('head.title')} description={t('head.description')} />
                        {can('user.view_any') && (
                            <Button variant="outline" asChild>
                                <Link href={app.users.index()}>
                                    <Users className="h-4 w-4" />
                                    {t('buttons.users')}
                                </Link>
                            </Button>
                        )}
                    </div>

                    <SynchronizationAlert synchronization={synchronization} />

                    <section aria-labelledby="roles-title" className="space-y-4">
                        <div className="space-y-1">
                            <h2 id="roles-title" className="text-lg font-semibold">
                                {t('roles.title')}
                            </h2>
                            <p className="text-sm text-muted-foreground">{t('roles.description')}</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {roles.map((role) => (
                                <article key={role.name} className="rounded-xl border bg-card p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                                <ShieldCheck className="size-5" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold">{role.label}</h3>
                                                <code className="mt-0.5 block text-xs text-muted-foreground">{role.name}</code>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                role.isSynchronized
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
                                            }
                                        >
                                            {role.isSynchronized ? t('roles.synchronized') : t('roles.needs_review')}
                                        </Badge>
                                    </div>

                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{role.description}</p>

                                    <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('roles.users')}</dt>
                                            <dd className="mt-1 text-lg font-semibold tabular-nums">{role.userCount}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{t('roles.permissions')}</dt>
                                            <dd className="mt-1 text-lg font-semibold tabular-nums">{role.permissions.length}</dd>
                                        </div>
                                    </dl>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section aria-labelledby="permission-matrix-title" className="overflow-hidden rounded-xl border bg-card shadow-xs">
                        <div className="border-b px-4 py-4 sm:px-5">
                            <h2 id="permission-matrix-title" className="text-lg font-semibold">
                                {t('matrix.title')}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t('matrix.description')}</p>
                        </div>

                        <Table className="min-w-2xl">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-full px-4 sm:px-5">{t('matrix.permission')}</TableHead>
                                    {roles.map((role) => (
                                        <TableHead key={role.name} className="min-w-28 px-4 text-center">
                                            {role.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {permissionGroups.map((group) => (
                                    <PermissionGroupRows key={group.key} group={group} roles={roles} />
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

function SynchronizationAlert({ synchronization }: { synchronization: Synchronization }) {
    const { t } = useResourceTranslation('backend/roles');

    if (synchronization.isSynchronized) {
        return (
            <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/8 dark:text-emerald-100">
                <CircleCheckBig />
                <AlertTitle>{t('sync.ok_title')}</AlertTitle>
                <AlertDescription className="text-emerald-800 dark:text-emerald-200/80">{t('sync.ok_description')}</AlertDescription>
            </Alert>
        );
    }

    const differences = [
        ...synchronization.missingRoles.map((value) => t('sync.missing_role', { value })),
        ...synchronization.missingPermissions.map((value) => t('sync.missing_permission', { value })),
        ...synchronization.unexpectedRoles.map((value) => t('sync.unexpected_role', { value })),
        ...synchronization.unexpectedPermissions.map((value) => t('sync.unexpected_permission', { value })),
    ];

    return (
        <Alert className="border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/8 dark:text-amber-100">
            <ShieldAlert />
            <AlertTitle>{t('sync.drift_title')}</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200/80">
                <p>{t('sync.drift_description')}</p>
                {differences.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                        {differences.map((difference) => (
                            <li key={difference}>{difference}</li>
                        ))}
                    </ul>
                )}
            </AlertDescription>
        </Alert>
    );
}

function PermissionGroupRows({ group, roles }: { group: PermissionGroup; roles: RoleRecord[] }) {
    const { t } = useResourceTranslation('backend/roles');

    return (
        <>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell
                    colSpan={roles.length + 1}
                    className="px-4 py-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:px-5"
                >
                    {group.label}
                </TableCell>
            </TableRow>
            {group.permissions.map((permission) => (
                <TableRow key={permission.value}>
                    <TableCell className="px-4 py-3 whitespace-normal sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{permission.label}</span>
                            {!permission.isStored && <Badge variant="destructive">{t('matrix.missing')}</Badge>}
                        </div>
                        <code className="mt-0.5 block text-xs text-muted-foreground">{permission.value}</code>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{permission.description}</p>
                    </TableCell>
                    {roles.map((role) => {
                        const isAssigned = role.permissions.includes(permission.value);

                        return (
                            <TableCell key={role.name} className="px-4 text-center">
                                <span className="sr-only">
                                    {t(isAssigned ? 'matrix.assigned' : 'matrix.not_assigned', { permission: permission.label, role: role.label })}
                                </span>
                                {isAssigned ? (
                                    <Check aria-hidden="true" className="mx-auto size-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <X aria-hidden="true" className="mx-auto size-4 text-muted-foreground/40" />
                                )}
                            </TableCell>
                        );
                    })}
                </TableRow>
            ))}
        </>
    );
}
