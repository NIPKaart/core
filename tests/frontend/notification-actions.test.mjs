import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/notifications/badge-bell.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount() {
    const calls = [];
    const recent = [
        { id: 'a', read_at: null },
        { id: 'b', read_at: null },
        { id: 'c', read_at: 'already-read' },
    ];
    const props = { auth: { user: { id: 7 } }, notifications: { unread: 8, recent } };
    const router = {
        get: (...args) => calls.push(args),
        reload: () => assert.fail('A read action must not issue another reload'),
        visit: (url) => calls.push(['visit', url]),
    };
    const modules = {
        '@inertiajs/react': { usePage: () => ({ props }), router, Link: 'Link' },
        react: {
            useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
            useEffect: () => {},
            useRef: (value) => ({ current: value }),
            useMemo: (fn) => fn(),
        },
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        'react-i18next': { useTranslation: () => ({ t: (key, options) => (options?.count === undefined ? key : `${key}: ${options.count}`) }) },
        '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
        '@/hooks/use-media-query': { useMediaQuery: () => true },
        '@/routes/notifications': {
            default: { index: () => '/notifications', readAll: () => '/notifications/read/all', read: (id) => `/notifications/${id}/read` },
        },
    };
    const context = { exports: {}, require: (name) => modules[name] ?? new Proxy({}, { get: (_, key) => key }) };
    vm.runInNewContext(source, context);
    const tree = context.exports.default();
    function find(node, predicate) {
        if (!node || typeof node !== 'object') return;
        if (predicate(node)) return node;
        for (const child of [node.props?.children].flat()) {
            const found = find(child, predicate);
            if (found) return found;
        }
    }
    const text = (node) =>
        typeof node === 'string'
            ? node
            : [node?.props?.children]
                  .flat()
                  .map((child) => (child && typeof child === 'object' ? text(child) : (child ?? '')))
                  .join('');
    return { calls, props, button: find(tree, (n) => n.props?.onClick), list: find(tree, (n) => n.props?.onMarkOne), text: text(tree) };
}

test('marking all read updates the counter and list optimistically with one silent partial visit', () => {
    const { calls, props, button } = mount();
    button.props.onClick();
    assert.equal(calls.length, 1);
    const [url, , options] = calls[0];
    assert.equal(url, '/notifications/read/all');
    assert.equal(options.showProgress, false);
    assert.deepEqual([...options.only], ['notifications', 'notificationList']);
    const updated = options.optimistic(props).notifications;
    assert.equal(updated.unread, 0);
    assert.ok(updated.recent.every((n) => n.read_at));
    assert.equal(updated.recent[2].read_at, 'already-read');
    options.onSuccess?.();
    assert.equal(calls.length, 1);
});

test('marking one read preserves other notifications and never decrements an already read item', () => {
    const { calls, props, list } = mount();
    list.props.onMarkOne('a');
    const options = calls[0][2];
    assert.equal(options.showProgress, false);
    const updated = options.optimistic(props).notifications;
    assert.equal(updated.unread, 7);
    assert.ok(updated.recent[0].read_at);
    assert.equal(updated.recent[1].read_at, null);
    list.props.onMarkOne('c');
    assert.equal(calls[1][2].optimistic(props).notifications.unread, 8);
});

test('opening a notification visits its destination after saving the read state', () => {
    const { calls, list } = mount();
    list.props.onOpen('a', '/destination');
    assert.equal(calls.length, 1);
    calls[0][2].onSuccess();
    assert.deepEqual(calls[1], ['visit', '/destination']);
});

test('the dropdown opens on unread notifications and counts the unread ones it cannot show', () => {
    const { list, text } = mount();
    assert.deepEqual(
        list.props.items.map((n) => n.id),
        ['a', 'b'],
    );
    assert.equal(list.props.caughtUp, true);
    assert.match(text, /filters\.unread8/);
    assert.match(text, /footer\.moreUnread: 6/);
});

function renderModule(path, modules) {
    const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const jsx = (type, props) => ({ type, props });
    const context = {
        exports: {},
        require: (name) => (name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : (modules[name] ?? new Proxy({}, { get: (_, key) => key }))),
    };
    vm.runInNewContext(compiled, context);
    return context.exports;
}

function elements(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat().flatMap(elements)];
}

for (const [action, readAt, expectedMethod] of [
    ['read', null, 'get'],
    ['unread', 'read', 'get'],
    ['remove', null, 'delete'],
]) {
    test(`notification table ${action} action uses the redirect response without another reload`, () => {
        const requests = [];
        const routes = Object.fromEntries(['read', 'unread', 'remove'].map((name) => [name, ({ id }) => `/${id}/${name}`]));
        const router = {
            get: (url, data, options) => requests.push({ url, options, method: 'get' }),
            delete: (url, options) => requests.push({ url, options, method: 'delete' }),
            reload: () => assert.fail('Redundant reload'),
        };
        const { getNotificationColumns } = renderModule('../../resources/js/pages/backend/notifications/columns.tsx', {
            '@/routes/notifications': { default: routes },
            '@inertiajs/react': { router },
        });
        const columns = getNotificationColumns({ t: (key) => key, tGlobal: (key) => key });
        const tree = columns.find((column) => column.id === 'actions').cell({ row: { original: { id: 'a', read_at: readAt } } });
        const buttons = elements(tree).filter((element) => element.props?.onSelect);
        buttons[action === 'remove' ? 1 : 0].props.onSelect({ preventDefault() {} });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, expectedMethod);
        assert.equal(requests[0].url, `/a/${action}`);
        assert.equal(requests[0].options.showProgress, false);
        assert.deepEqual([...requests[0].options.only], ['notifications', 'notificationList', 'options']);
        requests[0].options.onSuccess?.();
        assert.equal(requests.length, 1);
    });
}

test('bulk notification actions update the list and counter from one response', () => {
    const requests = [];
    let stateIndex = 0;
    const { default: Page } = renderModule('../../resources/js/pages/backend/notifications/index.tsx', {
        react: { useState: () => [[{ 0: true }, 'mark_read', [], []][stateIndex++], () => {}], useEffect() {}, useMemo: (fn) => fn() },
        '@/hooks/use-resource-translation': { useResourceTranslation: () => ({ t: (key) => key, tGlobal: (key) => key }) },
        '@/routes/notifications': { default: { index: () => '/notifications', bulk: () => '/notifications/bulk' } },
        './columns': { getNotificationColumns: () => [] },
        '@inertiajs/react': { router: { patch: (...args) => requests.push(args), reload: () => assert.fail('Redundant reload') } },
    });
    const tree = Page({ notificationList: { data: [{ id: 'a' }] }, filters: { read: null, type: null }, options: { types: {} } });
    elements(tree)
        .find((element) => element.props?.children === 'bulk.apply')
        .props.onClick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], '/notifications/bulk');
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0][1])), { ids: ['a'], action: 'mark_read' });
    assert.deepEqual([...requests[0][2].only], ['notifications', 'notificationList', 'options']);
    assert.equal(requests[0][2].showProgress, false);
    requests[0][2].onSuccess();
    assert.equal(requests.length, 1);
});
