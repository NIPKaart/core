import L, { Icon } from 'leaflet';

export function getInvalidParkingIcon(): Icon {
    return L.icon({
        iconUrl: '/assets/images/boards/e6.jpg',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}
