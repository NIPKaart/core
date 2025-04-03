import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast, Toaster } from 'sonner';

export function Toast() {
    const { flash } = usePage().props as {
        flash?: {
            success?: string;
            error?: string;
            warning?: string;
            info?: string;
        };
    };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
        if (flash?.warning) {
            toast.warning(flash.warning);
        }
        if (flash?.info) {
            toast.message(flash.info);
        }
    }, [flash]);

    return <Toaster position="top-right" />;
}
