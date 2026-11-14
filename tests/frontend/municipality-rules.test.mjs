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
            totals: { spaces: 0, garages: 1 },
            sources: { municipal: [], facilities: true },
            rules: [],
            gpkwijs_url: null,
            ...props,
        }),
    );
}

test('municipality pages hide GPKwijs guidance during the outage', async () => {
    const html = await municipality({ gpkwijs_url: 'https://www.gpkwijs.nl/gemeente/amsterdam' });

    assert.doesNotMatch(html, /gpkwijs/i);
    assert.match(html, /Controleer de borden/);
    assert.match(html, /Lokale parkeerregels onbekend/);
    assert.match(html, /<strong>Samenwerken\?<\/strong>/);
});

test('national rules remain available when local rules are unknown', async () => {
    const html = await municipality({
        rules: [{ scope: 'country', name: 'Nederland', url: 'https://example.com/regels', host: 'example.com' }],
    });

    assert.match(html, /href="https:\/\/example\.com\/regels"/);
    assert.match(html, /Officiële landelijke regels voor Nederland/);
    assert.match(html, /Lokale parkeerregels onbekend/);
});

test('municipality pages distinguish missing spaces from missing local rules', async () => {
    for (const indexable of [true, false]) {
        const html = await municipality({ indexable });

        assert.match(html, /Nog geen gehandicaptenparkeerplaatsen bekend/);
        assert.match(html, /Lokale parkeerregels onbekend/);
        assert.equal(html.includes('Geen actuele bezettingsmeting'), indexable);
        assert.match(html, /Neem contact op/);
    }
});

test('municipal rules suppress the missing local rules notice', async () => {
    const html = await municipality({
        rules: [{ scope: 'municipality', name: 'Amsterdam', url: 'https://example.com/regels', host: 'example.com' }],
    });

    assert.match(html, /href="https:\/\/example\.com\/regels"/);
    assert.match(html, /Officiële gemeentelijke regels voor Amsterdam/);
    assert.doesNotMatch(html, /Lokale parkeerregels onbekend/);
});

test('municipal verification shows a localized percentage that matches the breakdown', async () => {
    const html = await municipality({ totals: { spaces: 1430, verified: 1426, garages: 1 } });

    assert.match(html, />99,7%<\/span> <span[^>]*>van de 1\.430 parkeerplaatsen geverifieerd/);
    assert.match(html, /aria-label="1\.426 van 1\.430 parkeerplaatsen geverifieerd"/);
    assert.doesNotMatch(html, /Community:/);
});

test('municipal verification only shows 100% when all spaces are verified', async () => {
    const partial = await municipality({ totals: { spaces: 10000, verified: 9999, garages: 1 } });
    const full = await municipality({ totals: { spaces: 10000, verified: 10000, garages: 1 } });

    assert.match(partial, />&gt;99,9%<\/span>/);
    assert.match(full, />100%<\/span>/);
});
