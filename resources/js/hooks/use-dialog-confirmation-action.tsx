import { ConfirmDialog } from '@/components/confirm-dialog';
import { ParkingSpaceConfirmation } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

export type ConfirmationDialogType = 'delete' | 'bulkDelete';
type DialogSubject = ParkingSpaceConfirmation | { ids: string[] } | null;

type Options = {
    parkingSpaceId?: number;
    onSuccess?: () => void;
    onError?: () => void;
};

export function useConfirmationActionDialog(options: Options = {}) {
    const [dialogType, setDialogType] = useState<ConfirmationDialogType | null>(null);
    const [dialogSubject, setDialogSubject] = useState<DialogSubject>(null);

    const closeDialog = () => {
        setDialogType(null);
        setDialogSubject(null);
    };

    const handlers: Record<ConfirmationDialogType, () => void> = {
        delete: () => {
            if (!dialogSubject || !('id' in dialogSubject)) return;
            const parking_space_id = options.parkingSpaceId;
            if (!parking_space_id) {
                toast.error('Missing parking space id');
                closeDialog();
                return;
            }
            router.delete(
                route('app.parking-spaces.confirmations.destroy', {
                    parking_space: parking_space_id,
                    confirmation: dialogSubject.id,
                }),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Confirmation deleted successfully');
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Failed to delete confirmation');
                        closeDialog();
                        options.onError?.();
                    },
                },
            );
        },
        bulkDelete: () => {
            if (!dialogSubject || !('ids' in dialogSubject) || dialogSubject.ids.length === 0) return;
            const parking_space_id = options.parkingSpaceId;
            if (!parking_space_id) {
                toast.error('Missing parking space id');
                closeDialog();
                return;
            }
            router.delete(
                route('app.parking-spaces.confirmations.bulk.destroy', {
                    parking_space: parking_space_id,
                }),
                {
                    data: { ids: dialogSubject.ids },
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Deleted selected confirmations successfully');
                        closeDialog();
                        options.onSuccess?.();
                    },
                    onError: () => {
                        toast.error('Failed to delete selected confirmations');
                        closeDialog();
                        options.onError?.();
                    },
                },
            );
        },
    };

    const dialogPropsMap: Record<
        ConfirmationDialogType,
        {
            title: string;
            description: (subject: DialogSubject) => string;
            confirmText: string;
            variant: 'destructive' | 'default';
        }
    > = {
        delete: {
            title: 'Delete Confirmation?',
            description: (s) =>
                s && 'id' in s
                    ? `Are you sure you want to delete this confirmation by "${s.user?.name ?? 'Unknown'}" on ${new Date(s.confirmed_at).toLocaleDateString()}? This cannot be undone.`
                    : '',
            confirmText: 'Delete',
            variant: 'destructive',
        },
        bulkDelete: {
            title: 'Delete Selected Confirmations?',
            description: (s) => (s && 'ids' in s ? `Are you sure you want to delete ${s.ids.length} confirmations? This cannot be undone.` : ''),
            confirmText: 'Delete',
            variant: 'destructive',
        },
    };

    const openDialog = (type: ConfirmationDialogType, subject: DialogSubject) => {
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
