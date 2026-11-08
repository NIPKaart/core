import i18next from 'i18next';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const areaParts = 'components/frontend/areas/area-parts';

function loadModule(path, resolve) {
    const { outputText } = ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}.tsx`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    const context = { exports: {}, require: resolve };
    vm.runInNewContext(outputText.replaceAll('import.meta.env.VITE_MAPBOX_ACCESS_TOKEN', 'undefined'), context);

    return context.exports;
}

async function municipality(props = {}) {
    const i18n = i18next.createInstance();
    const areas = JSON.parse(readFileSync(new URL('../../resources/locales/frontend/nl/areas.json', import.meta.url), 'utf8'));
    await i18n.init({ lng: 'nl', resources: { nl: { areas } } });

    function resolve(name) {
        switch (name) {
            case `@/${areaParts}`:
                return loadModule(areaParts, resolve);
            case '@/components/frontend/footer':
            case 'leaflet':
            case 'react-leaflet':
                return { default: () => null };
            case '@/layouts/frontend-layout':
                return { default: ({ children }) => children };
            case '@/routes':
                return { contact: () => ({ url: '/contact?topic=data' }), garages: () => ({ url: '/garages' }) };
            case '@/routes/location-map':
                return { add: () => ({ url: '/map/add' }) };
            case '@/lib/pin-svg':
                return { pinSvg: () => '' };
            case '@/lib/utils':
                return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            case '@/locale-sync':
                return { formatLocale: () => 'nl-NL' };
            case '@inertiajs/react':
                return { Head: () => null, Link: (attributes) => React.createElement('a', attributes) };
            case 'react-i18next':
                return { useTranslation: () => ({ t: i18n.getFixedT('nl', 'areas'), i18n }) };
            default:
                return require(name);
        }
    }

    const { default: Municipality } = loadModule('pages/frontend/areas/municipality', resolve);

    return renderToStaticMarkup(
        React.createElement(Municipality, {
            name: 'Amsterdam',
            indexable: true,
            country: { name: 'Nederland' },
            breadcrumbs: [],
            neighbours: [],
            totals: { garages: 1 },
            sources: { municipal: [], facilities: true },
            rules: [],
            gpkwijs_url: null,
            ...props,
        }),
    );
}

test('GPKwijs stands on its own when there are no official rules', async () => {
    const html = await municipality({ gpkwijs_url: 'https://gpkwijs.nl/amsterdam' });

    assert.match(html, /href="https:\/\/gpkwijs\.nl\/amsterdam"/);
    assert.match(html, /Parkeeruitleg van GPKwijs/);
    assert.match(html, /Controleer de borden/);
    assert.doesNotMatch(html, /parkeerregels zijn bij NIPKaart nog niet bekend/);
    assert.match(html, /<strong>Samenwerken\?<\/strong>/);
});

test('available national rules are shown without a notice about missing local rules', async () => {
    const html = await municipality({
        rules: [{ scope: 'country', name: 'Nederland', url: 'https://example.com/regels', host: 'example.com' }],
    });

    assert.match(html, /href="https:\/\/example\.com\/regels"/);
    assert.match(html, /Officiële landelijke regels voor Nederland/);
    assert.doesNotMatch(html, /lokale parkeerregels zijn bij NIPKaart nog niet bekend/);
});

test('municipality pages omit the rules section when there are no links', async () => {
    for (const indexable of [true, false]) {
        const html = await municipality({ indexable });

        assert.doesNotMatch(html, /aria-labelledby="rules"|Controleer de borden/);
        assert.match(html, /Neem contact op/);
    }
});
