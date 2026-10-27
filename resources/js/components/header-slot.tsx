import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Side = 'start' | 'end';
type Slots = Record<Side, HTMLElement | null>;

const HeaderSlots = createContext<{ slots: Slots; setSlot: (side: Side, element: HTMLElement | null) => void } | null>(null);

/** Lets a page place its own controls in the app header, beside the breadcrumbs and before search. */
export function HeaderSlotsProvider({ children }: { children: React.ReactNode }) {
    const [slots, setSlots] = useState<Slots>({ start: null, end: null });
    const setSlot = useCallback(
        (side: Side, element: HTMLElement | null) => setSlots((current) => (current[side] === element ? current : { ...current, [side]: element })),
        [],
    );
    const value = useMemo(() => ({ slots, setSlot }), [slots, setSlot]);

    return <HeaderSlots.Provider value={value}>{children}</HeaderSlots.Provider>;
}

/** Where page controls appear inside the header. */
export function HeaderSlotTarget({ side, className }: { side: Side; className?: string }) {
    const setSlot = useContext(HeaderSlots)?.setSlot;
    const ref = useCallback((element: HTMLDivElement | null) => setSlot?.(side, element), [setSlot, side]);

    return <div ref={ref} className={className} />;
}

/** Renders its children in the app header: `start` after the breadcrumbs, `end` before search. */
export function HeaderSlot({ side, children }: { side: Side; children: React.ReactNode }) {
    const target = useContext(HeaderSlots)?.slots[side];

    return target ? createPortal(children, target) : null;
}
