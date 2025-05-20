import L, { Icon } from 'leaflet';

/**
 * Icon for invalid parking spots.
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
        iconUrl: '/assets/images/boards/v2/e105-orange.png',
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
        iconUrl: '/assets/images/boards/v2/e105-red.png',
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
        iconUrl: '/assets/images/boards/v2/e105-grey.png',
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
        case 'green': return getGarageGreenIcon();
        case 'orange': return getGarageOrangeIcon();
        case 'red': return getGarageRedIcon();
        case 'grey': return getGarageGreyIcon();
        default: return getGarageGreyIcon();
    }
}