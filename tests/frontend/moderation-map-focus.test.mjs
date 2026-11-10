import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/pages/backend/moderation/moderation-map.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(
    `${source.replaceAll('import.meta.env.VITE_MAPBOX_ACCESS_TOKEN', '"test-token"')}\nexport { BayPin, Focus, queueLegend };`,
    {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
).outputText;

function setup(reducedMotion = false, currentZoom = 20) {
    const views = [];
    const refs = [];
    let refIndex = 0;
    const map = {
        getZoom: () => currentZoom,
        project: ([lat, lng]) => ({ subtract: ([x, y]) => ({ lat: lat - y, lng: lng - x }) }),
        unproject: (point) => point,
        setView: (point, zoom, options) => views.push({ point, zoom, ...options }),
    };
    const jsx = (type, props) => ({ type, props });
    const context = {
        exports: {},
        window: { matchMedia: () => ({ matches: reducedMotion }) },
        require: (name) => {
            if (name === '@/components/map/parking-detail/navigation-handoff') return { streetViewUrl: () => null };
            if (name === '@/lib/pin-svg') return { pinSvg: () => '' };
            if (name === 'leaflet') return { default: { divIcon: () => ({}) } };
            if (name === 'react') return { useRef: (value) => (refs[refIndex++] ??= { current: value }), useEffect: (effect) => effect() };
            if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === 'react-leaflet') return { useMap: () => map };
            return {};
        },
    };
    vm.runInNewContext(compiled, context);
    const props = { center: { latitude: 52, longitude: 5 }, zoom: 19, bounds: null, inset: 452, focus: 0 };
    return {
        views,
        renderBay: (props) => context.exports.BayPin(props),
        legend: (pins) => context.exports.queueLegend(pins),
        render: (changes = {}) => {
            refIndex = 0;
            return context.exports.Focus({ ...props, ...changes });
        },
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

test('on a small screen the item sits in the middle of the map above the sheet, and lowering the sheet pans to it', () => {
    const { views, render } = setup();
    render({ inset: 0, insetBottom: 380 });
    render({ inset: 0, insetBottom: 256 });

    assert.equal(views[0].point.lat, 52 + 380 / 2);
    assert.equal(views[0].animate, false);
    assert.equal(views[1].point.lat, 52 + 256 / 2);
    assert.equal(views[1].animate, true);
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

test('opening from the queue focuses the proposal and returning keeps the viewport', () => {
    const { views, render } = setup(false, 13);
    render({ overviewKey: '1:open:1' });
    render({ reviewKey: '12', center: { latitude: 53, longitude: 6 } });
    assert.equal(views[1].zoom, 19);
    assert.equal(views[1].point.lat, 53);
    render({ reviewKey: '13', center: { latitude: 54, longitude: 6 } });
    render({ overviewKey: '1:open:1' });
    assert.equal(views.length, 2);

    render({ overviewKey: '1:open:1', focus: 1 });
    assert.equal(views.length, 3);
});

test('changing the visible proposals within a municipality keeps the viewport', () => {
    const { views, render } = setup();
    render({ overviewKey: '1' });
    render({ overviewKey: '1', center: { latitude: 53, longitude: 6 } });
    assert.equal(views.length, 1);

    render({ overviewKey: '2', center: { latitude: 54, longitude: 6 } });
    assert.equal(views[1].point.lat, 54);
});

test('a sidebar focus request recentres the proposal at the current zoom, even on repeated clicks', () => {
    const { views, render } = setup();
    render({ reviewKey: '12' });
    render({ reviewKey: '12', focusRequest: 1 });
    render({ reviewKey: '12', focusRequest: 2 });
    assert.deepEqual(views.slice(1).map(({ zoom, point }) => [zoom, point.lat]), [[20, 52], [20, 52]]);
});

test('a sidebar focus request zooms in when the map is at overview scale', () => {
    const { views, render } = setup(false, 13);
    render({ reviewKey: '12' });
    render({ reviewKey: '12', focusRequest: 1 });
    assert.equal(views[1].zoom, 19);
});

test('the overview legend lists visible marker types once and distinguishes municipality counts', () => {
    const { legend } = setup();
    const proposal = { legendLabel: 'Location proposal', color: '#1e3a8a' };
    const items = legend([proposal, proposal, { legendLabel: 'Open proposals per municipality', color: '#1e3a8a', count: 3 }, {}]);
    assert.equal(items.length, 2);
    assert.equal(items[0].label, 'Location proposal');
    assert.equal(items[0].icon.type, 'svg');
    assert.equal(items[1].icon.props.children, '#');
    assert.equal(legend([]).length, 0);
});

function renderMap(props) {
    const pans = [];
    const fits = [];
    const map = { panInside: (point, options) => pans.push({ point, options }) };
    const context = {
        exports: {},
        window: { matchMedia: () => ({ matches: false }) },
        require: (name) => {
            if (name === '@/lib/pin-svg') return { pinSvg: () => '' };
            if (name === 'leaflet') return { default: { divIcon: () => ({}), latLngBounds: (points) => fits.push(points) } };
            if (name === 'react')
                return {
                    useRef: (value) => ({ current: value }),
                    useEffect: (effect) => effect(),
                    useMemo: (fn) => fn(),
                    useState: (value) => [value === null ? map : value, () => {}],
                };
            if (name === 'react/jsx-runtime')
                return { Fragment: 'fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            return {};
        },
    };
    vm.runInNewContext(compiled, context);
    const tree = context.exports.ModerationMap({
        center: { latitude: 52, longitude: 5 },
        layer: 'streets',
        nearby: [{ latitude: 52, longitude: 5 }],
        ...props,
    });
    const corners = [tree.props.children].flat().filter((node) => node?.props?.className?.includes('absolute'));
    const flat = (nodes) => [nodes].flat().flatMap((node) => (node?.type === 'fragment' ? flat(node.props.children) : node ? [node] : []));
    const top = corners.find((node) => node.props.className.includes('top-3'));
    const bottom = corners.find((node) => node.props.className.includes('bottom-7'));
    const container = flat(tree.props.children).find((node) => node.props?.className?.includes('z-0 size-full'));
    const mapChildren = flat(container.props.children);
    const focus = mapChildren.find((node) => node.type?.name === 'Focus');
    return { top: flat(top.props.children), bottom, pans, fits, focus, mapChildren };
}

test('the map passes the proposal identity to its camera', () => {
    assert.equal(renderMap({ reviewKey: '12' }).focus.props.reviewKey, '12');
});

test('proposal aerial imagery keeps the street tiles underneath while aerial tiles load', () => {
    const tiles = (props) => renderMap(props).mapChildren.filter((node) => node.props && ('url' in node.props || 'layer' in node.props));
    const street = tiles({ overviewKey: '1:open:1', layer: 'streets' });
    const aerialReview = tiles({ reviewKey: '12', layer: 'satellite' });
    const otherAerialMap = tiles({ layer: 'satellite' });

    assert.equal(street.length, 1);
    assert.equal(aerialReview.length, 2);
    assert.equal(aerialReview[0].props.url, street[0].props.url);
    assert.equal(aerialReview[0].props.maxZoom, street[0].props.maxZoom);
    assert.equal(otherAerialMap.length, 1);
});

test('the legend sits in the top right between the layer switch and the links, not with the zoom buttons', () => {
    const { top, bottom } = renderMap({ controls: 'layer switch', links: 'street view' });
    assert.equal(top[0], 'layer switch');
    assert.equal(top[1].type.name, 'MapLegend');
    assert.equal(top[2], 'street view');
    assert.ok(![bottom.props.children].flat().some((node) => node?.type?.name === 'MapLegend'));
});

test('on a small screen one menu takes the legend, so there is no separate legend button', () => {
    let received;
    const { top } = renderMap({
        controls: (legend) => {
            received = legend;
            return 'layers menu';
        },
        links: 'street view',
    });
    assert.deepEqual([...top], ['layers menu', 'street view']);
    assert.equal(JSON.stringify(received.map((item) => item.key)), '["community"]');
});

test('the map buttons stay above the sheet that covers the bottom of the map', () => {
    assert.equal(renderMap({ insetBottom: 380 }).bottom.props.style.bottom, 392);
    assert.equal(renderMap({}).bottom.props.style, undefined);
});

test('the tooltip stops the map click before it removes the selected bay', () => {
    const { renderBay } = setup();
    const calls = [];
    const marker = renderBay({
        bay: { point: { latitude: 52, longitude: 5 }, number: 2, state: 'selected', label: 'Bay 2' },
        onRemove: () => calls.push('remove'),
    });
    const toolbar = marker.props.children.props.children;
    const remove = toolbar.props.children.find((child) => child?.type === 'button');

    remove.props.onClick({ stopPropagation: () => calls.push('stop') });

    assert.deepEqual(calls, ['stop', 'remove']);
});

test('inspecting an existing parking space pans it into the visible map without setting a zoom', () => {
    const inspectedPin = { latitude: 52.00001, longitude: 5.00001 };
    const { pans } = renderMap({ inspectedPin, inset: 452, insetBottom: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(pans)), [
        {
            point: [inspectedPin.latitude, inspectedPin.longitude],
            options: { paddingTopLeft: [500, 88], paddingBottomRight: [72, 48], animate: true },
        },
    ]);
    assert.equal(renderMap({}).pans.length, 0);
});

test('the municipality overview fits both existing parking layers with the proposal pins, while the detail walk stays zoomed', () => {
    const props = {
        fitParking: true,
        nearby: [{ latitude: 52, longitude: 5 }],
        municipal: [{ latitude: 52.1, longitude: 5.1 }],
        queue: [{ key: 'proposal', point: { latitude: 52.2, longitude: 5.2 }, color: 'blue' }],
    };

    assert.equal(JSON.stringify(renderMap(props).fits), '[[[52.2,5.2],[52,5],[52.1,5.1]]]');
    assert.equal(renderMap({ ...props, fitQueue: false }).fits.length, 0);
});
