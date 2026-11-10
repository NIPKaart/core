import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/smooth-wheel-zoom.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

test('wheel updates retarget the running zoom without moving its anchor until the cursor moves', () => {
    let onWheel;
    let onMoveEnd;
    let frame;
    let location = 'initial location';
    const destinations = [];
    const pointerAt = (x) => ({ equals: (other) => x === other.x, subtract: () => x, x });
    const map = {
        getContainer: () => ({ addEventListener: (_, handler) => (onWheel = handler) }),
        getSize: () => ({ divideBy: () => 0 }),
        getZoom: () => 10,
        getMinZoom: () => 0,
        getMaxZoom: () => 22,
        containerPointToLatLng: () => location,
        mouseEventToContainerPoint: (event) => pointerAt(event.x),
        project: (anchor) => ({ subtract: () => anchor }),
        unproject: (anchor) => anchor,
        flyTo: (anchor, zoom) => destinations.push([anchor, zoom]),
        on: (_, handler) => (onMoveEnd = handler),
    };
    const context = {
        exports: {},
        require: (name) =>
            ({
                leaflet: { DomEvent: { getWheelDelta: (event) => event.delta } },
                react: { useEffect: (effect) => effect() },
                'react-leaflet': { useMap: () => map },
            })[name],
        window: {
            matchMedia: () => ({ matches: false }),
            requestAnimationFrame: (callback) => {
                frame = callback;
                return 1;
            },
        },
    };
    vm.runInNewContext(source, context);
    context.exports.SmoothWheelZoom();

    const scroll = (delta, x) => {
        onWheel({ delta, x, preventDefault() {} });
        frame();
    };
    scroll(120, 100);
    location = 'intermediate location';
    scroll(-60, 100);
    scroll(120, 200);
    onMoveEnd();
    location = 'settled location';
    scroll(120, 200);

    assert.deepEqual(destinations, [
        ['initial location', 10.5],
        ['initial location', 10.25],
        ['intermediate location', 10.75],
        ['settled location', 10.5],
    ]);
});
