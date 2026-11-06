import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/live-reload.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
    const requests = [];
    const timers = new Map();
    let nextTimer = 0;
    let before;
    const context = {
        exports: {},
        setTimeout: (fn) => {
            timers.set(++nextTimer, fn);
            return nextTimer;
        },
        clearTimeout: (id) => timers.delete(id),
        require: () => ({
            router: {
                on: (name, callback) => {
                    assert.equal(name, 'before');
                    before = callback;
                },
                reload: (options) => requests.push(options),
            },
        }),
    };
    vm.runInNewContext(source, context);
    return {
        reload: context.exports.scheduleLiveReload,
        requests,
        flush: () => {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach((fn) => fn());
        },
        navigate: (async = false) => before({ detail: { visit: { async } } }),
    };
}

test('a broadcast burst combines layout and page props into one silent request', () => {
    const live = setup();
    live.reload(['notifications']);
    live.reload(['counts']);
    live.reload(['datasets', 'imports', 'counts']);
    assert.equal(live.requests.length, 0);
    live.flush();
    assert.equal(live.requests.length, 1);
    assert.deepEqual([...live.requests[0].only], ['notifications', 'counts', 'datasets', 'imports']);
    assert.equal(live.requests[0].showProgress, false);
});

test('events arriving during a request are fetched afterwards without overlap or loss', () => {
    const live = setup();
    live.reload(['counts']);
    live.flush();
    live.reload(['counts']);
    live.reload(['spaces']);
    live.flush();
    assert.equal(live.requests.length, 1);
    live.requests[0].onFinish();
    live.flush();
    assert.equal(live.requests.length, 2);
    assert.deepEqual([...live.requests[1].only], ['counts', 'spaces']);
});

test('navigation cancels pending props from the old page; unrelated async requests do not', () => {
    const live = setup();
    live.reload(['imports']);
    live.navigate();
    live.flush();
    assert.equal(live.requests.length, 0);
    live.reload(['garages']);
    live.navigate(true);
    live.flush();
    assert.deepEqual([...live.requests[0].only], ['garages']);
});

test('navigation discards queued old-page invalidations while a reload is in flight', () => {
    const live = setup();
    live.reload(['imports']);
    live.flush();
    live.reload(['imports']);
    live.navigate();
    live.reload(['garages']);
    live.requests[0].onFinish();
    live.flush();
    assert.deepEqual([...live.requests[1].only], ['garages']);
});

test('garage observation events share the reload batch and periodic freshness checks never overlap', () => {
    const live = setup();
    let receive;
    let cleanup;
    let poll;
    const channel = {
        listen: (event, handler) => {
            assert.equal(event, '.observations.applied');
            receive = handler;
        },
        stopListening: (event, handler) => {
            assert.equal(handler, receive);
            receive = null;
        },
    };
    const source = ts.transpileModule(readFileSync(new URL('../../resources/js/hooks/use-garage-updates.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const modules = {
        '@/echo': { getEcho: () => ({ channel: () => channel }) },
        '@/lib/live-reload': { scheduleLiveReload: live.reload },
        react: {
            useEffect: (effect) => {
                cleanup = effect();
            },
        },
        '@inertiajs/react': {
            usePoll: (interval, options, config) => {
                poll = { interval, options, config };
            },
        },
    };
    const context = { exports: {}, require: (name) => modules[name] };
    vm.runInNewContext(source, context);
    context.exports.useGarageUpdates(['garages']);
    receive();
    receive();
    live.reload(['counts']);
    live.flush();
    assert.equal(live.requests.length, 1);
    assert.deepEqual([...live.requests[0].only], ['garages', 'counts']);
    assert.equal(poll.interval, 120000);
    assert.equal(poll.options.showProgress, false);
    assert.equal(poll.config.mode, 'rest');
    cleanup();
    assert.equal(receive, null);
});
