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
                div.innerHTML += `<h4>Legenda</h4>`;
                div.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-green.png)"></i><span>Genoeg plek</span><br>`;
                div.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-orange.png)"></i><span>Bijna VOL</span><br>`;
                div.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-red.png)"></i><span>VOL</span><br>`;
                div.innerHTML += `<i style="background-image: url(/assets/images/boards/e105-grey.png)"></i><span>Geen data</span><br>`;
                div.innerHTML += `<i style="background-image: url(/assets/images/boards/e6.jpg)"></i><span>Invalide parkeerplek</span><br>`;
                return div;
            }
        });
        const legend: L.Control = new Legend();
        legend.addTo(map);

        return () => {
            legend.remove();
        };
    }, [map, position]);

    return null;
}
