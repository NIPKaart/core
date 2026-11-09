import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/pages/backend/moderation/moderation-map.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
    `${source.replaceAll('import.meta.env.VITE_MAPBOX_ACCESS_TOKEN', '"test-token"')}\nexport { Focus, QueueLegend };`,
    {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
).outputText;

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
            if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === 'react-leaflet') return { useMap: () => map };
            return {};
        },
    };
    vm.runInNewContext(compiled, context);
    const props = { center: { latitude: 52, longitude: 5 }, zoom: 19, bounds: null, inset: 452, focus: 0 };
    return {
        views,
        legend: (pins) => context.exports.QueueLegend({ pins }),
        render: (changes = {}) => context.exports.Focus({ ...props, ...changes }),
    };
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

test('the overview legend lists visible marker types once and distinguishes municipality counts', () => {
    const { legend } = setup();
    const proposal = { legendLabel: 'Location proposal', color: '#1e3a8a' };
    const { props } = legend([proposal, proposal, { legendLabel: 'Open proposals per municipality', color: '#1e3a8a', count: 3 }, {}]);
    assert.equal(props.items.length, 2);
    assert.equal(props.items[0].label, 'Location proposal');
    assert.equal(props.items[0].icon.type, 'svg');
    assert.equal(props.items[1].icon.props.children, '#');
    assert.equal(legend([]).props.items.length, 0);
});
