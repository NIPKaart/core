export type DestinationResult = {
    key: string;
    label: string;
    sub: string | null;
    type: string;
    latitude: number;
    longitude: number;
};

export type ParkingResult = {
    key: string;
    id: string;
    source: 'community' | 'municipal' | 'offstreet';
    latitude: number;
    longitude: number;
    title: string;
    distance_metres: number | null;
};
