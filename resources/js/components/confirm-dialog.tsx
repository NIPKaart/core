import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { buttonVariants } from './ui/button';

type ConfirmDialogProps = {
    children?: React.ReactNode;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onClose?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
};

export function ConfirmDialog({
    children,
    title = 'Are you sure?',
    description = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onClose,
    disabled,
    variant = 'default',
}: ConfirmDialogProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!children) setOpen(true);
    }, [children]);

    const handleOpenChange = (value: boolean) => {
        setOpen(value);
        if (!value && onClose) onClose();
    };

    return (
        <AlertDialog open={children ? undefined : open} onOpenChange={children ? undefined : handleOpenChange}>
            {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer" disabled={disabled}>
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                            if (!children) setOpen(false);
                        }}
                        className={cn(buttonVariants({ variant })) + ' cursor-pointer'}
                        disabled={disabled}
                    >
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
