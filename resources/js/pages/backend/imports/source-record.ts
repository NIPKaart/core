import type { Geometry, LineString, MultiLineString, MultiPolygon, Point, Polygon } from 'geojson';

export type Claim = {
    source_updated_at?: string | null;
    external_id: string;
    street?: string | null;
    number?: number | null;
    /** The source's own shape, as the delivery contract accepts it. */
    geometry: Point | LineString | MultiLineString | Polygon | MultiPolygon;
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

/** Frame the source, proposed geometry and actual display marker, plus only the explicitly selected identity candidate. */
export function reviewGeometries(row: Row, candidateId: string): Geometry[] {
    const candidate = row.identity?.candidates.find((item) => item.id === candidateId);
    return [
        (row.after ?? row.before)?.geometry,
        row.geometry_derivation?.geometry,
        row.point ? { type: 'Point' as const, coordinates: [row.point.longitude, row.point.latitude] } : undefined,
        candidate?.source?.geometry,
    ].filter((geometry): geometry is NonNullable<typeof geometry> => geometry !== undefined);
}

export type GeometryIssueKind =
    'self_intersection' | 'too_few_points' | 'hole_outside_shell' | 'nested_shells' | 'interior_disconnected' | 'ring_not_closed' | 'other';

/**
 * Reads PostGIS' ST_IsValidReason ("Self-intersection[4.78 52.38]") into a kind a reviewer can be told about in plain
 * words and the point where the shape goes wrong, when the reason names one.
 */
export function geometryIssue(reason: string): { kind: GeometryIssueKind; point: { latitude: number; longitude: number } | null } {
    const match = /^(.*?)\s*\[\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*\]\s*$/.exec(reason.trim());
    const label = (match?.[1] ?? reason).trim().toLowerCase();
    const kinds: [string, GeometryIssueKind][] = [
        ['self-intersection', 'self_intersection'],
        ['too few points', 'too_few_points'],
        ['hole lies outside shell', 'hole_outside_shell'],
        ['nested shells', 'nested_shells'],
        ['interior is disconnected', 'interior_disconnected'],
        ['ring is not closed', 'ring_not_closed'],
    ];

    return {
        kind: kinds.find(([text]) => label.includes(text))?.[1] ?? 'other',
        point: match ? { longitude: Number(match[2]), latitude: Number(match[3]) } : null,
    };
}
