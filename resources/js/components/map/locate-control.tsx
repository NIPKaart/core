import { LocateControl as LeafletLocateControl } from 'leaflet.locatecontrol';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
import { LocateFixed } from 'lucide-react';
import { createElement, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import { useMap } from 'react-leaflet';

interface Props {
    position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

export default function LocateControl({ position = 'topleft' }: Props) {
    const map = useMap();
    const { t } = useTranslation('frontend/map/main');

    useEffect(() => {
        const locateControl = new LeafletLocateControl({
            position,
            icon: 'discovery-locate-icon',
            iconLoading: 'discovery-locate-loading',
            createButtonCallback: (container) => {
                const link = document.createElement('a');
                link.href = '#';
                link.title = t('toolbar.locate');
                link.setAttribute('role', 'button');
                link.setAttribute('aria-label', t('toolbar.locate'));
                const icon = document.createElement('span');
                icon.className = 'discovery-locate-icon';
                icon.innerHTML = renderToStaticMarkup(createElement(LocateFixed, { size: 22, 'aria-hidden': true }));
                link.append(icon);
                container.append(link);
                return { link, icon };
            },
            flyTo: true,
            showPopup: false,
            drawCircle: true,
            keepCurrentZoomLevel: false,
            strings: {
                title: t('toolbar.locate'),
            },
            locateOptions: {
                enableHighAccuracy: true,
            },
        });

        map.addControl(locateControl);

        return () => {
            locateControl.stop();
            map.removeControl(locateControl);
        };
    }, [map, position, t]);

    return null;
}
