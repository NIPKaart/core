import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/nearby-discovery.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function mount(fetch) {
    let cleanup;
    const results = [], statuses = [], more = [];
    const context = { exports: {}, AbortController, fetch, require: (name) => {
        if (name === 'react') return { useEffect: (fn) => { cleanup = fn(); } };
        if (name === '@/routes/map/parking') return { nearby: { url: ({ query }) => '/nearby?' + new URLSearchParams(query) } };
        throw new Error(name);
    } };
    vm.runInNewContext(source, context);
    context.exports.default({ origin: { latitude: 52, longitude: 5 }, filters: { source: 'municipal', radius: 500, sort: 'balanced' }, page: 2, retry: 0,
        onResults: value => results.push(value), onStatus: value => statuses.push(value), onHasMore: value => more.push(value) });
    return { results, statuses, more, cleanup: () => cleanup() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('destination filters and page are sent together and replace stale map/list results', async () => {
    let query;
    const view = mount(async url => {
        query = new URL(url, 'https://example.test').searchParams;
        return { ok: true, json: async () => ({ results: ['municipal:a'], has_more: true }) };
    });
    await flush();
    assert.equal(query.get('radius'), '500');
    assert.equal(query.get('source'), 'municipal');
    assert.equal(query.get('sort'), 'balanced');
    assert.equal(query.get('page'), '2');
    assert.equal(query.get('latitude'), '52');
    assert.equal(view.results[0].length, 0);
    assert.deepEqual(view.results.at(-1), ['municipal:a']);
    assert.deepEqual(view.statuses, ['loading', 'ready']);
    assert.deepEqual(view.more, [false, true]);
});

test('superseded requests cannot restore obsolete results', async () => {
    let resolve;
    const view = mount(() => new Promise(done => { resolve = done; }));
    view.cleanup();
    resolve({ ok: true, json: async () => ({ results: ['old'], has_more: true }) });
    await flush();
    assert.equal(view.results.length, 1);
    assert.equal(view.results[0].length, 0);
    assert.deepEqual(view.statuses, ['loading']);
});

for (const kind of ['http', 'network', 'json']) {
    test(`${kind} failures expose an error with no obsolete results`, async () => {
        const view = mount(async () => {
            if (kind === 'network') throw new Error('offline');
            return { ok: kind !== 'http', json: async () => { throw new Error('invalid json'); } };
        });
        await flush();
        assert.deepEqual(view.statuses, ['loading', 'error']);
        assert.equal(view.results.at(-1).length, 0);
    });
}
