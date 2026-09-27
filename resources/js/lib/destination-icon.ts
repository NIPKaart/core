import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function destinationIcon(label: string): L.DivIcon {
    return L.divIcon({
        className: 'destination-marker',
        html: renderToStaticMarkup(
            createElement(
                'span',
                { className: 'destination-marker__badge', role: 'img', 'aria-label': label },
                createElement(MapPin, { size: 36, fill: '#ff7900', stroke: '#fff', strokeWidth: 1.75, 'aria-hidden': true }),
            ),
        ),
        iconSize: [36, 36],
        iconAnchor: [18, 34],
    });
}
