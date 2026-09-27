import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function destinationIcon(label: string, approximate = false): L.DivIcon {
    return L.divIcon({
        className: 'destination-marker',
        html: renderToStaticMarkup(
            createElement(
                'span',
                { className: approximate ? 'destination-marker__area' : 'destination-marker__badge', role: 'img', 'aria-label': label },
                approximate ? null : createElement(MapPin, { className: 'destination-marker__pin', 'aria-hidden': true }),
            ),
        ),
        iconSize: approximate ? [64, 64] : [40, 48],
        iconAnchor: approximate ? [32, 32] : [20, 44],
    });
}
