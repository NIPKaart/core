export type ParkingStatusOption = {
    value: string;
    label: string;
    description: string;
    icon: LucideIcon;
};

export type ParkingStatus = 'pending' | 'approved' | 'rejected';
export type ParkingOrientation = 'parallel' | 'perpendicular' | 'angle';
