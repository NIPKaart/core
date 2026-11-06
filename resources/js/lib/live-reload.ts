import { router } from '@inertiajs/react';

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let listening = false;

/** Combine layout and page invalidations from a burst of broadcasts into one silent partial reload. */
export function scheduleLiveReload(only: string[]): void {
    if (!listening) {
        listening = true;
        router.on('before', (event) => {
            if (!event.detail.visit.async) {
                // Do not carry props requested by the old page into a new navigation or action.
                pending.clear();
                clearTimeout(timer);
                timer = undefined;
            }
        });
    }

    only.forEach((prop) => pending.add(prop));
    if (timer !== undefined || inFlight) return;

    timer = setTimeout(() => {
        timer = undefined;
        const props = [...pending];
        pending.clear();
        inFlight = true;
        router.reload({
            only: props,
            showProgress: false,
            onFinish: () => {
                inFlight = false;
                if (pending.size > 0) scheduleLiveReload([]);
            },
        });
    }, 75);
}
