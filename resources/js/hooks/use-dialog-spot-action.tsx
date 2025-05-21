import { ConfirmDialog } from '@/components/confirm-dialog';
import { ParkingSpot } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

export type DialogType = 'delete' | 'restore' | 'forceDelete' | 'bulkRestore' | 'bulkForceDelete';
type DialogSubject = ParkingSpot | { ids: string[] } | null;

type Options = {
    onSuccess?: () => void;
    onError?: () => void;
};

export function useSpotActionDialog(options: Options = {}) {
    const [dialogType, setDialogType] = useState<DialogType | null>(null);
    const [dialogSubject, setDialogSubject] = useState<DialogSubject>(null);

    const closeDialog = () => {
        setDialogType(null);
        setDialogSubject(null);
    };

    const handlers: Record<DialogType, () => void> = {
        delete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.parking-spots.destroy', { parking_spot: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Parking spot moved to trash');
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to move parking spot to trash');
                    closeDialog();
                    options.onError?.();
                },
            });
        },
        restore: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.patch(
                route('app.parking-spots.restore', { parking_spot: dialogSubject.id }),
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Parking spot restored');
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Failed to restore parking spot');
                        closeDialog();
                        options.onError?.();
                    },
                },
            );
        },
        forceDelete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.parking-spots.forceDelete', { parking_spot: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Parking spot permanently deleted');
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to permanently delete parking spot');
                    closeDialog();
                    options.onError?.();
                },
            });
        },
        bulkRestore: () => {
            if (!dialogSubject || !('ids' in dialogSubject) || dialogSubject.ids.length === 0) return;
            router.patch(
                route('app.parking-spots.bulk-restore'),
                { ids: dialogSubject.ids },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Restored selected spots.');
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
            router.delete(route('app.parking-spots.bulk-force-delete'), {
                data: { ids: dialogSubject.ids },
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Deleted selected spots.');
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
            description: (s) => (s && 'id' in s ? `Are you sure you want to move the parking spot at "${s.street}, ${s.city}" to the trash?` : ''),
            confirmText: 'Move to Trash',
            variant: 'destructive',
        },
        restore: {
            title: 'Restore Location?',
            description: (s) => (s && 'id' in s ? `Are you sure you want to restore the parking spot at "${s.street}, ${s.city}"?` : ''),
            confirmText: 'Restore',
            variant: 'default',
        },
        forceDelete: {
            title: 'Permanently Delete?',
            description: (s) =>
                s && 'id' in s
                    ? `Are you sure you want to permanently delete the parking spot at "${s.street}, ${s.city}"? This action cannot be undone.`
                    : '',
            confirmText: 'Delete Forever',
            variant: 'destructive',
        },
        bulkRestore: {
            title: 'Restore Selected Locations?',
            description: (s) => (s && 'ids' in s ? `Are you sure you want to restore ${s.ids.length} parking spots?` : ''),
            confirmText: 'Restore',
            variant: 'default',
        },
        bulkForceDelete: {
            title: 'Permanently Delete Selected?',
            description: (s) =>
                s && 'ids' in s ? `Are you sure you want to permanently delete ${s.ids.length} parking spots? This cannot be undone.` : '',
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
