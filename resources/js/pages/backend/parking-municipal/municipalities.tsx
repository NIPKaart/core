import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Building2, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type Municipality = {
    id: number;
    name: string;
    total_spaces: number;
    last_updated: string | null;
};

type PageProps = {
    municipalities: Municipality[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Municipalities', href: route('app.parking-municipal.municipalities') }];

export default function MunicipalitiesPage({ municipalities }: PageProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return municipalities;
        const s = search.toLowerCase();
        return municipalities.filter((m) => m.name.toLowerCase().includes(s));
    }, [municipalities, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Municipalities" />
            <div className="space-y-6 px-4 py-6 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold">Municipalities</h1>
                <p className="text-muted-foreground">
                    Here you can find all municipalities that have registered parking spaces. Use the search bar to quickly find a specific
                    municipality.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-sm">
                        <Input
                            className="w-full pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search municipality..."
                        />
                        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <Building2 className="mb-2 h-10 w-10 text-primary" />
                            <span className="text-lg font-semibold text-muted-foreground">No municipalities found</span>
                            <span className="text-sm text-muted-foreground">
                                Try a different search or check back later for more supported municipalities.
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((municipality) => (
                            <Card
                                key={municipality.id}
                                className="rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-150 hover:shadow-md"
                            >
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    <div className="flex items-center justify-center rounded-xl bg-primary/10 p-3">
                                        <Building2 className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base leading-tight font-semibold lg:text-lg">
                                            {municipality.name}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            {municipality.total_spaces > 0 ? (
                                                <span>
                                                    <span className="font-semibold text-foreground">{municipality.total_spaces}</span> accessible
                                                    spaces
                                                </span>
                                            ) : (
                                                <span>No spaces listed</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Last updated:{' '}
                                        <span className="font-medium">
                                            {municipality.last_updated
                                                ? new Date(municipality.last_updated).toLocaleDateString('nl-NL', {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : '—'}
                                        </span>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end border-t pt-4">
                                    <Button asChild variant="outline" className="transition hover:bg-primary/10 hover:text-primary">
                                        <Link href={route('app.parking-municipal.municipalities.index', { municipality: municipality.id })}>
                                            View spaces
                                        </Link>
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
