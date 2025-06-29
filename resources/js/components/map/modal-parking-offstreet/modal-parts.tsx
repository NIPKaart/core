import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { getOffstreetInfoRows } from '../modal-shared/info-table';
import { copyLocationId, InfoTable } from '../modal-shared/modal-parts';
import { OffstreetParkingDetail } from '../modal-shared/types';

type OffstreetModalContentProps = {
    data: OffstreetParkingDetail;
    latitude: number;
    longitude: number;
    isLoggedIn: boolean;
    copiedSpaceId: boolean;
    setCopiedSpaceId: (x: boolean) => void;
};

export function OffstreetModalContent({ data, isLoggedIn, copiedSpaceId, setCopiedSpaceId }: OffstreetModalContentProps) {
    const { t } = useTranslation('map-parking');

    // Calculate occupancy and color
    const occupancy = data && data.short_capacity > 0 && data.free_space_short != null ? 1 - data.free_space_short / data.short_capacity : null;

    function getOccupancyStatus(occupancy: number | null) {
        if (occupancy === null) return 'grey';
        if (occupancy < 0.7) return 'green';
        if (occupancy < 0.9) return 'orange';
        return 'red';
    }
    const occupancyStatus = getOccupancyStatus(occupancy);

    return (
        <>
            {occupancy !== null && (
                <>
                    <div className="mx-auto my-4 flex w-full max-w-xs flex-col items-center">
                        <div className="mb-2 flex w-full justify-between text-xs">
                            <span>
                                {t('offstreet.available', {
                                    free: data.free_space_short,
                                    total: data.short_capacity,
                                })}
                            </span>
                            <span>
                                {t('offstreet.occupied', {
                                    percent: Math.round(occupancy * 100),
                                })}
                            </span>
                        </div>
                        <Progress
                            value={occupancy * 100}
                            className={`h-2 w-full rounded-full ${
                                occupancyStatus === 'green'
                                    ? '[&>div]:bg-green-500'
                                    : occupancyStatus === 'orange'
                                      ? '[&>div]:bg-orange-400'
                                      : occupancyStatus === 'red'
                                        ? '[&>div]:bg-red-500'
                                        : '[&>div]:bg-zinc-400'
                            } `}
                        />
                        <p className="mt-2 text-center text-xs text-muted-foreground">{t('offstreet.percentage_note')}</p>
                    </div>
                    <p className="mt-4 mb-4 text-center text-sm font-normal text-muted-foreground">{t('offstreet.warning')}</p>
                </>
            )}

            <InfoTable
                rows={getOffstreetInfoRows(data, isLoggedIn, copiedSpaceId, setCopiedSpaceId, (e) => copyLocationId(data, setCopiedSpaceId, e), t)}
            />

            <div className="mt-4">
                <p className="text-center text-xs text-muted-foreground">{t('offstreet.delay_warning')}</p>
            </div>
        </>
    );
}
