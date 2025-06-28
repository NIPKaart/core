import { EnumOption } from "./types";

export function getOrientationIllustration(orientation: EnumOption | null) {
    if (!orientation) return '/assets/images/car-illu.svg';
    const key = orientation.value;
    if (key === 'perpendicular') return '/assets/images/orientation/perpendicular.png';
    if (key === 'parallel') return '/assets/images/orientation/parallel.png';
    if (key === 'angle') return '/assets/images/orientation/angle.png';
    return '/assets/images/car-illu.svg';
}

export function formatParkingTime(minutes?: number | null) {
    if (!minutes) return 'Unlimited';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h} ${h === 1 ? 'hour' : 'hours'} ${m} min`;
    if (h) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    if (m) return `${m} min`;
    return 'Unlimited';
}
