import app from '@/routes/app';
import type { ParkingMunicipal, ParkingSpace } from '@/types';
import type { Contributor } from './parts';
import type { ChangeGroup, EnumOption, ImprovementValues } from './values';

export type ItemType = 'submission' | 'improvement' | 'report';

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

export type SubmissionDetails = {
    space: { id: string; street: string | null; municipality: string | null };
    current: ImprovementValues;
    nearbySpaces: ParkingSpace[];
    nearbyMunicipalSpaces: Pick<ParkingMunicipal, 'id' | 'latitude' | 'longitude'>[];
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
    reports: { id: number; reporter: string | null; reason: string | null; note: string | null; reported_at: string }[];
    confirmations_since_report: number;
    last_confirmed_at: string | null;
    nearbySpaces: ParkingSpace[];
};

export type SelectedItem =
    | (QueueItem & { type: 'submission'; details: SubmissionDetails })
    | (QueueItem & { type: 'improvement'; details: ImprovementDetails })
    | (QueueItem & { type: 'report'; details: ReportDetails });

export type ItemLink = { type: ItemType; route: RouteParams };

export type Position = { index: number; total: number; previous: ItemLink | null; next: ItemLink | null };

/** One decided item, as ModerationHistory lists it. */
export type HistoryRow = {
    key: string;
    type: ItemType;
    decision: 'approved' | 'rejected' | 'kept' | 'removed';
    street: string | null;
    municipality: string | null;
    contributor: string | null;
    reason: string | null;
    note: string | null;
    reviewer: string | null;
    decided_at: string;
    source?: 'community' | 'municipal';
    reports?: number;
    changes?: ChangeGroup[];
    corrected?: boolean;
    previous?: Partial<ImprovementValues>;
    submitted?: Partial<ImprovementValues>;
    applied?: Partial<ImprovementValues>;
};

export type Filters = { types: ItemType[]; municipality_ids: string[]; search: string | null };

export type Options = {
    types: ItemType[];
    municipalities: { id: number; name: string }[];
    orientations: EnumOption[];
    underSign: EnumOption[];
    restrictionDays: string[];
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
