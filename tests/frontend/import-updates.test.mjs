import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/hooks/use-import-updates.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(inProgress, live = false) {
    const reloads = [];
    const poll = { started: 0, stopped: 0, options: null };
    const listeners = new Map();
    const cleanups = [];
    const window = {
        addEventListener: (name, handler) => listeners.set(name, handler),
        removeEventListener: (name, handler) => listeners.get(name) === handler && listeners.delete(name),
    };
    const context = {
        exports: {},
        window,
        require: (name) => {
            if (name === 'react') return { useEffect: (effect) => cleanups.push(effect()) };
            if (name === '@inertiajs/react')
                return {
                    router: { reload: (options) => reloads.push(options) },
                    usePoll: (interval, options, config) => {
                        poll.options = { interval, ...options, ...config };
                        return { start: () => poll.started++, stop: () => poll.stopped++ };
                    },
                };
            if (name === '@/hooks/use-notifications') return { NOTIFICATION_EVENT: 'nipkaart:notification' };
            if (name === '@/hooks/use-dataset-changes') return { DATASET_EVENT: 'nipkaart:dataset-changed' };
            if (name === '@/echo') return { getEcho: () => (live ? {} : undefined) };
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(source, context);
    context.exports.useImportUpdates(['datasets', 'imports'], inProgress);
    const notify = (type) => listeners.get('nipkaart:notification')?.({ detail: { type } });
    const change = (scope) => listeners.get('nipkaart:dataset-changed')?.({ detail: { scope, target_type: 'offstreet' } });

    return { reloads, poll, notify, change, listeners, unmount: () => cleanups.forEach((cleanup) => cleanup?.()), exports: context.exports };
}

test('import notifications reload the page data; other notifications leave it alone', () => {
    const page = mount(false);
    page.notify('dataset.source_awaiting_approval');
    page.notify('dataset.import_ready_for_review');
    page.notify('community.space_submitted');

    assert.equal(page.reloads.length, 2);
    assert.deepEqual([...page.reloads[0].only], ['datasets', 'imports']);
    assert.equal(page.exports.isImportNotification(null), false);
    assert.equal(page.exports.isImportNotification({ type: 42 }), false);
});

test('live dataset changes reload the page data instantly, except live occupancy', () => {
    const page = mount(false, true);
    page.change('deliveries');
    page.change('imports');
    page.change('observations');

    assert.equal(page.reloads.length, 2);
    assert.deepEqual([...page.reloads[1].only], ['datasets', 'imports']);
});

test('with a live connection processing needs no polling', () => {
    const live = mount(true, true);
    assert.equal(live.poll.started, 0);
});

test('without a live connection polling runs only while deliveries are in progress and never overlaps', () => {
    const busy = mount(true);
    assert.equal(busy.poll.started, 1);
    assert.equal(busy.poll.options.autoStart, false);
    assert.equal(busy.poll.options.mode, 'rest');
    assert.equal(busy.poll.options.interval, 10000);

    const idle = mount(false);
    assert.equal(idle.poll.started, 0);
    assert.ok(idle.poll.stopped >= 1);
});

test('unmounting removes the listener and stops polling', () => {
    const page = mount(true);
    page.unmount();

    assert.equal(page.listeners.size, 0);
    assert.ok(page.poll.stopped >= 1);
});
