import { getEcho } from '@/echo';
import { useAuthorization } from '@/hooks/use-authorization';
import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

/** Browser event re-dispatching every dataset change to the page. */
export const DATASET_EVENT = 'nipkaart:dataset-changed';

export type DatasetChange = { scope: 'sources' | 'deliveries' | 'imports' | 'observations'; target_type: 'municipal' | 'offstreet' | null };

/**
 * Subscribes once per layout to the private `datasets` channel for users who may see imported data.
 * Pages react through {@link useDatasetChanges}, so leaving one page never unsubscribes another.
 */
export function useDatasetChannel(): void {
    const { can, hasRole } = useAuthorization();
    const allowed = hasRole('admin') || can('parking-offstreet.view_any') || can('parking-municipal.view_any');

    useEffect(() => {
        if (!allowed) return;
        const echo = getEcho();
        if (!echo) return;

        const channel = echo.private('datasets');
        channel.listen('.dataset.changed', (change: DatasetChange) => {
            // The sidebar counts sources needing attention; live occupancy does not change it.
            if (change.scope !== 'observations') {
                router.reload({ only: ['counts'] });
            }
            window.dispatchEvent(new CustomEvent(DATASET_EVENT, { detail: change }));
        });

        return () => {
            channel.stopListening('.dataset.changed');
            echo.leave('datasets');
        };
    }, [allowed]);
}

/** Calls `onChange` for every live dataset change while the component is mounted. */
export function useDatasetChanges(onChange: (change: DatasetChange) => void): void {
    const handler = useRef(onChange);
    handler.current = onChange;

    useEffect(() => {
        const listener = (event: Event) => handler.current((event as CustomEvent<DatasetChange>).detail);
        window.addEventListener(DATASET_EVENT, listener);

        return () => window.removeEventListener(DATASET_EVENT, listener);
    }, []);
}
