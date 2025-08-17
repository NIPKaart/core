import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useResourceTranslation } from '@/hooks/use-resource-translation';
import ParkingRuleForm, { FormValues } from '@/pages/backend/form-parking-rules';
import type { Country, Municipality } from '@/types';
import { MapPin, Plus, X } from 'lucide-react';

type Props = {
    open: boolean;
    onClose: () => void;
    isEdit?: boolean;
    submitting?: boolean;
    countries: Country[];
    municipalities: Municipality[];
    action: string;
    method?: 'post' | 'patch' | 'put';
    initial?: Partial<FormValues>;
    onSuccess?: () => void;
};

export default function ParkingRuleModal({
    open,
    onClose,
    isEdit = false,
    submitting = false,
    countries,
    municipalities,
    action,
    method = 'post',
    initial,
    onSuccess,
}: Props) {
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const { t, tGlobal } = useResourceTranslation('backend/parking-rules');

    const descriptionText = t('modal.description');
    const titleText = isEdit ? t('modal.title_edit') : t('modal.title_add');
    const submitText = isEdit ? t('modal.submit_update') : t('modal.submit_add');
    const closeText = tGlobal('common.close');

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
                <DialogContent showClose={false} className="max-w-xl overflow-visible bg-background px-0 pt-0 pb-0 sm:rounded-xl">
                    <DialogHeader>
                        <div className="flex w-full items-center justify-between gap-2 px-6 pt-6 pb-4">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                                <MapPin className="h-6 w-6 text-primary" />
                                {titleText}
                            </DialogTitle>
                            <Button className="cursor-pointer" size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <DialogDescription asChild>
                            <div className="-mt-2 mb-1 px-6 text-sm text-muted-foreground">{descriptionText}</div>
                        </DialogDescription>
                    </DialogHeader>
                    <Separator />
                    <div className="max-h-[60vh] overflow-y-auto px-4 py-6 sm:px-6">
                        <ParkingRuleForm
                            action={action}
                            method={method}
                            countries={countries}
                            municipalities={municipalities}
                            initial={initial}
                            onSuccess={onSuccess}
                        />
                    </div>
                    <DialogFooter className="flex flex-row gap-2 border-t px-4 py-4 sm:px-6">
                        <Button type="button" variant="outline" className="w-full cursor-pointer sm:w-auto" onClick={onClose} disabled={submitting}>
                            {closeText}
                        </Button>
                        <Button type="submit" form="parking-rule-form" disabled={submitting} className="w-full cursor-pointer sm:w-auto">
                            {isEdit ? (
                                submitText
                            ) : (
                                <>
                                    <Plus className="mr-1 h-4 w-4" />
                                    {submitText}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={(value) => !value && onClose()} modal={false}>
            <DrawerContent className="mx-auto max-w-xl bg-background px-0 pt-0 pb-0 sm:rounded-t-2xl">
                <DrawerHeader className="px-4 pt-4 pb-2">
                    <div className="flex w-full items-center gap-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
                            <MapPin className="h-6 w-6 text-primary" />
                            {titleText}
                        </DrawerTitle>
                    </div>
                    <DrawerDescription asChild>
                        <div className="mt-1 text-sm text-muted-foreground">{descriptionText}</div>
                    </DrawerDescription>
                </DrawerHeader>
                <Separator />
                <div className="max-h-[60vh] overflow-y-auto px-4 py-6 sm:px-6">
                    <ParkingRuleForm
                        action={action}
                        method={method}
                        countries={countries}
                        municipalities={municipalities}
                        initial={initial}
                        onSuccess={onSuccess}
                    />
                </div>
                <DrawerFooter className="flex flex-row gap-2 border-t px-4 py-4 sm:px-6">
                    <DrawerClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            {closeText}
                        </Button>
                    </DrawerClose>
                    <Button type="submit" form="parking-rule-form" disabled={submitting} className="w-full sm:w-auto">
                        {isEdit ? (
                            submitText
                        ) : (
                            <>
                                <Plus className="mr-1 h-4 w-4" />
                                {submitText}
                            </>
                        )}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
