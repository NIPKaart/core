import app from '@/routes/app';
import type { PaginatedResponse, ParkingMunicipal, ParkingSpace, RestrictionDay } from '@/types';
import type { CommunityPointsProfile, Contributor } from './parts';
import type { ChangeGroup, EnumOption, ImprovementValues } from './values';

export type ItemType = 'submission' | 'improvement' | 'report';
export type HistoryType = ItemType | 'proposal';

type RouteParams = { parking_space: string } | { improvement: number } | { source: 'community' | 'municipal'; id: string };

/** One open item in the queue, as ModerationQueue lists it. */
export type QueueItem = {
    key: string;
    type: ItemType;
    priority: 'high' | 'normal';
    waiting_since: string;
    route: RouteParams;
    street: string | null;
    municipality: string | null;
    latitude: number;
    longitude: number;
    /** For a reported place: the latest note or reason its reporters gave. */
    preview?: string | null;
    contributor: Contributor | null;
    source?: 'community' | 'municipal';
    changes?: ChangeGroup[];
    distance_metres?: number | null;
    flags: {
        nearby_municipal_metres?: number | null;
        other_municipality?: string | true | null;
        competing?: boolean;
        reported?: boolean;
        reports?: number;
    };
};

/** The nearest visible municipal place, to compare a submission or reported place with. */
export type NearestMunicipal = { id: string; street: string | null; orientation: string | null; number: number | null; distance_metres: number };

export type TimelineKind = 'added' | 'approved' | 'confirmed' | 'moved' | 'unavailable' | 'reported' | 'improvement' | 'improved';

/** What a moderator can check about a published or reported place. */
export type Evidence = {
    timeline: { kind: TimelineKind; at: string }[];
    confirmed_total: number;
    last_confirmed_at: string | null;
    unavailable_since_confirmation: number;
    nearest_municipal: NearestMunicipal | null;
};

export type SubmissionDetails = {
    space: { id: string; street: string | null; municipality: string | null };
    current: ImprovementValues;
    nearbySpaces: ParkingSpace[];
    nearbyMunicipalSpaces: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
    nearestMunicipal: NearestMunicipal | null;
};

export type ImprovementDetails = {
    id: number;
    submitted_at: string;
    space: { id: string; street: string | null; municipality: string | null; published: boolean; confirmations: number };
    current: ImprovementValues;
    submitted: Partial<ImprovementValues>;
    changes: ChangeGroup[];
    distance_metres: number | null;
    nearbySpaces: ParkingSpace[];
    evidence: Evidence;
};

export type ReportDetails = {
    source: 'community' | 'municipal';
    id: string;
    street: string | null;
    municipality: string | null;
    latitude: number;
    longitude: number;
    published: boolean;
    first_reported_at: string;
    last_reported_at: string;
    reports: {
        id: number;
        reporter: string | null;
        reason: string | null;
        reason_key: 'sign_removed' | 'now_regular_bay' | 'other' | null;
        note: string | null;
        reported_at: string;
        community_points?: CommunityPointsProfile | null;
    }[];
    confirmations_since_report: number;
    last_confirmed_at: string | null;
    nearbySpaces: ParkingSpace[];
    evidence: Evidence;
};

export type SelectedItem =
    | (QueueItem & { type: 'submission'; details: SubmissionDetails })
    | (QueueItem & { type: 'improvement'; details: ImprovementDetails })
    | (QueueItem & { type: 'report'; details: ReportDetails });

export type ItemLink = { key?: string; type: ItemType; route: RouteParams; street?: string | null };

export type Position = { index: number; total: number; previous: ItemLink | null; next: ItemLink | null };

/** One decided item, as ModerationHistory lists it. */
export type HistoryRow = {
    key: string;
    type: HistoryType;
    decision: 'approved' | 'rejected' | 'kept' | 'removed' | 'completed';
    street: string | null;
    municipality: string | null;
    contributor: string | null;
    reason: string | null;
    note: string | null;
    reviewer: string | null;
    decided_at: string;
    /** Where the decision happened; null when the place is gone without a trace. */
    latitude: number | null;
    longitude: number | null;
    source?: 'community' | 'municipal';
    reports?: number;
    changes?: ChangeGroup[];
    corrected?: boolean;
    previous?: Partial<ImprovementValues>;
    submitted?: Partial<ImprovementValues>;
    applied?: Partial<ImprovementValues>;
    proposal?: {
        id: number;
        reopen_revision: number | null;
        source: string | null;
        last_seen_on: string | null;
        total_bays: number;
        orientation: string | null;
        under_sign: string | null;
        restriction: string | null;
        parking_time: number | null;
        restriction_days: RestrictionDay[] | null;
        restriction_starts_at: string | null;
        restriction_ends_at: string | null;
        bays: { id: string; number: number; url: string | null }[];
        existing_url: string | null;
    };
};

/** A page of decisions; paged without a total, because counting would read every decision ever taken. */
export type HistoryPage = Pick<
    PaginatedResponse<HistoryRow>,
    'data' | 'current_page' | 'from' | 'to' | 'per_page' | 'prev_page_url' | 'next_page_url'
>;

export type Filters = { types: HistoryType[]; municipality_ids: string[]; search: string | null };

export type Options = {
    types: ItemType[];
    historyTypes: HistoryType[];
    municipalities: { id: number; name: string }[];
    /** With the description the add flow shows on its choice cards. */
    orientations: (EnumOption & { description: string })[];
    underSign: EnumOption[];
    restrictionDays: RestrictionDay[];
    changes: ChangeGroup[];
    reasons: Record<ItemType, EnumOption[]>;
    bulkReasons: EnumOption[];
    can: Record<ItemType, boolean>;
};

/** The filters as query parameters, so every visit and decision keeps the moderator's view. */
export function filterQuery(filters: Filters): Record<string, string> {
    const query: Record<string, string> = {};
    if (filters.types.length) query.type = filters.types.join(',');
    if (filters.municipality_ids.length) query.municipality_id = filters.municipality_ids.join(',');
    if (filters.search) query.search = filters.search;
    return query;
}

/** The review address of a queue item. */
export function itemUrl(link: ItemLink, query: Record<string, string> = {}): string {
    const options = { query };
    switch (link.type) {
        case 'submission':
            return app.moderation.submissions.show.url(link.route as { parking_space: string }, options);
        case 'improvement':
            return app.moderation.improvements.show.url(link.route as { improvement: number }, options);
        case 'report':
            return app.moderation.reports.show.url(link.route as { source: string; id: string }, options);
    }
}
