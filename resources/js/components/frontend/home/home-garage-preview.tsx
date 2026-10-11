import { GarageTable } from '@/components/frontend/garage-table';
import type { OverviewGarage, OverviewMunicipality } from '@/lib/garage-overview';
import { useTranslation } from 'react-i18next';

type Preview = { municipality: OverviewMunicipality; total: number };

export default function HomeGaragePreview({ garages }: { garages: Preview | null }) {
    const { t } = useTranslation('frontend/home');
    const locations: Pick<OverviewGarage, 'id' | 'name' | 'type' | 'capacity' | 'free_space'>[] = [
        { id: 'example-centre', name: t('garages.example_names.centre'), type: 'garage', capacity: 320, free_space: 128 },
        { id: 'example-station', name: t('garages.example_names.station'), type: 'garage', capacity: 240, free_space: 36 },
        { id: 'example-park-and-ride', name: t('garages.example_names.park_and_ride'), type: 'parkandride', capacity: 600, free_space: 410 },
    ];
    const examples: OverviewGarage[] = locations.map((garage) => ({
        ...garage,
        latitude: 0,
        longitude: 0,
        availability: 'current',
        occupancy_status: 'counting',
        observed_at: null,
    }));

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <GarageTable
                municipality={garages?.municipality ?? { name: t('garages.example_municipality'), garages: examples }}
                total={garages?.total}
                compact
                previewOnly={!garages}
            />
        </div>
    );
}
