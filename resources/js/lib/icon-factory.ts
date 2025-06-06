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
