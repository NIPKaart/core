import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/moderation/index.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const tags = new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : String(name)) });
const find = (node, type) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === type) return node;
    return [node.props?.children]
        .flat(Infinity)
        .map((child) => find(child, type))
        .find(Boolean);
};

function setup() {
    const state = [];
    let cursor = 0;
    let request;
    const context = {
        exports: {},
        require: (name) => {
            if (name === 'react/jsx-runtime') {
                const jsx = (type, props) => ({ type, props });
                return { jsx, jsxs: jsx };
            }
            if (name === 'react')
                return {
                    useState: (initial) => {
                        const index = cursor++;
                        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
                        return [
                            state[index],
                            (value) => {
                                state[index] = typeof value === 'function' ? value(state[index]) : value;
                            },
                        ];
                    },
                    useEffect: () => {},
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@inertiajs/react')
                return {
                    ...tags,
                    router: {
                        visit: (_, options) => {
                            request = options;
                        },
                    },
                };
            if (name === '@/routes/app') return { default: { moderation: { index: () => '/moderation' } } };
            if (name === './geo') return { panelMode: (selected, count) => (selected ? 'item' : count ? 'selection' : 'queue') };
            if (name === './types') return { filterQuery: () => ({}), itemUrl: () => '/item' };
            if (name === './values') return { useValueFormatter: () => () => '' };
            if (name === './parts') return { useAgo: () => () => '' };
            if (name === './shortcuts') return { useShortcuts: () => {} };
            if (name === './queue-list') return { QueueList: 'QueueList', TYPE_COLORS: { submission: 'blue' } };
            if (name === './decided') return { DecidedList: 'DecidedList', DecisionPane: 'DecisionPane', decisionColor: (row) => row.decision };
            return tags;
        },
    };
    vm.runInNewContext(source, context);
    const item = { key: 'submission:1', type: 'submission', latitude: 52, longitude: 5 };
    const props = {
        status: 'open',
        filters: {},
        items: { data: [item] },
        history: null,
        selected: null,
        position: null,
        decidedToday: 0,
        options: { can: {} },
    };
    return {
        render: (changes = {}) => {
            cursor = 0;
            return context.exports.default({ ...props, ...changes });
        },
        finish: () => request.onFinish(),
        item,
    };
}

test('opening a queue item keeps the queue visible until the actual details arrive', () => {
    const app = setup();
    find(app.render(), 'QueueList').props.onOpen(app.item);

    assert.ok(find(app.render(), 'QueueList'), 'the queue must not flash an empty item skeleton while the request is pending');
    const ready = app.render({ selected: app.item, position: { index: 1 } });
    assert.ok(find(ready, 'ReviewPane'), 'the loaded item replaces the queue');
    app.finish();
});

test('a failed item request keeps the queue visible', () => {
    const app = setup();
    find(app.render(), 'QueueList').props.onOpen(app.item);
    app.finish();

    assert.ok(find(app.render(), 'QueueList'));
});

test('decided items show on the map and open as a decision in the panel', () => {
    const app = setup();
    const removed = { key: 'removal:1', type: 'report', decision: 'removed', street: 'Coolsingel', latitude: 51.92, longitude: 4.48 };
    const gone = { key: 'kept:2', type: 'report', decision: 'kept', street: null, latitude: null, longitude: null };
    const decided = { status: 'decided', items: null, history: { data: [removed, gone] } };

    const overview = app.render(decided);
    const pins = find(overview, 'Workspace').props.map.queue;
    assert.deepEqual(
        pins.map((pin) => pin.key),
        ['removal:1'],
        'a decision without a known location has no pin',
    );
    assert.equal(pins[0].color, 'removed');

    find(overview, 'DecidedList').props.onOpen(removed);
    const opened = app.render(decided);
    assert.equal(find(opened, 'DecisionPane').props.row, removed);
    assert.deepEqual(
        find(opened, 'Workspace').props.map.queue.map((pin) => pin.key),
        ['removal:1'],
    );

    find(opened, 'DecisionPane').props.onBack();
    assert.ok(find(app.render(decided), 'DecidedList'), 'going back shows the list again');
});

test('selecting an item keeps the map where it is and numbers the selected pin', () => {
    const app = setup();
    const before = find(app.render(), 'Workspace').props.map;
    find(app.render(), 'QueueList').props.onCheck([app.item.key]);

    const after = find(app.render(), 'Workspace').props.map;
    assert.deepEqual(after.center, before.center, 'the map must not move to the selection');
    assert.deepEqual(
        after.queue.map((pin) => pin.key),
        before.queue.map((pin) => pin.key),
        'every queue pin stays on the map',
    );
    assert.equal(after.queue[0].number, 1);
    assert.equal(before.queue[0].number, undefined);
    assert.ok(find(app.render(), 'QueueList'), 'the list stays in the panel');
});
