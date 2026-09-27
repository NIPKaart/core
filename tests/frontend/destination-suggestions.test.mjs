import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/hooks/use-destination-suggestions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function mount(fetch, query = 'Amstel', open = true) {
    const state = [];
    let cleanup, timer;
    const context = { exports: {}, AbortController, fetch,
        setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = null; },
        require: name => {
            if (name === 'react') return {
                useState: initial => { const index = state.length; state.push(initial); return [initial, next => { state[index] = next; }]; },
                useEffect: fn => { cleanup = fn(); },
            };
            if (name === '@/routes/destinations') return { suggestions: { url: ({ query }) => '/suggestions?' + new URLSearchParams(query) } };
            throw new Error(name);
        },
    };
    vm.runInNewContext(source, context);
    context.exports.useDestinationSuggestions(query, open);
    return { state, run: () => timer?.(), cleanup: () => cleanup?.() };
}
test('inline search requests destination suggestions after debounce', async () => {
    let requested;
    const view = mount(async url => { requested = url; return { ok: true, json: async () => ({ results: [{ key: 'amstel' }] }) }; });
    assert.equal(requested, undefined);
    await view.run();
    assert.match(requested, /q=Amstel/);
    assert.equal(view.state[0][0].key, 'amstel');
    assert.equal(view.state[1], 'ready');
});
test('closing search or typing another query discards pending suggestions', async () => {
    let finish;
    const view = mount(() => new Promise(resolve => { finish = resolve; }));
    const pending = view.run();
    view.cleanup();
    finish({ ok: true, json: async () => ({ results: [{ key: 'obsolete' }] }) });
    await pending;
    assert.equal(view.state[0].length, 0);
    assert.notEqual(view.state[1], 'ready');
});
for (const [query, open] of [['A', true], ['Amsterdam', false]]) {
    test(`search makes no request for ${open ? 'a short query' : 'a collapsed field'}`, async () => {
        const view = mount(() => assert.fail('unexpected request'), query, open);
        await view.run();
        assert.equal(view.state[1], 'idle');
    });
}
test('failed requests expose a retryable error state', async () => {
    const view = mount(async () => ({ ok: false }));
    await view.run();
    assert.equal(view.state[1], 'error');
    assert.equal(view.state[0].length, 0);
});
