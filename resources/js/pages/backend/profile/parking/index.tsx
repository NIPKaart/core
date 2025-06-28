import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertCircle, CheckCircle, MapPin, Plus, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type PageProps = {
    parkingSpaces: ParkingSpace[];
    selectOptions: {
        statuses: { value: string; label: string; description: string }[];
    };
};

export default function UserParkingSpacesPage({ parkingSpaces, selectOptions }: PageProps) {
    const { t } = useTranslation('profile');

    const [search, setSearch] = useState('');

    const filteredSpaces = useMemo(() => {
        if (!search.trim()) return parkingSpaces;
        const s = search.toLowerCase();
        return parkingSpaces.filter(
            (space) =>
                (space.street && space.street.toLowerCase().includes(s)) ||
                (space.city && space.city.toLowerCase().includes(s)) ||
                (space.postcode && space.postcode.toLowerCase().includes(s)),
        );
    }, [parkingSpaces, search]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('parking_spaces.breadcrumbs.index'), href: route('profile.parking-spaces.index') }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('parking_spaces.title.index')} />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold">{t('parking_spaces.heading.index')}</h1>
                <p className="text-muted-foreground">{t('parking_spaces.subheading')}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        className="w-full sm:max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('parking_spaces.search.placeholder')}
                        autoFocus
                    />
                </div>

                {/* If there are no parking spaces added yet */}
                {filteredSpaces.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <MapPin className="mb-2 h-10 w-10 text-primary" />
                            <span className="text-lg font-semibold text-muted-foreground">{t('parking_spaces.empty.title')}</span>
                            <span className="text-sm text-muted-foreground">{t('parking_spaces.empty.subtitle')}</span>
                        </div>
                        <Button asChild size="lg" className="mt-2 bg-orange-600 hover:bg-orange-500">
                            <Link href={route('map.add')}>
                                <Plus className="h-5 w-5" />
                                {t('common.actions.add_first_parking_space')}
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {filteredSpaces.map((space) => {
                            const statusOpt = selectOptions.statuses.find((s) => s.value === space.status);
                            return (
                                <Card
                                    key={space.id}
                                    className="rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-150 hover:shadow-md"
                                >
                                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                        <div className="flex items-center justify-center rounded-xl bg-primary/10 p-3">
                                            <MapPin className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <CardTitle className="truncate text-base leading-tight font-semibold lg:text-lg">
                                                {space.street}
                                                {space.city ? <span className="font-normal text-muted-foreground"> — {space.city}</span> : null}
                                            </CardTitle>
                                            <CardDescription className="mt-0.5 text-sm">
                                                {t('common.fields.postcode')}: <span className="font-medium">{space.postcode ?? '-'}</span>
                                            </CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardFooter className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                        <StatusBadge status={space.status} label={statusOpt?.label ?? space.status} />
                                        <div className="flex gap-1">
                                            <Button asChild size="sm" variant="outline" className="me-1">
                                                <Link href={route('profile.parking-spaces.show', { id: space.id })}>
                                                    {t('common.actions.details')}
                                                </Link>
                                            </Button>
                                            {space.status === 'approved' && (
                                                <Button asChild size="sm" variant="default" title={t('common.actions.view_on_map')}>
                                                    <a
                                                        href={`/map#19/${space.latitude.toFixed(5)}/${space.longitude.toFixed(5)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <MapPin className="h-4 w-4" />
                                                        {t('common.actions.view_on_map')}
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

type StatusBadgeProps = {
    status: string;
    label: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
    let color = 'bg-gray-100 text-gray-700 border border-gray-200';
    let icon = null;

    switch (status) {
        case 'pending':
            color = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
            icon = <AlertCircle className="mr-1 h-4 w-4" />;
            break;
        case 'approved':
            color = 'bg-green-100 text-green-700 border border-green-200';
            icon = <CheckCircle className="mr-1 h-4 w-4" />;
            break;
        case 'rejected':
            color = 'bg-red-100 text-red-700 border border-red-200';
            icon = <XCircle className="mr-1 h-4 w-4" />;
            break;
        default:
            color = 'bg-gray-100 text-gray-700 border border-gray-200';
            break;
    }

    return (
        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${color}`}>
            {icon}
            {label}
        </span>
    );
}
