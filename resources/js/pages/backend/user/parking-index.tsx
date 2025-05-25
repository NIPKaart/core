import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, PaginatedResponse, ParkingSpot } from '@/types';
import { Head } from '@inertiajs/react';
import { MapPin } from 'lucide-react';

type PageProps = {
    parkingSpots: PaginatedResponse<ParkingSpot>;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'My parking locations', href: route('user.parking-spots.index') }];

export default function UserParkingIndex({ parkingSpots }: PageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My parking locations" />

            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-bold">My parking locations</h1>
                {parkingSpots.data.length === 0 ? (
                    <div className="text-muted-foreground mt-12 text-center">You have not submitted any locations yet.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {parkingSpots.data.map((spot) => (
                            <Card
                                key={spot.id}
                                className="border-border/70 bg-card rounded-2xl border shadow-sm transition-all duration-150 hover:shadow-md"
                            >
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    <div className="bg-primary/10 flex items-center justify-center rounded-xl p-3">
                                        <MapPin className="text-primary h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base leading-tight font-semibold">
                                            {spot.street}
                                            {spot.city ? <span className="text-muted-foreground font-normal"> — {spot.city}</span> : null}
                                        </CardTitle>
                                        <CardDescription className="mt-0.5 text-xs">
                                            Orientation: <span className="font-medium">{spot.orientation ?? '-'}</span>
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                {spot.description && (
                                    <CardContent className="py-2">
                                        <p className="text-muted-foreground text-sm">{spot.description}</p>
                                    </CardContent>
                                )}
                                <CardFooter className="mt-2 flex items-center justify-between gap-3 border-t pt-4">
                                    <StatusBadge status={spot.status} />
                                    <span className="text-muted-foreground text-xs">{formatDate(spot.created_at)}</span>
                                    <Button asChild size="sm" variant="outline" className="ml-auto">
                                        <a href={route('user.parking-spots.show', { id: spot.id })}>View</a>
                                    </Button>
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
    let color = 'bg-gray-200 text-gray-800';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    if (status === 'pending') color = 'bg-yellow-100 text-yellow-700';
    if (status === 'approved') color = 'bg-green-100 text-green-700';
    if (status === 'rejected') color = 'bg-red-100 text-red-700';

    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
}
