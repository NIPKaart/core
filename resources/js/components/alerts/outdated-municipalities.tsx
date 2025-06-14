import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ParkingOffstreet } from '@/types';
import { AlertTriangle } from 'lucide-react';

type Props = {
    spaces: ParkingOffstreet[];
    minDaysOutdated?: number;
};

export default function OutdatedMunicipalitiesBanner({ spaces, minDaysOutdated = 2 }: Props) {
    const now = new Date();

    const outdatedMunicipalities = (() => {
        const muniMap: { [name: string]: string } = {};
        for (const space of spaces) {
            if (!space.municipality || !space.updated_at) continue;
            const prevDate = muniMap[space.municipality.name];
            if (!prevDate || new Date(space.updated_at) > new Date(prevDate)) {
                muniMap[space.municipality.name] = space.updated_at;
            }
        }
        return Object.entries(muniMap)
            .map(([name, updatedAt]) => ({ name, updatedAt }))
            .filter(({ updatedAt }) => {
                const updated = new Date(updatedAt);
                const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
                return diffDays >= minDaysOutdated;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    })();

    if (outdatedMunicipalities.length === 0) return null;

    return (
        <div className="mb-6 w-full">
            <Alert className="w-full border-2 border-orange-300/60 bg-orange-50 px-3 py-3 sm:py-4 dark:bg-orange-950/80">
                <AlertTitle className="flex items-center gap-2 text-base font-semibold text-orange-800 dark:text-orange-100">
                    <AlertTriangle className="h-5 w-5 min-w-5 text-orange-500" aria-label="Warning" />
                    Data not up-to-date
                </AlertTitle>
                <AlertDescription className="mt-2 w-full text-sm text-zinc-800 dark:text-orange-50">
                    <div className="mb-2">
                        {outdatedMunicipalities.length === 1 ? (
                            <>
                                1 municipality hasn't been updated in over <b>{minDaysOutdated}</b> day{minDaysOutdated > 1 && 's'}:
                            </>
                        ) : (
                            <>
                                {outdatedMunicipalities.length} municipalities haven't been updated in over <b>{minDaysOutdated}</b> day
                                {minDaysOutdated > 1 && 's'}:
                            </>
                        )}
                    </div>
                    <div
                        className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-x-auto overflow-y-auto sm:max-h-32"
                        aria-label="List of outdated municipalities"
                    >
                        {outdatedMunicipalities.map(({ name, updatedAt }) => (
                            <span
                                key={name}
                                className="rounded-xl bg-orange-200/80 px-3 py-1 text-xs font-medium whitespace-nowrap text-orange-900 dark:bg-orange-900 dark:text-orange-200"
                            >
                                {name}
                                <span className="ml-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                                    ({new Date(updatedAt).toLocaleDateString()})
                                </span>
                            </span>
                        ))}
                    </div>
                </AlertDescription>
            </Alert>
        </div>
    );
}
