import type { ContributionForm } from '@/components/contribute/types';
import type { MapPoint } from './geo';

/** The details of a location, which every bay at it shares: what the add flow asks, without the position. */
export type BayDetails = Omit<ContributionForm, 'latitude' | 'longitude'>;

/** A bay placed on the map but not yet submitted. */
export type DraftBay = MapPoint & { id: string; source_point_id: number };

/** A bay read back from Core after publication. */
export type PublishedBay = MapPoint & { number: number };

/** Pins and their shared details can be resumed on this browser. */
export type ProposalDraft = {
    bays: DraftBay[];
    details: BayDetails;
};

export const emptyDetails = (): BayDetails => ({
    orientation: '',
    under_sign: '',
    under_sign_text: '',
    parking_hours: '',
    parking_minutes: '',
    restriction_days: [],
    restriction_starts_at: '',
    restriction_ends_at: '',
    description: '',
});

export const emptyDraft = (): ProposalDraft => ({ bays: [], details: emptyDetails() });

/** The number a draft bay shows: submitted bays keep theirs, new ones follow on. */
export function bayNumber(draft: ProposalDraft, id: string): number {
    return draft.bays.findIndex((bay) => bay.id === id) + 1;
}

export function addBay(draft: ProposalDraft, point: MapPoint, id: string, sourcePointId: number): ProposalDraft {
    return {
        ...draft,
        bays: [...draft.bays, { id, latitude: point.latitude, longitude: point.longitude, source_point_id: sourcePointId }],
    };
}

export function moveBay(draft: ProposalDraft, id: string, point: MapPoint): ProposalDraft {
    return { ...draft, bays: draft.bays.map((bay) => (bay.id === id ? { ...bay, latitude: point.latitude, longitude: point.longitude } : bay)) };
}

export function removeBay(draft: ProposalDraft, id: string): ProposalDraft {
    return { ...draft, bays: draft.bays.filter((bay) => bay.id !== id) };
}

export function setDetail<K extends keyof BayDetails>(draft: ProposalDraft, key: K, value: BayDetails[K]): ProposalDraft {
    return { ...draft, details: { ...draft.details, [key]: value } };
}

/** Orientation and the under-sign answer are required, as in the add flow. */
export function canCheck(draft: ProposalDraft): boolean {
    return draft.bays.length > 0 && draft.details.orientation !== '' && draft.details.under_sign !== '';
}

export function publicationPayload(draft: ProposalDraft) {
    return {
        ...draft.details,
        bays: draft.bays.map(({ latitude, longitude, source_point_id }) => ({ latitude, longitude, source_point_id })),
    };
}

const storageKey = (proposalId: number) => `moderation.location-proposal.batch.${proposalId}`;

/** The saved work for a proposal point, or null when there is none or storage is unavailable. */
export function loadDraft(storage: Pick<Storage, 'getItem'> | undefined, proposalId: number): ProposalDraft | null {
    try {
        const stored = storage?.getItem(storageKey(proposalId));
        if (!stored) return null;
        const parsed = JSON.parse(stored) as Partial<ProposalDraft>;

        return { bays: Array.isArray(parsed.bays) ? parsed.bays : [], details: { ...emptyDetails(), ...parsed.details } };
    } catch {
        return null;
    }
}

export function saveDraft(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, proposalId: number, draft: ProposalDraft): void {
    try {
        if (draft.bays.length === 0 && JSON.stringify(draft.details) === JSON.stringify(emptyDetails())) {
            storage?.removeItem(storageKey(proposalId));
            return;
        }
        storage?.setItem(storageKey(proposalId), JSON.stringify(draft));
    } catch {
        // The work is simply not remembered.
    }
}

/** The browser's storage, or undefined where it cannot be reached. */
export function browserStorage(): Storage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}
