export type Hit = Readonly<{
    id: string | number | null;
    index: string;
    type: 'municipal' | 'offstreet' | 'community' | 'other';
    label: string;
    sub?: string | null;
    href: string;
    score?: number | null;
    lat?: number | null;
    lng?: number | null;
}>;
