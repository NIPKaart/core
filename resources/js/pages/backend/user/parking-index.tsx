import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpot } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertCircle, CheckCircle, MapPin, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

type PageProps = {
    parkingSpots: ParkingSpot[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'My parking locations', href: route('user.parking-spots.index') }];

export default function UserParkingSpotsPage({ parkingSpots }: PageProps) {
    const [search, setSearch] = useState('');

    const filteredSpots = useMemo(() => {
        if (!search.trim()) return parkingSpots;
        const s = search.toLowerCase();
        return parkingSpots.filter(
            (spot) =>
                (spot.street && spot.street.toLowerCase().includes(s)) ||
                (spot.city && spot.city.toLowerCase().includes(s)) ||
                (spot.postcode && spot.postcode.toLowerCase().includes(s)),
        );
    }, [parkingSpots, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My parking locations" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold">My parking locations</h1>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        className="w-full sm:max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Live search by street, city, postcode..."
                        autoFocus
                    />
                </div>

                {filteredSpots.length === 0 ? (
                    <div className="text-muted-foreground mt-12 text-center">No parking spots found.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {filteredSpots.map((spot) => (
                            <Card
                                key={spot.id}
                                className="border-border/70 bg-card rounded-2xl border shadow-sm transition-all duration-150 hover:shadow-md"
                            >
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    <div className="bg-primary/10 flex items-center justify-center rounded-xl p-3">
                                        <MapPin className="text-primary h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base leading-tight font-semibold lg:text-lg">
                                            {spot.street}
                                            {spot.city ? <span className="text-muted-foreground font-normal"> — {spot.city}</span> : null}
                                        </CardTitle>
                                        <CardDescription className="mt-0.5 text-sm">
                                            Postcode: <span className="font-medium">{spot.postcode ?? '-'}</span>
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardFooter className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                    <StatusBadge status={spot.status} />
                                    <div className="flex gap-1">
                                        <Button asChild size="sm" variant="outline" className="me-1">
                                            <Link href={route('user.parking-spots.show', { id: spot.id })}>Details</Link>
                                        </Button>
                                        <Button asChild size="sm" variant="default" title="View on map">
                                            <a
                                                href={`/map#19/${spot.latitude.toFixed(5)}/${spot.longitude.toFixed(5)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <MapPin className="mr-1 h-4 w-4" />
                                                On map
                                            </a>
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function StatusBadge({ status }: { status: string }) {
    let color = 'bg-gray-100 text-gray-700 border border-gray-200';
    let icon = null;
    let label = status.charAt(0).toUpperCase() + status.slice(1);

    if (status === 'pending') {
        color = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
        icon = <AlertCircle className="mr-1 h-4 w-4" />;
        label = 'Pending';
    }
    if (status === 'approved') {
        color = 'bg-green-100 text-green-700 border border-green-200';
        icon = <CheckCircle className="mr-1 h-4 w-4" />;
        label = 'Approved';
    }
    if (status === 'rejected') {
        color = 'bg-red-100 text-red-700 border border-red-200';
        icon = <XCircle className="mr-1 h-4 w-4" />;
        label = 'Rejected';
    }

    return (
        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${color}`}>
            {icon}
            {label}
        </span>
    );
}
