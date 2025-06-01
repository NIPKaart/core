import { ConfirmDialog } from '@/components/confirm-dialog';
import { ParkingSpace } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

export type DialogType = 'delete' | 'restore' | 'forceDelete' | 'bulkRestore' | 'bulkForceDelete';
type DialogSubject = ParkingSpace | { ids: string[] } | null;

type Options = {
    onSuccess?: () => void;
    onError?: () => void;
};

export function useSpaceActionDialog(options: Options = {}) {
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
                    toast.success('Parking space moved to trash');
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to move parking space to trash');
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
                        toast.success('Parking space restored');
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Failed to restore parking space');
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
                    toast.success('Parking space permanently deleted');
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to permanently delete parking space');
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
                        toast.success('Restored selected spaces.');
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Restore failed.');
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
                    toast.success('Deleted selected spaces.');
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Delete failed.');
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
            title: 'Move to Trash?',
            description: (s) => (s && 'id' in s ? `Are you sure you want to move the parking space at "${s.street}, ${s.city}" to the trash?` : ''),
            confirmText: 'Move to Trash',
            variant: 'destructive',
        },
        restore: {
            title: 'Restore Location?',
            description: (s) => (s && 'id' in s ? `Are you sure you want to restore the parking space at "${s.street}, ${s.city}"?` : ''),
            confirmText: 'Restore',
            variant: 'default',
        },
        forceDelete: {
            title: 'Permanently Delete?',
            description: (s) =>
                s && 'id' in s
                    ? `Are you sure you want to permanently delete the parking space at "${s.street}, ${s.city}"? This action cannot be undone.`
                    : '',
            confirmText: 'Delete Forever',
            variant: 'destructive',
        },
        bulkRestore: {
            title: 'Restore Selected Locations?',
            description: (s) => (s && 'ids' in s ? `Are you sure you want to restore ${s.ids.length} parking spaces?` : ''),
            confirmText: 'Restore',
            variant: 'default',
        },
        bulkForceDelete: {
            title: 'Permanently Delete Selected?',
            description: (s) =>
                s && 'ids' in s ? `Are you sure you want to permanently delete ${s.ids.length} parking spaces? This cannot be undone.` : '',
            confirmText: 'Delete Forever',
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
