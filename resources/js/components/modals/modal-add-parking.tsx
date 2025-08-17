import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/use-media-query';
import { AddLocationForm, FormValues } from '@/pages/frontend/form/form-create-location';
import { AlertCircle, MapPinned, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
    open: boolean;
    onClose: () => void;
    action: string;
    method?: 'post' | 'put' | 'patch';
    orientationOptions: Record<string, string>;
    lat: number;
    lng: number;
    addressValid: boolean;
    generalError?: string;
    initial?: Partial<FormValues>;
    onSuccess?: (args: any) => void;
    submitting?: boolean;
};

export default function AddParkingModal({
    open,
    onClose,
    action,
    method = 'post',
    orientationOptions,
    lat,
    lng,
    addressValid,
    generalError,
    initial,
    onSuccess,
    submitting = false,
}: Props) {
    const { t } = useTranslation('frontend/map/add-parking');
    const { t: tGlobal } = useTranslation('frontend/global');
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const title = t('modal.title');
    const description = t('modal.description');

    const alerts = (
        <>
            {!addressValid && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('modal.alerts.addressFailed.title')}</AlertTitle>
                    <AlertDescription>{t('modal.alerts.addressFailed.description')}</AlertDescription>
                </Alert>
            )}
            {generalError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('modal.alerts.submitFailed.title')}</AlertTitle>
                    <AlertDescription>{generalError}</AlertDescription>
                </Alert>
            )}
        </>
    );

    const formContent = (
        <>
            {alerts}
            <AddLocationForm
                action={action}
                method={method}
                orientationOptions={orientationOptions}
                initial={initial}
                lat={lat}
                lng={lng}
                onSuccess={onSuccess}
            />
        </>
    );

    // Desktop - Dialog variant
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
                <DialogContent showClose={false} className="max-w-xl overflow-visible bg-background px-0 pt-0 pb-0 sm:rounded-xl">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2 px-6 pt-6 pb-4">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <MapPinned className="h-6 w-6 text-orange-400" />
                                {title}
                            </DialogTitle>
                            <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <DialogDescription asChild>
                            <div className="-mt-2 mb-1 px-6 text-sm text-muted-foreground">{description}</div>
                        </DialogDescription>
                    </DialogHeader>
                    <Separator />
                    <div className="max-h[60vh] overflow-y-auto px-4 py-6 sm:px-6">{formContent}</div>
                    <DialogFooter className="flex flex-row gap-2 border-t px-4 py-4 sm:px-6">
                        <Button type="button" variant="outline" className="w-full cursor-pointer sm:w-auto" onClick={onClose} disabled={submitting}>
                            {tGlobal('common.close')}
                        </Button>
                        <Button type="submit" form="location-form" disabled={submitting || !addressValid} className="w-full sm:w-auto">
                            <Send className="h-4 w-4" />
                            {t('modal.buttons.submit')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile - Drawer variant
    return (
        <Drawer open={open} onOpenChange={(value) => !value && onClose()} modal={false}>
            <DrawerContent className="mx-auto max-w-xl bg-background px-0 pt-0 pb-0 sm:rounded-t-2xl">
                <DrawerHeader className="px-4 pt-4 pb-2">
                    <div className="flex w-full items-center gap-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                            <MapPinned className="h-6 w-6 text-orange-400" />
                            {title}
                        </DrawerTitle>
                    </div>
                    <DrawerDescription asChild>
                        <div className="mb-0 text-sm text-muted-foreground">{description}</div>
                    </DrawerDescription>
                </DrawerHeader>
                <Separator />
                <div className="max-h-[60vh] overflow-y-auto px-4 py-6 sm:px-6">{formContent}</div>
                <DrawerFooter className="flex flex-row gap-2 border-t px-4 py-4 sm:px-6">
                    <DrawerClose asChild>
                        <Button variant="outline" className="w-full cursor-pointer sm:w-auto">
                            {tGlobal('common.close')}
                        </Button>
                    </DrawerClose>
                    <Button type="submit" form="location-form" disabled={submitting || !addressValid} className="w-full sm:w-auto">
                        <Send className="h-4 w-4" />
                        {t('modal.buttons.submit')}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
