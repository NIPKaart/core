import { ConfirmDialog } from '@/components/confirm-dialog';
import app from '@/routes/app';
import { ParkingSpaceConfirmation } from '@/types';
import { router } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type ConfirmationDialogType = 'delete' | 'bulkDelete';
type DialogSubject = ParkingSpaceConfirmation | { ids: string[] } | null;

type Options = {
    parkingSpaceId?: string | number;
    onSuccess?: () => void;
    onError?: () => void;
};

function asRouteParam(id: string | number): string | { id: string } {
    return typeof id === 'string' ? id : { id: String(id) };
}

export function useConfirmationActionDialog(options: Options = {}) {
    const { t } = useTranslation('backend/parking/confirmations');
    const { t: tGlobal } = useTranslation('backend/global');
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
                toast.error(t('errors.missingId'));
                closeDialog();
                return;
            }
            router.delete(
                app.parkingSpaces.confirmations.destroy({
                    parking_space: asRouteParam(parking_space_id),
                    confirmation: dialogSubject.id,
                }),
                {
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
                },
            );
        },
        bulkDelete: () => {
            if (!dialogSubject || !('ids' in dialogSubject) || dialogSubject.ids.length === 0) return;
            const parking_space_id = options.parkingSpaceId;
            if (!parking_space_id) {
                toast.error(t('errors.missingId'));
                closeDialog();
                return;
            }
            router.delete(app.parkingSpaces.confirmations.bulk.destroy({ parking_space: parking_space_id }), {
                data: { ids: dialogSubject.ids },
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('toast.bulkDelete.success'));
                    closeDialog();
                    options.onSuccess?.();
                },
                onError: () => {
                    toast.error(t('toast.bulkDelete.error'));
                    closeDialog();
                    options.onError?.();
                },
            });
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
            title: t('delete.title'),
            description: (s) =>
                s && 'id' in s
                    ? t('delete.description', {
                          user: s.user?.name ?? t('unknown', { defaultValue: 'Unknown' }),
                          date: new Date(s.confirmed_at).toLocaleDateString(),
                      })
                    : '',
            confirmText: t('delete.confirm'),
            variant: 'destructive',
        },
        bulkDelete: {
            title: t('bulkDelete.title'),
            description: (s) => (s && 'ids' in s ? t('bulkDelete.description', { count: s.ids.length }) : ''),
            confirmText: t('bulkDelete.confirm'),
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
                cancelText={tGlobal('common.cancel')}
                variant={dialogPropsMap[dialogType].variant}
                onConfirm={handlers[dialogType]}
                onClose={closeDialog}
            />
        ) : null;

    return { openDialog, closeDialog, dialogElement };
}
