import { ParkingConfirmForm } from '@/pages/frontend/form/form-confirm-location';
import type { ParkingSpaceDetail } from '../modal-shared/types';

export function ConfirmTab({
    data,
    confirmationStatusOptions,
    onConfirmed,
}: {
    data: ParkingSpaceDetail;
    confirmationStatusOptions: Record<string, string>;
    onConfirmed: () => void;
}) {
    return (
        <div className="py-3">
            <ParkingConfirmForm
                spaceId={data.id}
                onConfirmed={onConfirmed}
                confirmationStatusOptions={confirmationStatusOptions}
                confirmedToday={!!data.confirmed_today}
            />
        </div>
    );
}

export function DescriptionTab({ description }: { description: string }) {
    if (!description) return null;
    return (
        <div className="relative mb-2 rounded-xl border border-orange-100 bg-orange-50/70 px-6 py-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/60">
            <div className="absolute top-0 left-0 h-full w-1 rounded-tl-xl rounded-bl-xl bg-orange-400" />
            <div className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
                <div>
                    <div className="mb-1 text-base font-semibold text-orange-800 dark:text-orange-200">Description</div>
                    <div className="text-sm text-orange-900 dark:text-orange-100">{description}</div>
                </div>
            </div>
        </div>
    );
}
