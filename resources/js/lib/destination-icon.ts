import L from 'leaflet';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function destinationIcon(label: string): L.DivIcon {
    return L.divIcon({
        className: 'destination-marker',
        html: renderToStaticMarkup(
            createElement(
                'span',
                { className: 'destination-marker__badge', role: 'img', 'aria-label': label },
                createElement('img', { src: '/assets/images/boards/accessible-pin.png', alt: '', className: 'destination-marker__image' }),
            ),
        ),
        iconSize: [54, 72],
        iconAnchor: [27, 60],
    });
}
