import { ParkingOffstreet } from '@/types';
import L, { Icon } from 'leaflet';

/**
 * Icon for green markers.
 */
export function getGreenMarkerIcon(): Icon {
    return L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for orange markers.
 */
export function getOrangeMarkerIcon(): Icon {
    return L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for red markers.
 */
export function getRedMarkerIcon(): Icon {
    return L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for blue markers.
 */
export function getBlueMarkerIcon(): Icon {
    return L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for invalid parking spaces.
 */
export function getInvalidParkingIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e6.jpg',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for parking garage: green (sufficient space).
 */
export function getGarageGreenIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e105-green.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for parking garage: orange (almost full).
 */
export function getGarageOrangeIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e105-orange.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for parking garage: red (full).
 */
export function getGarageRedIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e105-red.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
        shadowSize: [41, 41],
    });
}

/**
 * Icon for parking garage: no data / old / error.
 */
export function getGarageGreyIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e105-grey.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
        shadowSize: [41, 41],
    });
}

/**
 * Get the icon for a parking garage based on its status.
 */
export function getGarageStatusIcon(status: 'green' | 'orange' | 'red' | 'grey'): Icon {
    switch (status) {
        case 'green':
            return getGarageGreenIcon();
        case 'orange':
            return getGarageOrangeIcon();
        case 'red':
            return getGarageRedIcon();
        case 'grey':
            return getGarageGreyIcon();
        default:
            return getGarageGreyIcon();
    }
}

/**
 * Get the icon for a parking space based on its status.
 */
export function getParkingStatusIcon(status: 'approved' | 'pending' | 'rejected' | string): Icon {
    switch (status) {
        case 'approved':
            return getGreenMarkerIcon();
        case 'pending':
            return getOrangeMarkerIcon();
        case 'rejected':
            return getRedMarkerIcon();
        default:
            return getBlueMarkerIcon();
    }
}

/*
 * Get the occupancy status of a parking garage based on its details.
 * Returns 'green', 'orange', 'red', or 'grey'.
 */
export function getGarageOccupancyStatus(space: ParkingOffstreet): 'green' | 'orange' | 'red' | 'grey' {
    if (typeof space.api_state === 'string' && space.api_state !== 'ok') {
        return 'grey';
    }
    if (typeof space.free_space_short !== 'number' || typeof space.short_capacity !== 'number' || space.short_capacity === 0) {
        return 'grey';
    }
    const occupied = space.short_capacity - space.free_space_short;
    const occupancy = occupied / space.short_capacity;

    if (occupancy < 0.6) return 'green'; // less than 60% full
    if (occupancy < 0.9) return 'orange'; // between 60% and 90% full
    return 'red'; // 90% or more full
}
