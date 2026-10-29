import type { MultiPolygon, Point, Polygon } from 'geojson';

export type Claim = {
    source_updated_at?: string | null;
    external_id: string;
    street?: string | null;
    number?: number | null;
    geometry: Polygon | Point;
    source_attributes?: Record<string, unknown>;
    /** Offstreet catalog fields (`nipkaart-offstreet-catalog-3`); capacity is an observation, not a catalog claim. */
    name?: string;
    source_name?: string;
    facility_type?: 'garage' | 'park_and_ride' | 'parking_lot';
};

/** Offstreet facilities are named; municipal spaces are identified by their street. */
export function isFacility(claim: Claim | null | undefined): boolean {
    return claim?.facility_type !== undefined;
}

export function claimTitle(claim: Claim | null | undefined): string | null {
    return (isFacility(claim) ? claim?.name : claim?.street) ?? null;
}

export function claimCapacity(claim: Claim | null | undefined): number | null {
    return claim?.number ?? null;
}
type Derivation = { geometry: Polygon | MultiPolygon; reason: string; method: string; engine: string };
export type Row = {
    identity?: {
        method: string;
        facility_id: string | null;
        candidates: { id: string; name: string; distance_metres: number; same_name: boolean; same_type: boolean; source?: Claim | null }[];
        decision: { reason: string } | null;
    };
    external_id: string;
    status: 'new' | 'changed' | 'missing' | 'conflict' | 'unchanged';
    fields: string[];
    conflicts: string[];
    before: Claim | null;
    after: Claim | null;
    current: Record<string, unknown> | null;
    geometry_derivation?: Derivation | null;
    geometry_review_required?: boolean;
    previous_geometry_derivation?: Derivation | null;
    point?: { latitude: number; longitude: number };
};
