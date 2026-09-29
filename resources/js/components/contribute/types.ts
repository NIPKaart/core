export type OrientationOption = { value: string; label: string; description: string };

export type ContributionForm = {
    latitude: number | null;
    longitude: number | null;
    orientation: string;
    under_sign: '' | 'yes' | 'no';
    under_sign_text: string;
    parking_hours: string;
    parking_minutes: string;
    restriction_days: string[];
    restriction_starts_at: string;
    restriction_ends_at: string;
    description: string;
};

export type ResolvedLocation = { street: string | null; municipality: string; province: string | null; country: string };

export type PinLocation =
    | { status: 'zoom' }
    | { status: 'resolving' }
    | { status: 'resolved'; location: ResolvedLocation; nearbyMetres: number | null }
    | { status: 'failed'; message: string };

export type ContributionStep = 1 | 2 | 3;
