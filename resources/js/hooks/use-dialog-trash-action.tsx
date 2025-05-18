import { ConfirmDialog } from '@/components/confirm-dialog';
import type { UserParkingSpot } from '@/types';
import { router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export type TrashDialogType = 'restore' | 'forceDelete' | 'bulk-restore' | 'bulk-force-delete' | null;

export function useTrashActions(spots: UserParkingSpot[]) {
    const [dialogSpot, setDialogSpot] = useState<UserParkingSpot | null>(null);
    const [dialogType, setDialogType] = useState<TrashDialogType>(null);
    const [rowSelection, setRowSelection] = useState<Record<number, boolean>>({});

    // Dialog helper
    function openDialog(type: TrashDialogType, spot?: UserParkingSpot) {
        setDialogSpot(spot ?? null);
        setDialogType(type);
    }

    function closeDialog() {
        setDialogSpot(null);
        setDialogType(null);
    }

    // Helper: selected ids for bulk actions
    const getSelectedIds = useCallback(() => {
        return spots.filter((_, index) => rowSelection[index]).map((spot) => spot.id);
    }, [spots, rowSelection]);

    const restoreSpot = (id: string) => {
        router.patch(
            route('app.user-parking-spots.restore', { user_parking_spot: id }),
            {},
            {
                onSuccess: () => toast.success('Parking spot restored.'),
                onError: () => toast.error('Failed to restore spot.'),
            },
        );
        closeDialog();
    };

    const forceDeleteSpot = (id: string) => {
        router.delete(route('app.user-parking-spots.force-delete', { user_parking_spot: id }), {
            data: {},
            onSuccess: () => toast.success('Parking spot permanently deleted.'),
            onError: () => toast.error('Failed to delete spot.'),
        });
        closeDialog();
    };

    const handleBulkRestore = () => {
        router.patch(
            route('app.user-parking-spots.bulk-restore'),
            { ids: getSelectedIds() },
            {
                onSuccess: () => {
                    toast.success('Restored selected spots.');
                    setRowSelection({});
                },
                onError: () => toast.error('Restore failed.'),
            },
        );
        closeDialog();
    };

    const handleBulkForceDelete = () => {
        router.delete(route('app.user-parking-spots.bulk-force-delete'), {
            data: { ids: getSelectedIds() },
            onSuccess: () => {
                toast.success('Deleted selected spots.');
                setRowSelection({});
            },
            onError: () => toast.error('Delete failed.'),
        });
        closeDialog();
    };

    const dialogs = (
        <>
            {dialogType === 'restore' && dialogSpot && (
                <ConfirmDialog
                    title="Restore Parking Spot"
                    description={`Do you want to restore the spot at "${dialogSpot.street}, ${dialogSpot.city}"?`}
                    confirmText="Restore"
                    onConfirm={() => restoreSpot(dialogSpot.id)}
                    onClose={closeDialog}
                />
            )}
            {dialogType === 'forceDelete' && dialogSpot && (
                <ConfirmDialog
                    title="Delete Permanently"
                    description="Are you sure? This action cannot be undone."
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={() => forceDeleteSpot(dialogSpot.id)}
                    onClose={closeDialog}
                />
            )}
            {dialogType === 'bulk-restore' && (
                <ConfirmDialog
                    title="Restore selected spots"
                    description="Are you sure you want to restore the selected parking spots?"
                    confirmText="Restore"
                    onConfirm={handleBulkRestore}
                    onClose={closeDialog}
                />
            )}
            {dialogType === 'bulk-force-delete' && (
                <ConfirmDialog
                    title="Delete selected spots permanently"
                    description="This cannot be undone. Are you sure?"
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={handleBulkForceDelete}
                    onClose={closeDialog}
                />
            )}
        </>
    );

    return {
        dialogs,
        rowSelection,
        setRowSelection,
        openDialog,
        getSelectedIds,
    };
}
