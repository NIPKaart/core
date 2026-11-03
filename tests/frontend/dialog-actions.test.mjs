import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, overrides = () => undefined) {
    const context = {
        exports: {},
        require: (name) => overrides(name) ?? (name === '@/lib/utils' ? { cn: (...values) => values.filter(Boolean).join(' ') } : require(name)),
    };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../resources/js/components/${file}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, context);
    return context.exports;
}
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const match = find(child, predicate);
        if (match) return match;
    }
    return null;
}
const { Button } = load('ui/button.tsx');

test('shared buttons expose a pointer cursor, ghost hover and a keyboard focus indicator', () => {
    const button = Button({ variant: 'ghost', disabled: true });
    assert.match(button.props.className, /\bcursor-pointer\b/);
    assert.match(button.props.className, /hover:bg-accent/);
    assert.match(button.props.className, /focus-visible:ring-/);
    assert.match(button.props.className, /disabled:pointer-events-none/);
    assert.equal(button.props.disabled, true);
});

test('the standard dialog close action uses the same ghost button and retains its accessible name', () => {
    const { DialogContent } = load('ui/dialog.tsx', (name) => {
        if (name === '@/components/ui/button') return { Button };
        if (name === '@radix-ui/react-dialog') return new Proxy({}, { get: (_, key) => key });
        if (name === 'react-i18next') return { useTranslation: () => ({ t: () => 'Close' }) };
    });
    const tree = DialogContent({});
    const close = find(tree, (node) => node.type === 'Close');
    assert.equal(close.props.asChild, true);
    const action = close.props.children;
    assert.equal(action.type, Button);
    assert.equal(action.props.variant, 'ghost');
    assert.equal(action.props.size, 'icon');
    assert.doesNotMatch(action.props.className, /rounded-full|bg-muted/);
    assert.ok(find(action, (node) => node.type === 'span' && node.props.children === 'Close'));
    assert.equal(find(DialogContent({ showClose: false }), (node) => node.type === 'Close'), null);
});

function loadParkingDetail({ data = null, allowed = false, desktop = true } = {}) {
    let stateIndex = 0;
    return load('map/parking-detail/parking-detail.tsx', (name) => {
        if (name === 'react') return { useState: (initial) => [stateIndex++ === 0 && data ? data : stateIndex === 2 && data ? 'ready' : initial, () => {}], useEffect() {}, useRef: () => ({ current: null }), useCallback: (fn) => fn };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) };
        if (name === '@/lib/place-link') return { placeLinkPath: () => '/map' };
        if (name === '@/routes') return { login: () => '/login' };
        if (name === '@inertiajs/react') return { Link: 'Link' };
        if (name === '@/hooks/use-authorization') return { useAuthorization: () => ({ user: null, can: (ability) => allowed && ability === 'parking-space.view' }) };
        if (name === '@/hooks/use-media-query') return { useMediaQuery: () => desktop };
        if (name === '@/routes/app') return { __esModule: true, default: { parkingSpaces: { show: ({ parking_space }) => ({ url: `/admin/parking-spaces/${parking_space}`, method: 'get' }) } } };
        if (name.startsWith('@/routes/map/')) return { show: { url: () => '/detail' } };
        if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
        if (name.startsWith('@/') || name.startsWith('./')) return new Proxy({}, { get: (_, key) => key });
    }).default;
}

test('parking detail share and close actions have matching hover surfaces and remain operable', () => {
    let closed = false;
    const Detail = loadParkingDetail();
    const tree = Detail({ result: { key: 'community:a', id: 'a', source: 'community', title: 'Street', latitude: 52, longitude: 5, distance_metres: null }, open: true, onClose: () => { closed = true; } });
    const share = find(tree, (node) => node.props['aria-label'] === 'detail.share');
    const close = find(tree, (node) => node.props['aria-label'] === 'common.close');
    assert.equal(share.props.variant, 'ghost');
    assert.equal(close.props.variant, 'ghost');
    assert.equal(share.props.size, 'icon');
    assert.equal(close.props.size, 'icon');
    assert.equal(share.props.className, close.props.className);
    assert.match(share.props.className, /cursor-pointer/);
    assert.match(share.props.className, /hover:text-red-500/);
    assert.doesNotMatch(share.props.className, /rounded-full|bg-muted/);
    assert.equal(typeof share.props.onClick, 'function');
    close.props.onClick();
    assert.equal(closed, true);
});


for (const desktop of [true, false]) {
    test(`management is a named icon in the ${desktop ? 'dialog' : 'drawer'} header for authorized community records`, () => {
        const Detail = loadParkingDetail({ desktop, allowed: true, data: { source: 'community', detail: { id: 'a', street: 'Street' } } });
        const tree = Detail({ result: { source: 'community', id: 'a', title: 'Street', distance_metres: null }, open: true, onClose() {} });
        const header = find(tree, (node) => node.type === (desktop ? 'DialogHeader' : 'DrawerHeader'));
        const link = find(header, (node) => node.type === 'Link' && node.props['aria-label'] === 'detail.admin');
        assert.ok(link);
        assert.equal(link.props.href.url, '/admin/parking-spaces/a');
        assert.equal(link.props.target, '_blank');
        assert.equal(find(tree, (node) => node.type === 'DialogFooter' || node.type === 'DrawerFooter'), null);
        assert.ok(find(header, (node) => node.type === 'TooltipContent' && node.props.children === 'detail.admin'));
    });
}

test('the management shortcut stays hidden without permission and for imported records', () => {
    for (const [source, allowed] of [['community', false], ['municipal', true], ['offstreet', true]]) {
        const Detail = loadParkingDetail({ allowed, data: { source, detail: { id: 'a' } } });
        const tree = Detail({ result: { source, id: 'a', title: 'Street', distance_metres: null }, open: true, onClose() {} });
        assert.equal(find(tree, (node) => node.props['aria-label'] === 'detail.admin'), null);
    }
});
