import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/pages/backend/moderation/moderation-map.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`${source.replaceAll('import.meta.env.VITE_MAPBOX_ACCESS_TOKEN', '"test-token"')}\nexport { Focus };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function setup(reducedMotion = false) {
    const views = [];
    const previous = { current: null };
    const map = {
        getZoom: () => 20,
        project: ([lat, lng]) => ({ subtract: ([x]) => ({ lat, lng: lng - x }) }),
        unproject: (point) => point,
        setView: (point, zoom, options) => views.push({ point, zoom, ...options }),
    };
    const context = {
        exports: {},
        window: { matchMedia: () => ({ matches: reducedMotion }) },
        require: (name) => {
            if (name === '@/lib/pin-svg') return { pinSvg: () => '' };
            if (name === 'leaflet') return { default: { divIcon: () => ({}) } };
            if (name === 'react') return { useRef: () => previous, useEffect: (effect) => effect() };
            if (name === 'react-leaflet') return { useMap: () => map };
            return {};
        },
    };
    vm.runInNewContext(compiled, context);
    const props = { center: { latitude: 52, longitude: 5 }, zoom: 19, bounds: null, inset: 452, focus: 0 };
    return { views, render: (changes = {}) => context.exports.Focus({ ...props, ...changes }) };
}

test('opening and closing the editor pans smoothly and preserves the map zoom', () => {
    const { views, render } = setup();
    render();
    render({ inset: 848 });
    render();

    assert.equal(views[0].animate, false);
    assert.equal(views[0].zoom, 19);
    assert.equal(views[1].animate, true);
    assert.equal(views[1].duration, 0.3);
    assert.equal(views[1].zoom, 20);
    assert.equal(views[1].point.lng, 5 - 848 / 2);
    assert.equal(views[2].animate, true);
    assert.equal(views[2].point.lng, 5 - 452 / 2);
});

test('reduced motion opens the editor without an animated map pan', () => {
    const { views, render } = setup(true);
    render();
    render({ inset: 848 });

    assert.equal(views[1].animate, false);
    assert.equal(views[1].zoom, 20);
});

test('changing items or explicitly recentering restores the item view directly', () => {
    const { views, render } = setup();
    render();
    render({ inset: 848, center: { latitude: 53, longitude: 6 } });
    render({ focus: 1 });

    assert.equal(views[1].animate, false);
    assert.equal(views[1].zoom, 19);
    assert.equal(views[1].point.lat, 53);
    assert.equal(views[2].animate, false);
    assert.equal(views[2].zoom, 19);
});
