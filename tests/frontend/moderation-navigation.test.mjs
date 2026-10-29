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
