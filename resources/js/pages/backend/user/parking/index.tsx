import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, ParkingSpace } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertCircle, CheckCircle, MapPin, Plus, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

type PageProps = {
    parkingSpaces: ParkingSpace[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'My parking locations', href: route('user.parking-spaces.index') }];

export default function UserParkingSpacesPage({ parkingSpaces }: PageProps) {
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My parking locations" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold">My parking locations</h1>
                <p className="text-muted-foreground">
                    Here you can manage your parking spaces and view their details. You can also remove any of your parking spaces if needed.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        className="w-full sm:max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Live search by street, city, postcode..."
                        autoFocus
                    />
                </div>

                {filteredSpaces.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <MapPin className="text-primary mb-2 h-10 w-10" />
                            <span className="text-muted-foreground text-lg font-semibold">You haven&apos;t added any parking spaces yet.</span>
                            <span className="text-muted-foreground text-sm">Start contributing and help others by adding your first location!</span>
                        </div>
                        <Button asChild size="lg" className="mt-2 bg-orange-600 hover:bg-orange-500">
                            <Link href={route('map.add')}>
                                <Plus className="h-5 w-5" />
                                Add your first parking space
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {filteredSpaces.map((space) => (
                            <Card
                                key={space.id}
                                className="border-border/70 bg-card rounded-2xl border shadow-sm transition-all duration-150 hover:shadow-md"
                            >
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    <div className="bg-primary/10 flex items-center justify-center rounded-xl p-3">
                                        <MapPin className="text-primary h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base leading-tight font-semibold lg:text-lg">
                                            {space.street}
                                            {space.city ? <span className="text-muted-foreground font-normal"> — {space.city}</span> : null}
                                        </CardTitle>
                                        <CardDescription className="mt-0.5 text-sm">
                                            Postcode: <span className="font-medium">{space.postcode ?? '-'}</span>
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardFooter className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                    <StatusBadge status={space.status} />
                                    <div className="flex gap-1">
                                        <Button asChild size="sm" variant="outline" className="me-1">
                                            <Link href={route('user.parking-spaces.show', { id: space.id })}>Details</Link>
                                        </Button>
                                        {space.status === 'approved' && (
                                            <Button asChild size="sm" variant="default" title="View on map">
                                                <a
                                                    href={`/map#19/${space.latitude.toFixed(5)}/${space.longitude.toFixed(5)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <MapPin className="h-4 w-4" />
                                                    On map
                                                </a>
                                            </Button>
                                        )}
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
