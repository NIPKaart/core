import L from 'leaflet';
import { Flag } from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function destinationIcon(label: string): L.DivIcon {
    return L.divIcon({
        className: 'destination-marker',
        html: renderToStaticMarkup(
            createElement(
                'span',
                { className: 'destination-marker__badge', role: 'img', 'aria-label': label },
                createElement(Flag, { size: 18, fill: 'currentColor', 'aria-hidden': true }),
            ),
        ),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    });
}
