import StaticPinMap from '@/components/contribute/static-pin-map';
import { Button } from '@/components/ui/button';
import MapLayout from '@/layouts/map-layout';
import { add } from '@/routes/location-map';
import profile from '@/routes/profile';
import { Head, Link } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PageProps = {
    parkingSpace: {
        id: string;
        latitude: number;
        longitude: number;
        street: string | null;
        municipality: { id: number; name: string } | null;
    };
};

export default function Submitted({ parkingSpace }: PageProps) {
    const { t } = useTranslation('frontend/map/contribute');
    const here = `#19/${parkingSpace.latitude.toFixed(5)}/${parkingSpace.longitude.toFixed(5)}`;
    const title = [parkingSpace.street !== 'unknown' ? parkingSpace.street : null, parkingSpace.municipality?.name].filter(Boolean).join(', ');

    return (
        <MapLayout showSearch={false}>
            <Head title={t('submitted.title')} />
            <main className="flex-1 overflow-y-auto bg-canvas">
                <div className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-6 py-10">
                    <span className="flex size-18 items-center justify-center self-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                        <Check className="size-9" strokeWidth={2.5} aria-hidden />
                    </span>
                    <div className="grid gap-2 text-center">
                        <h1 className="text-2xl font-bold">{t('submitted.title')}</h1>
                        <p className="text-muted-foreground">{t('submitted.text')}</p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                        <StaticPinMap
                            latitude={parkingSpace.latitude}
                            longitude={parkingSpace.longitude}
                            className="size-16 shrink-0 rounded-xl"
                            zoom={17}
                        />
                        <div className="grid gap-1">
                            <span className="font-semibold">{title}</span>
                            <span className="justify-self-start rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                {t('submitted.pending')}
                            </span>
                        </div>
                    </div>
                    <div className="mt-auto grid gap-2.5 pt-4">
                        <Button asChild className="h-13 text-base">
                            <Link href={profile.parkingSpaces.show.url({ id: parkingSpace.id })}>{t('submitted.view')}</Link>
                        </Button>
                        <Button asChild variant="outline" className="h-13 text-base">
                            <Link href={add.url() + here}>{t('submitted.add_another')}</Link>
                        </Button>
                        <Button asChild variant="ghost" className="h-11">
                            <Link href={'/map' + here}>{t('submitted.back_to_map')}</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </MapLayout>
    );
}
