import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface LegendControlProps {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

export default function LegendControl({ position = 'bottomleft' }: LegendControlProps) {
    const map = useMap();

    useEffect(() => {
        const Legend = L.Control.extend({
            options: { position },
            onAdd: () => {
                const div = L.DomUtil.create('div', 'leaflet-legend');

                // Add a class to collapse the legend on mobile
                if (window.innerWidth <= 640) {
                    div.classList.add('collapsed');
                }

                // Toggle button
                const toggle = L.DomUtil.create('button', 'legend-toggle', div);
                toggle.innerText = 'Legenda';
                toggle.onclick = () => {
                    div.classList.toggle('collapsed');
                };

                // Close button
                const close = L.DomUtil.create('button', 'legend-close', div);
                close.innerHTML = '&times;';
                close.onclick = () => {
                    div.classList.add('collapsed');
                };

                const content = L.DomUtil.create('div', 'legend-content', div);
                content.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-green.png)"></i><span>Genoeg plek</span><br>`;
                content.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-orange.png)"></i><span>Bijna VOL</span><br>`;
                content.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-red.png)"></i><span>VOL</span><br>`;
                content.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-grey.png)"></i><span>Geen data</span><br>`;
                content.innerHTML += `<i style="background-image: url(/assets/images/boards/e6.jpg)"></i><span>Invalide parkeerplek</span><br>`;

                return div;
            },
        });

        const legend: L.Control = new Legend();
        legend.addTo(map);

        return () => {
            map.removeControl(legend);
        };
    }, [map, position]);

    return null;
}
