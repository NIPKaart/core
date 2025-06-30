import { ConfirmDialog } from '@/components/confirm-dialog';
import { ParkingSpace } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type DialogType = 'delete' | 'restore' | 'forceDelete' | 'bulkRestore' | 'bulkForceDelete';
type DialogSubject = ParkingSpace | { ids: string[] } | null;

type Options = {
    onSuccess?: () => void;
    onError?: () => void;
};

export function useSpaceActionDialog(options: Options = {}) {
    const { t } = useTranslation('backend/parking-trash');
    const [dialogType, setDialogType] = useState<DialogType | null>(null);
    const [dialogSubject, setDialogSubject] = useState<DialogSubject>(null);

    const closeDialog = () => {
        setDialogType(null);
        setDialogSubject(null);
    };

    const handlers: Record<DialogType, () => void> = {
        delete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.parking-spaces.destroy', { parking_space: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('toast.delete.success'));
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error(t('toast.delete.error'));
                    closeDialog();
                    options.onError?.();
                },
            });
        },
        restore: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.patch(
                route('app.parking-spaces.restore', { parking_space: dialogSubject.id }),
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success(t('toast.restore.success'));
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error(t('toast.restore.error'));
                        closeDialog();
                        options.onError?.();
                    },
                },
            );
        },
        forceDelete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.parking-spaces.forceDelete', { parking_space: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('toast.forceDelete.success'));
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error(t('toast.forceDelete.error'));
                    closeDialog();
                    options.onError?.();
                },
            });
        },
        bulkRestore: () => {
            if (!dialogSubject || !('ids' in dialogSubject) || dialogSubject.ids.length === 0) return;
            router.patch(
                route('app.parking-spaces.bulk.restore'),
                { ids: dialogSubject.ids },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success(t('toast.bulkRestore.success', { count: dialogSubject.ids.length }));
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error(t('toast.bulkRestore.error'));
                        closeDialog();
                        options.onError?.();
                    },
                },
            );
        },
        bulkForceDelete: () => {
            if (!dialogSubject || !('ids' in dialogSubject) || dialogSubject.ids.length === 0) return;
            router.delete(route('app.parking-spaces.bulk.force-delete'), {
                data: { ids: dialogSubject.ids },
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('toast.bulkForceDelete.success', { count: dialogSubject.ids.length }));
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error(t('toast.bulkForceDelete.error'));
                    closeDialog();
                    options.onError?.();
                },
            });
        },
    };

    const dialogPropsMap: Record<
        DialogType,
        {
            title: string;
            description: (subject: DialogSubject) => string;
            confirmText: string;
            variant: 'destructive' | 'default';
        }
    > = {
        delete: {
            title: t('confirm.delete.title'),
            description: (s) => (s && 'id' in s ? t('confirm.delete.description', { street: s.street, city: s.city }) : ''),
            confirmText: t('confirm.delete.confirm'),
            variant: 'destructive',
        },
        restore: {
            title: t('confirm.restore.title'),
            description: (s) => (s && 'id' in s ? t('confirm.restore.description', { street: s.street, city: s.city }) : ''),
            confirmText: t('confirm.restore.confirm'),
            variant: 'default',
        },
        forceDelete: {
            title: t('confirm.forceDelete.title'),
            description: (s) => (s && 'id' in s ? t('confirm.forceDelete.description', { street: s.street, city: s.city }) : ''),
            confirmText: t('confirm.forceDelete.confirm'),
            variant: 'destructive',
        },
        bulkRestore: {
            title: t('confirm.bulkRestore.title'),
            description: (s) => (s && 'ids' in s ? t('confirm.bulkRestore.description', { count: s.ids.length }) : ''),
            confirmText: t('confirm.bulkRestore.confirm'),
            variant: 'default',
        },
        bulkForceDelete: {
            title: t('confirm.bulkForceDelete.title'),
            description: (s) => (s && 'ids' in s ? t('confirm.bulkForceDelete.description', { count: s.ids.length }) : ''),
            confirmText: t('confirm.bulkForceDelete.confirm'),
            variant: 'destructive',
        },
    };

    const openDialog = (type: DialogType, subject: DialogSubject) => {
        setDialogType(type);
        setDialogSubject(subject);
    };

    const dialogElement: ReactNode =
        dialogType && dialogSubject ? (
            <ConfirmDialog
                title={dialogPropsMap[dialogType].title}
                description={dialogPropsMap[dialogType].description(dialogSubject)}
                confirmText={dialogPropsMap[dialogType].confirmText}
                variant={dialogPropsMap[dialogType].variant}
                onConfirm={handlers[dialogType]}
                onClose={closeDialog}
            />
        ) : null;

    return { openDialog, closeDialog, dialogElement };
}
