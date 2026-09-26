import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/viewport-discovery.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(fetch) {
    let timer, move, cleanup, effect;
    let zoom = 10;
    const results = [], statuses = [];
    const bounds = { contains: () => true, pad() { return this; }, getWest: () => 4, getSouth: () => 52, getEast: () => 5, getNorth: () => 53 };
    const context = { exports: {}, AbortController, fetch, window: { setTimeout: (callback) => { timer = callback; return 1; }, clearTimeout: () => { timer = null; } }, require: (name) => {
        if (name === 'react') return { useRef: (current) => ({ current }), useCallback: (fn) => fn, useEffect: (fn) => { effect = fn; cleanup = fn(); } };
        if (name === 'react-leaflet') return { useMap: () => ({ getBounds: () => bounds, getZoom: () => zoom }), useMapEvents: ({ moveend }) => { move = moveend; } };
        if (name === '@/routes/map/parking') return { viewport: { url: () => '/map/parking/viewport' } };
        throw new Error(`Unexpected import: ${name}`);
    } };
    vm.runInNewContext(source, context);
    context.exports.default({ onResults: (value) => results.push(value), onStatus: (value) => statuses.push(value), retry: 0 });
    return { results, statuses, run: () => timer?.(), move: () => move(), zoom: () => { zoom++; move(); }, retry: () => { cleanup(); cleanup = effect(); }, cleanup: () => cleanup() };
}

test('zooming reloads a capped area and replaces the previous result set', async () => {
    let calls = 0;
    const view = mount(async () => ({ ok: true, json: async () => ({ results: [++calls] }) }));
    await view.run();
    view.move();
    await view.run();
    assert.equal(calls, 1);
    view.zoom();
    await view.run();
    assert.deepEqual(view.results, [[1], [2]]);
    assert.equal(view.statuses.at(-1), 'ready');
});

for (const failure of ['http', 'network', 'json']) {
    test(`${failure} failure clears stale locations and retry can recover`, async () => {
        let fail = true;
        const view = mount(async () => {
            if (fail && failure === 'network') throw new Error('offline');
            return { ok: !(fail && failure === 'http'), json: async () => {
                if (fail && failure === 'json') throw new Error('invalid json');
                return { results: ['recovered'] };
            } };
        });
        await view.run();
        assert.equal(view.statuses.at(-1), 'error');
        assert.equal(view.results.at(-1).length, 0);
        fail = false;
        view.retry();
        await view.run();
        assert.deepEqual(view.results.at(-1), ['recovered']);
        assert.equal(view.statuses.at(-1), 'ready');
    });
}

test('a superseded response cannot overwrite the current map and list', async () => {
    let resolveFirst;
    let calls = 0;
    const view = mount(async () => ({ ok: true, json: () => ++calls === 1 ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve({ results: ['new'] }) }));
    const first = view.run();
    await Promise.resolve();
    view.zoom();
    await view.run();
    resolveFirst({ results: ['old'] });
    await first;
    assert.deepEqual(view.results, [['new']]);
});

test('unmount cancels a pending response without announcing a false error', async () => {
    let resolve;
    const view = mount(() => new Promise((done) => { resolve = done; }));
    const pending = view.run();
    view.cleanup();
    resolve({ ok: true, json: async () => ({ results: ['obsolete'] }) });
    await pending;
    assert.equal(view.results.length, 0);
    assert.deepEqual(view.statuses, ['loading']);
});
