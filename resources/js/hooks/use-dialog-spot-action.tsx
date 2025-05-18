// src/hooks/use-spot-action-dialog.tsx

import { ConfirmDialog } from '@/components/confirm-dialog';
import { UserParkingSpot } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

export type DialogType = 'delete' | 'restore' | 'forceDelete' | 'bulkRestore' | 'bulkForceDelete';
type DialogSubject = UserParkingSpot | { ids: string[] } | null;

type Options = {
    onSuccess?: () => void;
    onError?: () => void;
};

export function useSpotActionDialog(options: Options = {}) {
    const [dialogType, setDialogType] = useState<DialogType | null>(null);
    const [dialogSubject, setDialogSubject] = useState<DialogSubject>(null);

    // API HANDLERS
    const handlers: Record<DialogType, () => void> = {
        delete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.user-parking-spots.destroy', { user_parking_spot: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Parking spot moved to trash');
                    close();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to move parking spot to trash');
                    close();
                    options.onError?.();
                },
            });
        },
        restore: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.put(
                route('app.user-parking-spots.restore', { user_parking_spot: dialogSubject.id }),
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Parking spot restored');
                        close();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Failed to restore parking spot');
                        close();
                        options.onError?.();
                    },
                },
            );
        },
        forceDelete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            router.delete(route('app.user-parking-spots.forceDelete', { user_parking_spot: dialogSubject.id }), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Parking spot permanently deleted');
                    close();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Failed to permanently delete parking spot');
                    close();
                    options.onError?.();
                },
            });
        },
        bulkRestore: () => {
            if (!dialogSubject || !('ids' in dialogSubject)) return;
            router.patch(
                route('app.user-parking-spots.bulk-restore'),
                { ids: dialogSubject.ids },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Restored selected spots.');
                        close();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Restore failed.');
                        close();
                        options.onError?.();
                    },
                },
            );
        },
        bulkForceDelete: () => {
            if (!dialogSubject || !('ids' in dialogSubject)) return;
            router.delete(route('app.user-parking-spots.bulk-force-delete'), {
                data: { ids: dialogSubject.ids },
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Deleted selected spots.');
                    close();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error('Delete failed.');
                    close();
                    options.onError?.();
                },
            });
        },
    };

    // DIALOG PROPS
    const dialogPropsMap: Record<DialogType, {
        title: string;
        description: (subject: DialogSubject) => string;
        confirmText: string;
        variant: 'destructive' | 'default';
    }> = {
        delete: {
            title: 'Move to Trash?',
            description: (s) => s && 'id' in s
                ? `Are you sure you want to move the parking spot at "${s.street}, ${s.city}" to the trash?`
                : '',
            confirmText: 'Move to Trash',
            variant: 'destructive',
        },
        restore: {
            title: 'Restore Location?',
            description: (s) => s && 'id' in s
                ? `Are you sure you want to restore the parking spot at "${s.street}, ${s.city}"?`
                : '',
            confirmText: 'Restore',
            variant: 'default',
        },
        forceDelete: {
            title: 'Permanently Delete?',
            description: (s) => s && 'id' in s
                ? `Are you sure you want to permanently delete the parking spot at "${s.street}, ${s.city}"? This action cannot be undone.`
                : '',
            confirmText: 'Delete Forever',
            variant: 'destructive',
        },
        bulkRestore: {
            title: 'Restore Selected Locations?',
            description: (s) => s && 'ids' in s
                ? `Are you sure you want to restore ${s.ids.length} parking spots?`
                : '',
            confirmText: 'Restore',
            variant: 'default',
        },
        bulkForceDelete: {
            title: 'Permanently Delete Selected?',
            description: (s) => s && 'ids' in s
                ? `Are you sure you want to permanently delete ${s.ids.length} parking spots? This cannot be undone.`
                : '',
            confirmText: 'Delete Forever',
            variant: 'destructive',
        },
    };

    // OPEN/CLOSE
    const openDialog = (type: DialogType, subject: DialogSubject) => {
        setDialogType(type);
        setDialogSubject(subject);
    };
    const closeDialog = () => {
        setDialogType(null);
        setDialogSubject(null);
    };

    // DIALOG JSX
    const dialogElement: ReactNode =
        dialogType && dialogSubject ? (
            <ConfirmDialog
                title={dialogPropsMap[dialogType].title}
                description={dialogPropsMap[dialogType].description(dialogSubject)}
                confirmText={dialogPropsMap[dialogType].confirmText}
                variant={dialogPropsMap[dialogType].variant}
                onConfirm={handlers[dialogType]}
                onClose={close}
            />
        ) : null;

    return { openDialog, closeDialog, dialogElement };
}
