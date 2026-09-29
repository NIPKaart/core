import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { register } from '@/routes';
import { add } from '@/routes/location-map';
import type { SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newPlacePinSvg } from './new-place-pin';

/**
 * Starts the add flow at the current map position; guests are first asked to sign in.
 */
export default function AddPlaceButton() {
    const { t } = useTranslation('frontend/map/contribute');
    const { auth } = usePage<SharedData>().props;
    const [guestSheet, setGuestSheet] = useState(false);

    const start = () => {
        if (!auth.user) {
            setGuestSheet(true);
            return;
        }
        router.visit(add.url() + window.location.hash);
    };

    return (
        <>
            <Button
                onClick={start}
                className="h-13 gap-2 rounded-full bg-orange-600 px-6 text-base font-semibold text-white shadow-lg shadow-orange-600/30 hover:bg-orange-700"
            >
                <Plus className="size-5" strokeWidth={2.5} aria-hidden />
                {t('entry.add')}
            </Button>

            <Sheet open={guestSheet} onOpenChange={setGuestSheet}>
                <SheetContent side="bottom" className="mx-auto max-w-lg gap-4 rounded-t-2xl px-5 pb-7">
                    <SheetHeader className="gap-3 px-0">
                        <span
                            className="flex size-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/40 [&>svg]:h-9 [&>svg]:w-auto"
                            aria-hidden
                            dangerouslySetInnerHTML={{ __html: newPlacePinSvg() }}
                        />
                        <SheetTitle className="text-xl">{t('entry.guest_title')}</SheetTitle>
                        <SheetDescription className="text-base">{t('entry.guest_text')}</SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-2.5">
                        <Button asChild className="h-13 text-base">
                            <Link href={add.url() + window.location.hash}>{t('entry.login')}</Link>
                        </Button>
                        <Button asChild variant="outline" className="h-13 text-base">
                            <Link href={register.url()}>{t('entry.register')}</Link>
                        </Button>
                        <Button variant="ghost" className="h-11" onClick={() => setGuestSheet(false)}>
                            {t('entry.not_now')}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
